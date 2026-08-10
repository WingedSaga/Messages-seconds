import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImageUp, Loader2, LogOut } from 'lucide-react';

import api from '../api/axios';
import Avatar from '../components/Avatar';
import { ErrorNotice } from '../components/Notice';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState(user.username);
  const [passwords, setPasswords] = useState({ current_password: '', password: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef(null);

  const run = async (action, done) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await action();
      setNotice(done);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveName = () =>
    run(async () => {
      const { data } = await api.patch('/auth/profile', { username: username.trim() });
      setUser(data.user);
    }, 'Имя сохранено');

  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    run(async () => {
      const form = new FormData();
      form.append('file', file);
      const { data: uploaded } = await api.post('/upload', form);
      const { data } = await api.patch('/auth/profile', { avatar_url: uploaded.url });
      setUser(data.user);
    }, 'Фотография обновлена');
  };

  const changePassword = () =>
    run(async () => {
      await api.patch('/auth/password', passwords);
      setPasswords({ current_password: '', password: '' });
    }, 'Пароль изменён');

  return (
    <main className="mx-auto h-full max-w-lg overflow-y-auto bg-paper px-4 py-6">
      <button type="button" onClick={() => navigate('/')} className="btn-ghost mb-4 px-2">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> К чатам
      </button>

      <h1 className="mb-4 font-serif text-2xl font-bold text-ink">Ваш профиль</h1>

      {notice && (
        <p className="mb-3 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand-dark">{notice}</p>
      )}
      <div className="mb-3">
        <ErrorNotice message={error} />
      </div>

      <section className="card mb-4 space-y-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.username} src={user.avatar_url} size="lg" />
          <div>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={busy}
              className="btn-outline"
            >
              <ImageUp className="h-4 w-4" aria-hidden="true" /> Сменить фото
            </button>
            {/* Профиль общий с сайтом: смена имени и фото видна и там. */}
            <p className="mt-1 text-xs text-muted">Имя и фото те же, что на сайте новостей.</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Имя</span>
          <div className="flex gap-2">
            <input
              value={username}
              maxLength={30}
              onChange={(event) => setUsername(event.target.value)}
              className="field"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={busy || username.trim() === user.username}
              className="btn-primary"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Сохранить'}
            </button>
          </div>
        </label>

        <p className="text-sm text-muted">Почта: {user.email}</p>
      </section>

      <section className="card mb-4 space-y-3 p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Смена пароля</h2>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Текущий пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passwords.current_password}
            onChange={(event) =>
              setPasswords({ ...passwords, current_password: event.target.value })
            }
            className="field"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Новый пароль</span>
          <input
            type="password"
            autoComplete="new-password"
            value={passwords.password}
            onChange={(event) => setPasswords({ ...passwords, password: event.target.value })}
            className="field"
          />
        </label>

        <button
          type="button"
          onClick={changePassword}
          disabled={busy || !passwords.current_password || passwords.password.length < 6}
          className="btn-primary w-full"
        >
          Изменить пароль
        </button>
      </section>

      <button
        type="button"
        onClick={() => {
          logout();
          navigate('/login', { replace: true });
        }}
        className="btn w-full border border-red-300 text-red-700 hover:bg-red-600 hover:text-white"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" /> Выйти
      </button>
    </main>
  );
}
