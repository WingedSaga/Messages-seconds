import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { ErrorNotice } from '../components/Notice';
import { useAuth } from '../context/AuthContext';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://news-seconds.duckdns.org';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await login(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-full place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="font-serif text-xl font-bold text-ink">Вход</h1>

          <ErrorNotice message={error} />

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Почта</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="field"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Пароль</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="field"
            />
          </label>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Войти
          </button>

          {/* Аккаунт общий с сайтом — об этом стоит сказать прямо, иначе
              человек заводит второй и не находит своих собеседников. */}
          <p className="text-center text-sm text-muted">
            Подходит аккаунт сайта{' '}
            <a href={SITE_URL} className="font-semibold text-brand-dark underline">
              НОВОСТИ СЕКУНДЫ
            </a>
          </p>

          <p className="text-center text-sm text-muted">
            Нет аккаунта?{' '}
            <Link to="/register" className="font-semibold text-brand-dark underline">
              Зарегистрироваться
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
