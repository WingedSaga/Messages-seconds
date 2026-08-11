import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import api from '../api/axios';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL
    ? [{ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }]
    : []),
];

export default function CallOverlay({ call, peerName, peerAvatar, onEnded }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peer = useRef(null);
  const stream = useRef(null);
  const lastSignal = useRef(0);
  const pendingCandidates = useRef([]);
  const onEndedRef = useRef(onEnded);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [status, setStatus] = useState(call.role === 'caller' ? 'Вызываем…' : 'Соединяем…');

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Короткий знакомый гудок слышит только инициатор до установления соединения.
  // Он создаётся Web Audio API, поэтому не нужен тяжёлый mp3-файл и нет проблем с лицензией.
  useEffect(() => {
    if (call.role !== 'caller' || status !== 'Вызываем…') return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;
    const context = new AudioContextClass();

    const beep = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.36);
    };

    context.resume().then(beep).catch(() => {});
    const timer = window.setInterval(() => {
      context.resume().then(beep).catch(() => {});
    }, 1800);

    return () => {
      window.clearInterval(timer);
      context.close().catch(() => {});
    };
  }, [call.role, status]);

  useEffect(() => {
    let stopped = false;
    let timer;

    const close = () => {
      stream.current?.getTracks().forEach((track) => track.stop());
      peer.current?.close();
      stream.current = null;
      peer.current = null;
    };

    const sendSignal = (kind, payload) => api.post(`/calls/${call.id}/signals`, { kind, payload });

    const addCandidate = async (candidate) => {
      if (!peer.current?.remoteDescription) {
        pendingCandidates.current.push(candidate);
        return;
      }
      await peer.current.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const receive = async () => {
      try {
        const { data } = await api.get(`/calls/${call.id}/signals`, { params: { after: lastSignal.current } });
        if (data.status === 'rejected' || data.status === 'ended') {
          close();
          onEndedRef.current();
          return;
        }

        for (const signal of data.signals) {
          lastSignal.current = Math.max(lastSignal.current, signal.id);
          if (signal.kind === 'candidate') {
            await addCandidate(signal.payload);
          } else if (signal.kind === 'offer' && call.role === 'callee') {
            await peer.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
            for (const candidate of pendingCandidates.current.splice(0)) await addCandidate(candidate);
            const answer = await peer.current.createAnswer();
            await peer.current.setLocalDescription(answer);
            await sendSignal('answer', peer.current.localDescription.toJSON());
          } else if (signal.kind === 'answer' && call.role === 'caller') {
            await peer.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
            for (const candidate of pendingCandidates.current.splice(0)) await addCandidate(candidate);
          }
        }
      } catch (err) {
        if (!stopped) setError(err.message);
      }
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
          throw new Error('Этот браузер не поддерживает звонки');
        }
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.type === 'video',
        });
        if (stopped) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (localVideo.current) localVideo.current.srcObject = media;

        const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peer.current = connection;
        media.getTracks().forEach((track) => connection.addTrack(track, media));
        connection.onicecandidate = ({ candidate }) => {
          if (candidate) sendSignal('candidate', candidate.toJSON()).catch(() => {});
        };
        connection.ontrack = ({ streams }) => {
          if (remoteVideo.current && streams[0]) remoteVideo.current.srcObject = streams[0];
        };
        connection.onconnectionstatechange = () => {
          if (connection.connectionState === 'connected') setStatus('Соединение защищено');
          if (connection.connectionState === 'failed') setError('Не удалось установить соединение');
        };

        if (call.role === 'caller') {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          await sendSignal('offer', connection.localDescription.toJSON());
        }
        timer = window.setInterval(receive, 1000);
        receive();
      } catch (err) {
        setError(err.name === 'NotAllowedError' ? 'Разрешите доступ к микрофону или камере' : err.message);
      }
    };

    start();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      close();
    };
  }, [call.id, call.role, call.type]);

  const end = async () => {
    try {
      await api.post(`/calls/${call.id}/end`);
    } catch {
      // Если сеть уже пропала, локальные дорожки всё равно останавливаем.
    }
    onEnded();
  };

  const toggleMute = () => {
    const next = !muted;
    stream.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    stream.current?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  };

  const video = call.type === 'video';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" role="dialog" aria-modal="true" aria-label="Звонок">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative grid min-h-[20rem] place-items-center bg-ink p-5 text-center text-white">
          {video && <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />}
          {video && <video ref={localVideo} autoPlay muted playsInline className="absolute bottom-4 right-4 h-28 w-20 rounded-xl border-2 border-white/70 bg-black object-cover" />}
          {peerAvatar ? (
            <img src={peerAvatar} alt="" className="relative h-20 w-20 rounded-full border-2 border-white/70 object-cover" />
          ) : (
            <div className="relative grid h-20 w-20 place-items-center rounded-full bg-brand text-2xl font-bold">{peerName?.[0] || '?'}</div>
          )}
          <div className={`relative ${video ? 'mt-56 rounded-xl bg-black/45 px-4 py-2 backdrop-blur-sm' : 'mt-4'}`}>
            <p className="font-semibold">{peerName}</p>
            <p className="mt-1 text-sm text-white/75">{error || status}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 p-4">
          <button type="button" onClick={toggleMute} className="icon-btn border border-line" aria-label="Включить или выключить микрофон">
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          {video && <button type="button" onClick={toggleCamera} className="icon-btn border border-line" aria-label="Включить или выключить камеру">
            {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>}
          <button type="button" onClick={end} className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700" aria-label="Завершить звонок">
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
