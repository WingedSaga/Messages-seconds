import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { ErrorNotice } from '../components/Notice';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [email, setEmail] = useState(params.get('email') || '');
  const [manualToken, setManualToken] = useState(token);
  const [status, setStatus] = useState(token ? 'loading' : 'idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => {
        setStatus('done');
        setMessage('Почта подтверждена. Открываем сообщения…');
        setTimeout(() => navigate('/', { replace: true }), 700);
      })
      .catch((err) => {
        setStatus('idle');
        setError(err.message);
      });
  }, [navigate, token, verifyEmail]);

  const submitToken = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('loading');
    try {
      await verifyEmail(manualToken.trim());
      setStatus('done');
      setMessage('Почта подтверждена. Открываем сообщения…');
      setTimeout(() => navigate('/', { replace: true }), 700);
    } catch (err) {
      setStatus('idle');
      setError(err.message);
    }
  };

  const resend = async () => {
    setError('');
    setMessage('');
    try {
      const result = await resendVerification(email.trim());
      setMessage(result.message || 'Письмо отправлено');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="grid min-h-full place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><BrandMark /></div>
        <div className="card space-y-4 p-6">
          <MailCheck className="mx-auto h-10 w-10 text-brand" aria-hidden="true" />
          <h1 className="text-center font-serif text-xl font-bold text-ink">Подтверждение почты</h1>
          <ErrorNotice message={error} />
          {message && <p className="text-center text-sm text-brand-dark">{message}</p>}
          {status === 'loading' && !error ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Проверяем ссылку…</p>
          ) : status !== 'done' ? (
            <form onSubmit={submitToken} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Токен из ссылки</span>
                <input required value={manualToken} onChange={(event) => setManualToken(event.target.value)} className="field" placeholder="Вставьте токен" />
              </label>
              <button type="submit" className="btn-primary w-full">Подтвердить</button>
            </form>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email для повторной отправки</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field" placeholder="you@example.com" />
          </label>
          <button type="button" onClick={resend} disabled={!email.trim()} className="btn-outline w-full">Отправить письмо ещё раз</button>
          <p className="text-center text-sm text-muted"><Link to="/login" className="font-semibold text-brand-dark underline">Вернуться ко входу</Link></p>
        </div>
      </div>
    </main>
  );
}
