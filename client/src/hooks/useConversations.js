import { useCallback, useRef, useState } from 'react';
import api from '../api/axios';
import usePolling from './usePolling';

const LIST_INTERVAL_MS = 5000;

// Список чатов: живёт отдельно от открытого разговора, потому что нужен
// и когда разговор не выбран, и когда выбран другой.
export default function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    // Медленный ответ не должен накладываться на следующий опрос.
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const { data } = await api.get('/conversations');
      setConversations(data.conversations);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  usePolling(refresh, { interval: LIST_INTERVAL_MS });

  // Счётчик гасится сразу при открытии чата: ждать следующего опроса, глядя
  // на непрочитанные в уже открытой переписке, странно.
  const clearUnread = useCallback((conversationId) => {
    setConversations((list) =>
      list.map((item) => (item.id === conversationId ? { ...item, unread: 0 } : item))
    );
  }, []);

  const openDirect = useCallback(
    async (userId) => {
      const { data } = await api.post('/conversations/direct', { user_id: userId });
      await refresh();
      return data.conversation;
    },
    [refresh]
  );

  const createGroup = useCallback(
    async (title, memberIds) => {
      const { data } = await api.post('/conversations/group', {
        title,
        member_ids: memberIds,
      });
      await refresh();
      return data.conversation;
    },
    [refresh]
  );

  return { conversations, loading, error, refresh, clearUnread, openDirect, createGroup };
}
