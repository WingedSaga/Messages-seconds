import { useEffect } from 'react';
import { X } from 'lucide-react';

// Общее окно поверх приложения. Закрывается щелчком по подложке и клавишей
// Escape — на телефоне промах мимо карточки случается постоянно.
export default function Modal({ title, onClose, children, footer }) {
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
      className="fixed inset-0 z-40 grid place-items-end bg-ink/30 p-0 sm:place-items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="animate-fade-in flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl
          bg-white shadow-xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-serif text-lg font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Закрыть">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
