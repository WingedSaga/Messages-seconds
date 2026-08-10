import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import usePolling from './usePolling';

const POLL_INTERVAL_MS = 2500;
const PAGE_SIZE = 40;

// Сливает пришедшее с уже показанным. Опрос и ответ на отправку могут принести
// одно и то же сообщение — в ленте оно должно остаться одним.
function merge(current, incoming) {
  if (!incoming.length) return current;

  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);

  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default function useMessages(conversationId, meId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [readers, setReaders] = useState([]);
  const [typing, setTyping] = useState([]);

  // Отметка последнего известного сообщения: с неё продолжается опрос.
  const cursor = useRef(null);
  const inFlight = useRef(false);

  useEffect(() => {
    cursor.current = null;
    setMessages([]);
    setReaders([]);
    setTyping([]);
    setHasMore(false);
    setError('');
    setLoading(Boolean(conversationId));
  }, [conversationId]);

  const poll = useCallback(async () => {
    if (!conversationId || inFlight.current) return;
    inFlight.current = true;

    try {
      const params = cursor.current
        ? { after: cursor.current }
        : { limit: PAGE_SIZE };

      const { data } = await api.get(`/conversations/${conversationId}/messages`, { params });

      // Первая загрузка задаёт и признак «есть история выше».
      if (!cursor.current) setHasMore(data.has_more);

      if (data.messages.length) {
        cursor.current = data.messages[data.messages.length - 1].created_at;
        setMessages((current) => merge(current, data.messages));
      }

      setReaders(data.readers || []);
      setTyping(data.typing || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [conversationId]);

  usePolling(poll, { interval: POLL_INTERVAL_MS, enabled: Boolean(conversationId) });

  const loadOlder = useCallback(async () => {
    if (!conversationId || !messages.length || loadingOlder) return;
    setLoadingOlder(true);

    try {
      const { data } = await api.get(`/conversations/${conversationId}/messages`, {
        params: { before: messages[0].created_at, limit: PAGE_SIZE },
      });
      setHasMore(data.has_more);
      setMessages((current) => merge(current, data.messages));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, messages, loadingOlder]);

  const send = useCallback(
    async ({ body, attachment, replyTo }) => {
      // Своё сообщение появляется в ленте сразу: ждать ответа сервера, глядя
      // на пустое поле, — самое заметное «подтормаживание» в переписке.
      const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const draft = {
        id: draftId,
        conversation_id: conversationId,
        sender_id: meId,
        body,
        attachment_url: attachment?.url || null,
        attachment_type: attachment?.type || null,
        attachment_name: attachment?.name || null,
        attachment_size: attachment?.size || null,
        reply_to: replyTo?.id || null,
        quoted: replyTo || null,
        created_at: new Date().toISOString(),
        pending: true,
      };

      setMessages((current) => [...current, draft]);

      try {
        const { data } = await api.post(`/conversations/${conversationId}/messages`, {
          body,
          attachment_url: attachment?.url,
          attachment_type: attachment?.type,
          attachment_name: attachment?.name,
          attachment_size: attachment?.size,
          reply_to: replyTo?.id,
        });

        // Курсор двигаем сразу: иначе ближайший опрос принесёт своё же
        // сообщение и оно на мгновение задвоится.
        cursor.current = data.message.created_at;
        setMessages((current) => merge(current.filter((m) => m.id !== draftId), [data.message]));
        return data.message;
      } catch (err) {
        // Неотправленное остаётся в ленте с пометкой: молча пропавший текст,
        // который человек уже набрал, — худшее, что может сделать мессенджер.
        setMessages((current) =>
          current.map((m) => (m.id === draftId ? { ...m, pending: false, failed: true } : m))
        );
        throw err;
      }
    },
    [conversationId, meId]
  );

  const edit = useCallback(async (messageId, body) => {
    const { data } = await api.patch(`/messages/${messageId}`, { body });
    setMessages((current) => merge(current, [data.message]));
  }, []);

  const remove = useCallback(async (messageId) => {
    await api.delete(`/messages/${messageId}`);
    setMessages((current) =>
      current.map((m) =>
        m.id === messageId
          ? { ...m, deleted: true, body: '', attachment_url: null, quoted: null }
          : m
      )
    );
  }, []);

  // Черновик, который не ушёл, убирается из ленты вручную.
  const dropFailed = useCallback((messageId) => {
    setMessages((current) => current.filter((m) => m.id !== messageId));
  }, []);

  return {
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
    refresh: poll,
  };
}
