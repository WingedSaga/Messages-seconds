import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, ShieldCheck, Video, VideoOff } from 'lucide-react';
import api from '../api/axios';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL ? [{ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }] : []),
];

export default function CallOverlay({ call, peerName, peerAvatar, onEnded }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peer = useRef(null);
  const stream = useRef(null);
  const displayStream = useRef(null);
  const lastSignal = useRef(0);
  const pendingCandidates = useRef([]);
  const onEndedRef = useRef(onEnded);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState(call.role === 'caller' ? 'Вызываем…' : 'Соединяем…');

  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
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
      oscillator.start(); oscillator.stop(context.currentTime + 0.36);
    };
    context.resume().then(beep).catch(() => {});
    const timer = window.setInterval(() => context.resume().then(beep).catch(() => {}), 1800);
    return () => { window.clearInterval(timer); context.close().catch(() => {}); };
  }, [call.role, status]);

  useEffect(() => {
    let stopped = false;
    let timer;
    const close = () => {
      displayStream.current?.getTracks().forEach((track) => track.stop());
      stream.current?.getTracks().forEach((track) => track.stop());
      peer.current?.close();
      displayStream.current = null; stream.current = null; peer.current = null;
    };
    const sendSignal = (kind, payload) => api.post(`/calls/${call.id}/signals`, { kind, payload });
    const addCandidate = async (candidate) => {
      if (!peer.current?.remoteDescription) { pendingCandidates.current.push(candidate); return; }
      await peer.current.addIceCandidate(new RTCIceCandidate(candidate));
    };
    const answerOffer = async (offer, answerKind) => {
      await peer.current.setRemoteDescription(new RTCSessionDescription(offer));
      for (const candidate of pendingCandidates.current.splice(0)) await addCandidate(candidate);
      const answer = await peer.current.createAnswer();
      await peer.current.setLocalDescription(answer);
      await sendSignal(answerKind, peer.current.localDescription.toJSON());
    };
    const receive = async () => {
      try {
        const { data } = await api.get(`/calls/${call.id}/signals`, { params: { after: lastSignal.current } });
        if (data.status === 'rejected' || data.status === 'ended') { close(); onEndedRef.current(); return; }
        for (const signal of data.signals) {
          lastSignal.current = Math.max(lastSignal.current, signal.id);
          if (signal.kind === 'candidate') await addCandidate(signal.payload);
          else if (signal.kind === 'offer' && call.role === 'callee') await answerOffer(signal.payload, 'answer');
          else if (signal.kind === 'answer' && call.role === 'caller') {
            await peer.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
            for (const candidate of pendingCandidates.current.splice(0)) await addCandidate(candidate);
          } else if (signal.kind === 'renegotiate-offer') await answerOffer(signal.payload, 'renegotiate-answer');
          else if (signal.kind === 'renegotiate-answer') {
            await peer.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
            for (const candidate of pendingCandidates.current.splice(0)) await addCandidate(candidate);
          }
        }
      } catch (requestError) { if (!stopped) setError(requestError.message); }
    };
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error('Этот браузер не поддерживает звонки');
        const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.type === 'video' });
        if (stopped) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (localVideo.current) localVideo.current.srcObject = media;
        const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peer.current = connection;
        media.getTracks().forEach((track) => connection.addTrack(track, media));
        connection.onicecandidate = ({ candidate }) => { if (candidate) sendSignal('candidate', candidate.toJSON()).catch(() => {}); };
        connection.ontrack = ({ streams }) => { if (remoteVideo.current && streams[0]) remoteVideo.current.srcObject = streams[0]; };
        connection.onconnectionstatechange = () => {
          if (connection.connectionState === 'connected') setStatus('Соединение защищено');
          if (connection.connectionState === 'failed') setError('Не удалось установить соединение');
        };
        if (call.role === 'caller') {
          const offer = await connection.createOffer(); await connection.setLocalDescription(offer);
          await sendSignal('offer', connection.localDescription.toJSON());
        }
        timer = window.setInterval(receive, 1000); receive();
      } catch (requestError) {
        setError(requestError.name === 'NotAllowedError' ? 'Разрешите доступ к микрофону и камере в настройках браузера' : requestError.message);
      }
    };
    start();
    return () => { stopped = true; window.clearInterval(timer); close(); };
  }, [call.id, call.role, call.type]);

  const renegotiate = async () => {
    const connection = peer.current;
    if (!connection || connection.signalingState !== 'stable') return;
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await api.post(`/calls/${call.id}/signals`, { kind: 'renegotiate-offer', payload: connection.localDescription.toJSON() });
  };

  const stopSharing = async () => {
    const shared = displayStream.current;
    if (!shared) return;
    const sender = peer.current?.getSenders().find((item) => item.track?.kind === 'video');
    const cameraTrack = stream.current?.getVideoTracks()[0] || null;
    shared.getTracks().forEach((track) => track.stop());
    displayStream.current = null;
    if (sender && cameraTrack) await sender.replaceTrack(cameraTrack);
    else if (sender) {
      peer.current?.removeTrack(sender);
      await renegotiate();
    }
    setSharing(false);
    if (localVideo.current) localVideo.current.srcObject = stream.current;
  };

  const toggleSharing = async () => {
    if (sharing) { await stopSharing(); return; }
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Демонстрация экрана не поддерживается этим браузером');
      if (!peer.current || peer.current.connectionState !== 'connected') throw new Error('Дождитесь соединения с собеседником');
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      const sender = peer.current.getSenders().find((item) => item.track?.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
      else { peer.current.addTrack(screenTrack, display); await renegotiate(); }
      displayStream.current = display;
      if (localVideo.current) localVideo.current.srcObject = display;
      screenTrack.onended = () => { stopSharing().catch(() => {}); };
      setSharing(true); setError('');
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setError(shareError.name === 'NotAllowedError' ? 'Вы не разрешили демонстрацию экрана' : shareError.message);
    }
  };

  const end = async () => { try { await api.post(`/calls/${call.id}/end`); } catch {} onEnded(); };
  const toggleMute = () => { const next = !muted; stream.current?.getAudioTracks().forEach((track) => { track.enabled = !next; }); setMuted(next); };
  const toggleCamera = () => { const next = !cameraOff; stream.current?.getVideoTracks().forEach((track) => { track.enabled = !next; }); setCameraOff(next); };
  const video = call.type === 'video';

  return <div className="fixed inset-0 z-50 bg-[#111317]/95 p-3 text-white sm:grid sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Звонок">
    <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-none bg-[#1e2124] shadow-2xl sm:h-[min(44rem,calc(100vh-3rem))] sm:rounded-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#202225] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><div className="relative"><img src={peerAvatar || ''} alt="" className="h-10 w-10 rounded-full bg-[#5865f2] object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#202225] bg-[#43b581]" /></div><div className="min-w-0"><p className="truncate font-semibold">{peerName || 'Собеседник'}</p><p className="truncate text-xs text-[#b9bbbe]">{error || status}</p></div></div>
        <div className="hidden items-center gap-1 text-xs text-[#b9bbbe] sm:flex"><ShieldCheck className="h-4 w-4 text-[#43b581]" /> WebRTC защищён</div>
      </header>
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#111317] p-3 sm:p-5">
        <video ref={remoteVideo} autoPlay playsInline className={`h-full w-full rounded-xl bg-[#0b0c0e] object-contain ${video || sharing ? 'block' : 'hidden'}`} />
        {!video && !sharing && <div className="flex flex-col items-center gap-4 text-center"><img src={peerAvatar || ''} alt="" className="h-28 w-28 rounded-full bg-[#5865f2] object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><p className="text-2xl font-semibold">{peerName || 'Собеседник'}</p><p className="text-sm text-[#b9bbbe]">Аудиозвонок</p></div>}
        <div className="absolute bottom-6 right-6 overflow-hidden rounded-lg border-2 border-[#202225] bg-black shadow-xl"><video ref={localVideo} autoPlay muted playsInline className="h-24 w-32 object-cover sm:h-32 sm:w-44" /><span className="absolute bottom-1 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px]">{sharing ? 'Вы показываете экран' : 'Вы'}</span></div>
      </main>
      <footer className="flex shrink-0 items-center justify-center gap-3 bg-[#202225] p-4 sm:gap-4">
        <button type="button" onClick={toggleMute} className={`grid h-12 w-12 place-items-center rounded-full transition ${muted ? 'bg-[#ed4245] text-white' : 'bg-[#36393f] hover:bg-[#4f545c]'}`} aria-label="Микрофон">{muted ? <MicOff /> : <Mic />}</button>
        {video && <button type="button" onClick={toggleCamera} className={`grid h-12 w-12 place-items-center rounded-full transition ${cameraOff ? 'bg-[#ed4245] text-white' : 'bg-[#36393f] hover:bg-[#4f545c]'}`} aria-label="Камера">{cameraOff ? <VideoOff /> : <Video />}</button>}
        <button type="button" onClick={toggleSharing} className={`grid h-12 w-12 place-items-center rounded-full transition ${sharing ? 'bg-[#5865f2] text-white' : 'bg-[#36393f] hover:bg-[#4f545c]'}`} aria-label="Демонстрация экрана">{sharing ? <ScreenShareOff /> : <ScreenShare />}</button>
        <button type="button" onClick={end} className="grid h-12 w-14 place-items-center rounded-2xl bg-[#ed4245] text-white transition hover:bg-[#c03537]" aria-label="Завершить звонок"><PhoneOff /></button>
      </footer>
    </div>
  </div>;
}
