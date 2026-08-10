import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';

export default function NotFound() {
  return (
    <main className="grid min-h-full place-items-center bg-paper px-4 text-center">
      <div>
        <div className="mb-5 flex justify-center">
          <BrandMark />
        </div>
        <p className="font-serif text-2xl font-bold text-ink">Страница не найдена</p>
        <p className="mt-1 text-sm text-muted">Такого раздела в мессенджере нет.</p>
        <Link to="/" className="btn-primary mt-5">
          К чатам
        </Link>
      </div>
    </main>
  );
}
