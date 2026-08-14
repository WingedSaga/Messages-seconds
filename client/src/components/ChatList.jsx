import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquarePlus, Search, Users, X } from 'lucide-react';
import Avatar from './Avatar';
import { EmptyNotice } from './Notice';
import { formatListStamp, formatUnread } from '../utils/format';

// Строка списка. Подпись собирается из последнего сообщения: в группе перед
// текстом нужен автор, иначе непонятно, кто написал.
function ChatRow({ conversation, active, meId, onOpen }) {
  const mine = conversation.last_message_sender_id === meId;
  const author = conversation.members.find((m) => m.id === conversation.last_message_sender_id);

  let preview = conversation.last_message_preview || 'Пока ни одного сообщения';
  if (conversation.last_message_preview) {
    if (mine) preview = `Вы: ${preview}`;
    else if (conversation.kind === 'group' && author) preview = `${author.username}: ${preview}`;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(conversation)}
      aria-current={active ? 'true' : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all
        ${active ? 'bg-brand-soft shadow-sm ring-1 ring-brand/10' : 'hover:translate-x-0.5 hover:bg-brand-soft/60'}`}
    >
      {active && <span className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-brand" aria-hidden="true" />}
      <Avatar
        name={conversation.title}
        src={conversation.avatar_url}
        online={conversation.companion?.online}
        group={conversation.kind === 'group'}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-ink">{conversation.title}</span>
          <span className="shrink-0 text-[11px] text-muted">
            {formatListStamp(conversation.last_message_at)}
          </span>
        </span>

        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-muted">{preview}</span>
          {conversation.unread > 0 && (
            <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
              {formatUnread(conversation.unread)}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export default function ChatList({ conversations, activeId, meId, onOpen, onNewChat, onNewGroup }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const searchInput = useRef(null);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((conversation) =>
      (!needle || conversation.title.toLowerCase().includes(needle)) &&
      (filter === 'all' || conversation.unread > 0)
    );
  }, [conversations, query, filter]);

  const unreadTotal = conversations.reduce((sum, conversation) => sum + conversation.unread, 0);

  return (
    <>
      <div className="flex items-center gap-2 px-3 pb-2">
        <label className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по чатам"
            aria-label="Поиск по чатам"
            className="field bg-paper pl-9 pr-9"
          />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-white" aria-label="Очистить поиск"><X className="h-4 w-4" /></button>}
        </label>

        <button type="button" onClick={onNewChat} className="icon-btn bg-brand text-white hover:bg-brand-hover" title="Новый чат">
          <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onNewGroup} className="icon-btn" title="Новая группа">
          <Users className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 pb-3">
        <button type="button" onClick={() => setFilter('all')} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === 'all' ? 'bg-ink text-white' : 'bg-paper text-muted hover:bg-brand-soft'}`}>Все чаты</button>
        <button type="button" onClick={() => setFilter('unread')} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === 'unread' ? 'bg-brand text-white' : 'bg-paper text-muted hover:bg-brand-soft'}`}>Непрочитанные{unreadTotal ? ` · ${formatUnread(unreadTotal)}` : ''}</button>
        <span className="ml-auto text-[11px] text-muted">Ctrl K</span>
      </div>

      <div className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 ? (
          <EmptyNotice
            title={conversations.length ? 'Ничего не найдено' : 'Здесь пока пусто'}
            hint={
              conversations.length
                ? 'Попробуйте другое имя'
                : 'Нажмите на зелёную кнопку и найдите собеседника по имени'
            }
          />
        ) : (
          filtered.map((conversation) => (
            <ChatRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              meId={meId}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </>
  );
}
