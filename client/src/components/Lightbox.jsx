import { useEffect } from 'react';
import { X } from 'lucide-react';

// Картинка на весь экран. Тот же приём, что на сайте: снимок в переписке
// почти всегда хотят рассмотреть, а не разглядывать внутри пузыря.
export default function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-4"
    >
      <button type="button" onClick={onClose} className="absolute right-4 top-4 icon-btn text-white" aria-label="Закрыть">
        <X className="h-6 w-6" aria-hidden="true" />
      </button>
      <img
        src={src}
        alt="Вложение"
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-xl object-contain"
      />
    </div>
  );
}
