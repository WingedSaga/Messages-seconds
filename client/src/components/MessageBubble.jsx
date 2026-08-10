import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  Download,
  FileText,
  ImageOff,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatFileSize, formatTime } from '../utils/format';

function Quote({ quoted, authorName }) {
  return (
    <span className="mb-1.5 block border-l-2 border-brand/60 bg-black/[0.04] px-2 py-1 text-[13px]">
      <span className="block font-semibold text-brand-dark">{authorName}</span>
      <span className="block truncate text-muted">
        {quoted.body || (quoted.attachment_type === 'image' ? 'Фотография' : quoted.attachment_name)}
      </span>
    </span>
  );
}

// Признак доставки у своих сообщений: часы — ещё в пути, галочка — на сервере,
// двойная — собеседник дочитал до этого места.
function Status({ message, read }) {
  if (message.failed) return <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="Не отправлено" />;
  if (message.pending) return <Clock className="h-3.5 w-3.5 text-muted" aria-label="Отправляется" />;
  if (read) return <CheckCheck className="h-3.5 w-3.5 text-brand-dark" aria-label="Прочитано" />;
  return <Check className="h-3.5 w-3.5 text-muted" aria-label="Отправлено" />;
}

export default function MessageBubble({
  message,
  mine,
  read,
  authorName,
  quotedAuthorName,
  showAuthor,
  onReply,
  onEdit,
  onDelete,
  onDropFailed,
  onOpenImage,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [brokenImage, setBrokenImage] = useState(false);

  if (message.deleted) {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <p className="rounded-2xl border border-dashed border-line px-3 py-1.5 text-[13px] italic text-muted">
          Сообщение удалено
        </p>
      </div>
    );
  }

  return (
    <div className={`group flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
      <div
        className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-snug shadow-sm sm:max-w-[70%]
          ${mine ? 'bg-mine text-ink' : 'bg-white text-ink'}
          ${message.failed ? 'ring-1 ring-red-300' : ''}`}
      >
        {showAuthor && !mine && (
          <span className="mb-0.5 block text-[13px] font-semibold text-brand-dark">{authorName}</span>
        )}

        {message.quoted && <Quote quoted={message.quoted} authorName={quotedAuthorName} />}

        {message.attachment_type === 'image' && message.attachment_url && !brokenImage && (
          <button
            type="button"
            onClick={() => onOpenImage(message.attachment_url)}
            className="mb-1.5 block overflow-hidden rounded-xl"
          >
            <img
              src={message.attachment_url}
              alt="Вложение"
              loading="lazy"
              onError={() => setBrokenImage(true)}
              className="max-h-72 w-full object-cover"
            />
          </button>
        )}

        {/* Хранилище может не ответить. Значок сломанной картинки выглядит как
            поломка приложения, поэтому вместо него — ссылка на файл. */}
        {message.attachment_type === 'image' && brokenImage && (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noreferrer"
            className="mb-1.5 flex items-center gap-2 rounded-xl bg-black/[0.04] px-2.5 py-2 text-[13px]"
          >
            <ImageOff className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            Фотография не открылась. Показать
          </a>
        )}

        {message.attachment_type === 'file' && message.attachment_url && (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noreferrer"
            className="mb-1.5 flex items-center gap-2 rounded-xl bg-black/[0.04] px-2.5 py-2 hover:bg-black/[0.07]"
          >
            <FileText className="h-5 w-5 shrink-0 text-brand-dark" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{message.attachment_name}</span>
              <span className="block text-[11px] text-muted">
                {formatFileSize(message.attachment_size)}
              </span>
            </span>
            <Download className="ml-auto h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </a>
        )}

        {message.body && <p className="bubble-text">{message.body}</p>}

        <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted">
          {message.edited_at && <span title="Изменено">изм.</span>}
          <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
          {mine && <Status message={message} read={read} />}
        </span>

        {message.failed && (
          <button
            type="button"
            onClick={() => onDropFailed(message.id)}
            className="mt-1 block text-[11px] font-semibold text-red-600 underline"
          >
            Не отправлено. Убрать
          </button>
        )}
      </div>

      {/* Действия: на телефоне открываются нажатием, на большом экране
          проявляются при наведении. */}
      {!message.pending && !message.failed && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Действия с сообщением"
            className="grid h-7 w-7 place-items-center rounded-full text-muted opacity-60
              transition-opacity hover:bg-brand-soft hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div
                role="presentation"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10"
              />
              <div
                className={`absolute bottom-8 z-20 w-40 overflow-hidden rounded-xl border border-line
                  bg-white py-1 shadow-lg ${mine ? 'left-0' : 'right-0'}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onReply(message);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-soft"
                >
                  <CornerUpLeft className="h-4 w-4" aria-hidden="true" /> Ответить
                </button>

                {mine && message.body && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(message);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-soft"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" /> Изменить
                  </button>
                )}

                {mine && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(message);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Удалить
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
