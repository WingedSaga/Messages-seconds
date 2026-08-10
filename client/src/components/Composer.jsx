import { useEffect, useRef, useState } from 'react';
import { CornerUpLeft, Loader2, Paperclip, Send, X } from 'lucide-react';
import api from '../api/axios';
import { ErrorNotice } from './Notice';
import { formatFileSize } from '../utils/format';

// Не чаще одного сигнала «печатает» в три секунды: на сервере отметка живёт
// шесть, так что подпись у собеседника не мигает, а запросов вдвое меньше.
const TYPING_PING_MS = 3000;
const MAX_LENGTH = 4000;

export default function Composer({ conversationId, replyTo, onCancelReply, editing, onCancelEdit, onSend, onEdit }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fileInput = useRef(null);
  const textarea = useRef(null);
  const lastPing = useRef(0);

  // Правка подставляет текст в то же поле: отдельная форма посреди переписки
  // сбивает с толку сильнее, чем подпись над полем.
  useEffect(() => {
    if (editing) {
      setText(editing.body);
      textarea.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    setText('');
    setAttachment(null);
    setError('');
  }, [conversationId]);

  // Поле растёт под текст до нескольких строк и дальше прокручивается само.
  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
  }, [text]);

  const pingTyping = () => {
    if (editing || Date.now() - lastPing.current < TYPING_PING_MS) return;
    lastPing.current = Date.now();
    api.post(`/conversations/${conversationId}/typing`).catch(() => {});
  };

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/upload', form);
      setAttachment(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const body = text.trim();
    if ((!body && !attachment) || sending) return;

    setSending(true);
    setError('');

    try {
      if (editing) {
        await onEdit(editing.id, body);
        onCancelEdit();
      } else {
        await onSend({ body, attachment, replyTo });
        onCancelReply();
      }
      setText('');
      setAttachment(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Enter отправляет, Shift+Enter переносит строку. На телефоне перенос
  // остаётся кнопкой клавиатуры: там события Shift нет.
  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(event);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-line bg-white px-3 py-2.5 sm:px-5">
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm">
          <CornerUpLeft className="h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
              {editing ? 'Изменение сообщения' : 'Ответ'}
            </span>
            <span className="block truncate text-muted">
              {(editing || replyTo).body || 'Вложение'}
            </span>
          </span>
          <button
            type="button"
            onClick={editing ? onCancelEdit : onCancelReply}
            className="icon-btn h-8 w-8"
            aria-label="Отменить"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
          {attachment.type === 'image' ? (
            <img src={attachment.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <Paperclip className="h-5 w-5 text-brand-dark" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{attachment.name}</span>
            <span className="block text-[11px] text-muted">{formatFileSize(attachment.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="icon-btn h-8 w-8"
            aria-label="Убрать вложение"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-2">
          <ErrorNotice message={error} />
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileInput}
          type="file"
          onChange={pickFile}
          accept="image/*,application/pdf,text/plain,audio/mpeg,video/mp4"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading || Boolean(editing)}
          className="icon-btn"
          title="Прикрепить файл"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        <textarea
          ref={textarea}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(event) => {
            setText(event.target.value);
            pingTyping();
          }}
          onKeyDown={onKeyDown}
          placeholder="Сообщение"
          aria-label="Текст сообщения"
          className="field max-h-36 flex-1 resize-none bg-paper py-2.5"
        />

        <button
          type="submit"
          disabled={sending || (!text.trim() && !attachment)}
          className="icon-btn bg-brand text-white hover:bg-brand-hover disabled:bg-brand/40"
          title={editing ? 'Сохранить' : 'Отправить'}
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </form>
  );
}
