import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bell, MessageSquare, Newspaper, Settings, ShieldCheck } from 'lucide-react';

import api from '../api/axios';
import Avatar from '../components/Avatar';
import BrandMark from '../components/BrandMark';
import ChatList from '../components/ChatList';
import ConversationInfo from '../components/ConversationInfo';
import CallOverlay from '../components/CallOverlay';
import ConversationView from '../components/ConversationView';
import NewChatDialog from '../components/NewChatDialog';
import NewGroupDialog from '../components/NewGroupDialog';
import { EmptyNotice, ErrorNotice } from '../components/Notice';
import useConversations from '../hooks/useConversations';
import { useAuth } from '../context/AuthContext';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://news-seconds.duckdns.org';

export default function Messenger() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const { conversations, loading, error, refresh, clearUnread, openDirect, createGroup } =
    useConversations();

  const [dialog, setDialog] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callError, setCallError] = useState('');
  const readSent = useRef(new Map());
  const previousUnread = useRef(0);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const active = useMemo(
    () => conversations.find((item) => item.id === conversationId) || null,
    [conversations, conversationId]
  );

  // Разговор из адреса может оказаться чужим или уже удалённым — тогда
  // возвращаемся к списку, а не показываем пустой экран.
  useEffect(() => {
    if (!conversationId || loading || active) return;
    navigate('/', { replace: true });
  }, [conversationId, loading, active, navigate]);

  const open = useCallback(
    (conversation) => {
      clearUnread(conversation.id);
      navigate(`/chat/${conversation.id}`);
    },
    [clearUnread, navigate]
  );

  // Отметку «прочитано» шлём не чаще раза в несколько секунд на разговор:
  // лента опрашивается постоянно, и без этого каждый опрос стоил бы записи в базу.
  const markRead = useCallback(
    (id) => {
      const last = readSent.current.get(id) || 0;
      if (Date.now() - last < 4000) return;
      readSent.current.set(id, Date.now());

      api
        .post(`/conversations/${id}/read`)
        .then(() => clearUnread(id))
        .catch(() => {});
    },
    [clearUnread]
  );

  const total = conversations.reduce((sum, item) => sum + item.unread, 0);

  useEffect(() => {
    if (activeCall || incomingCall) return undefined;
    let cancelled = false;
    const checkIncoming = async () => {
      try {
        const { data } = await api.get('/calls/incoming');
        if (!cancelled && data.calls?.[0]) setIncomingCall(data.calls[0]);
      } catch {
        // Звонок не должен превращать обычный чат в экран ошибки, повторим на следующем опросе.
      }
    };
    checkIncoming();
    const timer = window.setInterval(checkIncoming, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCall, incomingCall]);

  const startCall = async (conversation, type) => {
    setCallError('');
    try {
      // Запрос возможен только по нажатию пользователя — это правило браузеров.
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        setNotificationPermission(await Notification.requestPermission());
      }
      const { data } = await api.post('/calls', { conversation_id: conversation.id, type });
      setActiveCall({ ...data.call, role: 'caller', peerName: conversation.title, peerAvatar: conversation.avatar_url });
    } catch (err) {
      setCallError(err.message || 'Не удалось начать звонок');
    }
  };

  const acceptCall = async () => {
    const { data } = await api.post(`/calls/${incomingCall.id}/accept`);
    const conversation = conversations.find((item) => item.id === data.call.conversation_id);
    setIncomingCall(null);
    setActiveCall({ ...data.call, role: 'callee', peerName: conversation?.title || 'Собеседник', peerAvatar: conversation?.avatar_url || null });
  };

  const rejectCall = async () => {
    try {
      await api.post(`/calls/${incomingCall.id}/reject`);
    } finally {
      setIncomingCall(null);
    }
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  useEffect(() => {
    const wasUnread = previousUnread.current;
    previousUnread.current = total;

    if (
      notificationPermission !== 'granted' ||
      total <= wasUnread ||
      document.visibilityState === 'visible' ||
      typeof Notification === 'undefined'
    ) {
      return;
    }

    const count = total - wasUnread;
    new Notification('Сообщения секунды', {
      body: count === 1 ? 'Новое непрочитанное сообщение' : `Новых сообщений: ${count}`,
      tag: 'messages-seconds-unread',
    });
  }, [notificationPermission, total]);

  // Число непрочитанных видно во вкладке: мессенджер редко держат на переднем плане.
  useEffect(() => {
    document.title = total ? `(${total}) СООБЩЕНИЯ СЕКУНДЫ` : 'СООБЩЕНИЯ СЕКУНДЫ';
  }, [total]);

  return (
    <div className="flex h-full bg-white">
      {/* На телефоне виден ровно один экран: список или разговор. На большом
          экране — оба сразу. */}
      <aside
        className={`flex w-full shrink-0 flex-col border-r border-line bg-white lg:flex lg:w-[360px]
          ${conversationId ? 'hidden lg:flex' : 'flex'}`}
      >
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          <BrandMark />

          <div className="flex items-center gap-1">
            <a href={SITE_URL} className="icon-btn" title="К новостям">
              <Newspaper className="h-5 w-5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="icon-btn"
              title="Настройки"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </button>
            {user.role === 'admin' && (
              <button type="button" onClick={() => navigate('/admin')} className="icon-btn" title="Админ-панель">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={() => navigate('/profile')} title={user.username}>
              <Avatar name={user.username} src={user.avatar_url} size="sm" />
            </button>
          </div>
        </header>

        {notificationPermission === 'default' && (
          <div className="mx-3 mb-2 rounded-xl border border-brand/20 bg-brand-accent px-3 py-2.5 text-sm text-ink">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1">Включите уведомления о новых сообщениях</span>
              <button type="button" onClick={requestNotifications} className="btn-primary px-3 py-1.5 text-xs">
                Включить
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 pb-2">
            <ErrorNotice message={error} />
          </div>
        )}

        {loading && !conversations.length ? (
          <p className="px-4 py-6 text-sm text-muted">Загружаем чаты…</p>
        ) : (
          <ChatList
            conversations={conversations}
            activeId={conversationId}
            meId={user.id}
            onOpen={open}
            onNewChat={() => setDialog('chat')}
            onNewGroup={() => setDialog('group')}
          />
        )}
      </aside>

      <main className={`min-w-0 flex-1 ${conversationId ? 'block' : 'hidden lg:block'}`}>
        {active ? (
          <ConversationView
            key={active.id}
            conversation={active}
            meId={user.id}
            onBack={() => navigate('/')}
            onOpenInfo={() => setDialog('info')}
            onRead={markRead}
            onStartCall={startCall}
          />
        ) : (
          <div className="h-full bg-paper">
            <EmptyNotice
              icon={MessageSquare}
              title="Выберите чат"
              hint="Слева — ваши разговоры. Зелёная кнопка открывает новый чат."
            />
          </div>
        )}
      </main>

      {dialog === 'chat' && (
        <NewChatDialog
          meId={user.id}
          onClose={() => setDialog(null)}
          onOpenDirect={async (userId) => {
            const conversation = await openDirect(userId);
            navigate(`/chat/${conversation.id}`);
          }}
        />
      )}

      {dialog === 'group' && (
        <NewGroupDialog
          meId={user.id}
          onClose={() => setDialog(null)}
          onCreate={async (title, memberIds) => {
            const conversation = await createGroup(title, memberIds);
            navigate(`/chat/${conversation.id}`);
          }}
        />
      )}

      {dialog === 'info' && active && (
        <ConversationInfo
          conversation={active}
          meId={user.id}
          onClose={() => setDialog(null)}
          onChanged={refresh}
          onLeft={() => {
            refresh();
            navigate('/');
          }}
        />
      )}

      {incomingCall && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label="Входящий звонок">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-sm text-muted">Входящий {incomingCall.type === 'video' ? 'видеозвонок' : 'аудиозвонок'}</p>
            <p className="mt-2 text-xl font-bold text-ink">{conversations.find((item) => item.id === incomingCall.conversation_id)?.title || 'Собеседник'}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={rejectCall} className="btn-danger">Отклонить</button>
              <button type="button" onClick={acceptCall} className="btn-primary">Принять</button>
            </div>
          </div>
        </div>
      )}

      {callError && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md">
          <ErrorNotice message={callError} />
        </div>
      )}

      {activeCall && <CallOverlay call={activeCall} peerName={activeCall.peerName} peerAvatar={activeCall.peerAvatar} onEnded={() => setActiveCall(null)} />}
    </div>
  );
}
