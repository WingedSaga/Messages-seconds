import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Newspaper, Settings } from 'lucide-react';

import api from '../api/axios';
import Avatar from '../components/Avatar';
import BrandMark from '../components/BrandMark';
import ChatList from '../components/ChatList';
import ConversationInfo from '../components/ConversationInfo';
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
  const readSent = useRef(new Map());

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
            <button type="button" onClick={() => navigate('/profile')} title={user.username}>
              <Avatar name={user.username} src={user.avatar_url} size="sm" />
            </button>
          </div>
        </header>

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
    </div>
  );
}
