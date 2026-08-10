import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import api from '../api/axios';
import Avatar from './Avatar';
import { ErrorNotice } from './Notice';

// Пауза перед запросом: набор имени идёт по букве, а поиск по базе — нет.
const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

export default function UserSearch({ excludeIds = [], selectedIds = [], onPick, hint }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < MIN_QUERY) {
      setUsers([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      api
        .get('/users', { params: { q: needle } })
        .then(({ data }) => {
          if (cancelled) return;
          setUsers(data.users.filter((user) => !excludeIds.includes(user.id)));
          setError('');
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Список исключений задаётся вызывающим кодом и не должен перезапускать поиск.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Имя пользователя"
          aria-label="Поиск человека"
          className="field pl-9"
        />
      </label>

      <ErrorNotice message={error} />

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Ищем
        </p>
      )}

      {!loading && query.trim().length >= MIN_QUERY && !users.length && (
        <p className="text-sm text-muted">Никого не нашли. Проверьте имя.</p>
      )}

      {query.trim().length < MIN_QUERY && hint && <p className="text-sm text-muted">{hint}</p>}

      <ul className="space-y-1">
        {users.map((user) => {
          const chosen = selectedIds.includes(user.id);
          return (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => onPick(user)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors
                  ${chosen ? 'bg-brand-soft' : 'hover:bg-brand-soft/60'}`}
              >
                <Avatar name={user.username} src={user.avatar_url} size="sm" online={user.online} />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{user.username}</span>
                {chosen && <span className="text-xs font-semibold text-brand-dark">выбран</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
