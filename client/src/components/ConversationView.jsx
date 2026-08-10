import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronUp, Info, Loader2, MessageSquare } from 'lucide-react';

import Avatar from './Avatar';
import Composer from './Composer';
import Lightbox from './Lightbox';
import MessageBubble from './MessageBubble';
import { EmptyNotice, ErrorNotice } from './Notice';
import useMessages from '../hooks/useMessages';
import { formatDayLabel, plural } from '../utils/format';

// Насколько далеко от низа человек ещё считается «читающим последнее».
// Если он ушёл выше — новое сообщение не должно дёргать ленту.
const STICK_TO_BOTTOM_PX = 120;

function DayDivider({ value }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted shadow-sm">
        {formatDayLabel(value)}
      </span>
    </div>
  );
}

function TypingLine({ names }) {
  if (!names.length) return null;

  const who = names.length === 1 ? `${names[0]} печатает` : `${names.join(', ')} печатают`;

  return (
    <p className="flex items-center gap-1.5 px-1 py-1 text-[13px] text-muted">
      <span className="flex gap-0.5" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-brand" />
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-brand [animation-delay:0.2s]" />
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-brand [animation-delay:0.4s]" />
      </span>
      {who}
    </p>
  );
}

export default function ConversationView({ conversation, meId, onBack, onOpenInfo, onRead }) {
  const {
    messages,
    loading,
    error,
    hasMore,
    loadingOlder,
    readers,
    typing,
    loadOlder,
    send,
    edit,
    remove,
    dropFailed,
  } = useMessages(conversation.id, meId);

  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const scroller = useRef(null);
  const stick = useRef(true);
  const lastCount = useRef(0);

  const nameOf = useCallback(
    (userId) => {
      if (userId === meId) return 'Вы';
      return conversation.members.find((m) => m.id === userId)?.username || 'Аккаунт удалён';
    },
    [conversation.members, meId]
  );

  // «Прочитано» у своих сообщений: до какого момента дочитал кто-то ещё.
  const readUpTo = useMemo(() => {
    const others = readers.filter((reader) => reader.user_id !== meId);
    if (!others.length) return null;
    return others.map((reader) => reader.last_read_at).sort().at(-1);
  }, [readers, meId]);

  const typingNames = useMemo(
    () => typing.map((userId) => nameOf(userId)).filter((name) => name !== 'Вы'),
    [typing, nameOf]
  );

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_TO_BOTTOM_PX;
  };

  // Вниз прокручиваем только когда человек и так внизу: иначе чтение старой
  // переписки прерывалось бы на каждом новом сообщении.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;

    const grew = messages.length > lastCount.current;
    lastCount.current = messages.length;

    if (grew && stick.current) node.scrollTop = node.scrollHeight;
  }, [messages]);

  // Открытый разговор считается прочитанным. Отметка уходит на сервер при
  // появлении новых сообщений и при возвращении к вкладке.
  useEffect(() => {
    if (!messages.length || document.hidden) return;
    onRead(conversation.id);
  }, [messages.length, conversation.id, onRead]);

  const grouped = useMemo(() => {
    const rows = [];
    let previousDay = '';
    let previousSender = '';

    for (const message of messages) {
      const day = new Date(message.created_at).toDateString();
      if (day !== previousDay) {
        rows.push({ type: 'day', key: `day-${day}`, value: message.created_at });
        previousDay = day;
        previousSender = '';
      }

      rows.push({
        type: 'message',
        key: message.id,
        message,
        // Имя автора в группе печатается один раз на серию подряд идущих реплик.
        showAuthor: conversation.kind === 'group' && message.sender_id !== previousSender,
      });
      previousSender = message.sender_id;
    }

    return rows;
  }, [messages, conversation.kind]);

  const subtitle =
    conversation.kind === 'group'
      ? plural(conversation.members.length, 'участник', 'участника', 'участников')
      : conversation.companion?.online
        ? 'в сети'
        : 'не в сети';

  return (
    <section className="flex h-full min-w-0 flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-line bg-white px-3 py-2.5 sm:px-5">
        <button type="button" onClick={onBack} className="icon-btn lg:hidden" aria-label="К списку чатов">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onOpenInfo}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar
            name={conversation.title}
            src={conversation.avatar_url}
            online={conversation.companion?.online}
            group={conversation.kind === 'group'}
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{conversation.title}</span>
            <span className="block truncate text-[12px] text-muted">{subtitle}</span>
          </span>
        </button>

        <button type="button" onClick={onOpenInfo} className="icon-btn" aria-label="Сведения о разговоре">
          <Info className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="chat-canvas scroll-thin flex-1 overflow-y-auto px-3 py-3 sm:px-6"
      >
        {hasMore && (
          <div className="mb-2 flex justify-center">
            <button type="button" onClick={loadOlder} disabled={loadingOlder} className="btn-ghost text-xs">
              {loadingOlder ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              )}
              Показать раньше
            </button>
          </div>
        )}

        {loading && !messages.length && (
          <p className="py-6 text-center text-sm text-muted">Загружаем переписку…</p>
        )}

        {!loading && !messages.length && (
          <EmptyNotice
            icon={MessageSquare}
            title="Сообщений пока нет"
            hint="Напишите первым — собеседник увидит сообщение через секунду"
          />
        )}

        <div className="space-y-1.5">
          {grouped.map((row) =>
            row.type === 'day' ? (
              <DayDivider key={row.key} value={row.value} />
            ) : (
              <MessageBubble
                key={row.key}
                message={row.message}
                mine={row.message.sender_id === meId}
                read={Boolean(readUpTo && row.message.created_at <= readUpTo)}
                authorName={nameOf(row.message.sender_id)}
                quotedAuthorName={nameOf(row.message.quoted?.sender_id)}
                showAuthor={row.showAuthor}
                onReply={setReplyTo}
                onEdit={setEditing}
                onDelete={(message) => remove(message.id)}
                onDropFailed={dropFailed}
                onOpenImage={setLightbox}
              />
            )
          )}
        </div>

        <TypingLine names={typingNames} />
      </div>

      {error && (
        <div className="px-3 pt-2 sm:px-5">
          <ErrorNotice message={error} />
        </div>
      )}

      <Composer
        conversationId={conversation.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSend={send}
        onEdit={edit}
      />

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}
