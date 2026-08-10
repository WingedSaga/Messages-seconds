import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { ErrorNotice } from '../components/Notice';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await register(form);
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
          <h1 className="font-serif text-xl font-bold text-ink">Регистрация</h1>

          <ErrorNotice message={error} />

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Имя</span>
            <input
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              className="field"
            />
            {/* По этому имени вас находят в поиске собеседников. */}
            <span className="mt-1 block text-xs text-muted">
              По имени вас найдут другие. Буквы, цифры, дефис и подчёркивание.
            </span>
          </label>

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
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="field"
            />
          </label>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Создать аккаунт
          </button>

          <p className="text-center text-sm text-muted">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="font-semibold text-brand-dark underline">
              Войти
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
