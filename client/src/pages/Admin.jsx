import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, Loader2, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Avatar from '../components/Avatar';
import { ErrorNotice } from '../components/Notice';

const tiles = [
  ['users', 'Пользователи'],
  ['conversations', 'Чаты'],
  ['messages', 'Сообщения'],
  ['banned', 'Заблокированы'],
];

export default function Admin() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    try {
      setError('');
      const response = await api.get('/admin/overview');
      setData(response.data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleBan = async (user) => {
    setBusyId(user.id);
    try {
      const { data: result } = await api.patch(`/admin/users/${user.id}/ban`, { is_banned: !user.is_banned });
      setData((current) => ({
        ...current,
        stats: { ...current.stats, banned: current.stats.banned + (result.user.is_banned ? 1 : -1) },
        users: current.users.map((item) => (item.id === user.id ? result.user : item)),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <main className="mx-auto h-full max-w-3xl overflow-y-auto bg-paper px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/')} className="btn-ghost px-2">
          <ArrowLeft className="h-4 w-4" /> К чатам
        </button>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-dark">
          <ShieldCheck className="h-4 w-4" /> Админ-панель
        </span>
      </div>

      <h1 className="text-2xl font-bold text-ink">Управление мессенджером</h1>
      <p className="mt-1 text-sm text-muted">Статистика и последние зарегистрированные пользователи.</p>
      <div className="my-4"><ErrorNotice message={error} /></div>

      {!data ? (
        <div className="grid place-items-center py-16 text-muted"><Loader2 className="h-7 w-7 animate-spin" /></div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map(([key, label]) => (
              <div key={key} className="card p-4">
                <p className="text-2xl font-bold text-ink">{data.stats[key]}</p>
                <p className="mt-1 text-xs font-medium text-muted">{label}</p>
              </div>
            ))}
          </section>

          <section className="card mt-5 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Users className="h-5 w-5 text-brand" />
              <h2 className="font-semibold text-ink">Пользователи</h2>
            </div>
            <ul className="divide-y divide-line">
              {data.users.map((user) => (
                <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={user.username} src={user.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{user.username}</span>
                    <span className="block truncate text-xs text-muted">{user.email}</span>
                  </span>
                  <span className={`hidden rounded-full px-2 py-1 text-xs font-semibold sm:inline ${user.is_banned ? 'bg-red-50 text-red-700' : 'bg-brand-soft text-brand-dark'}`}>
                    {user.is_banned ? 'Заблокирован' : 'Активен'}
                  </span>
                  <button type="button" disabled={busyId === user.id} onClick={() => toggleBan(user)} className={user.is_banned ? 'btn-outline px-3 py-2 text-xs' : 'btn border border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50'}>
                    {busyId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    {user.is_banned ? 'Вернуть' : 'Блок.'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
