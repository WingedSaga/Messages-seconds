import { AlertCircle, Inbox } from 'lucide-react';

// Сообщение об ошибке. Текст всегда приходит с сервера уже по-русски.
export function ErrorNotice({ message }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

// Пустое состояние: пустой экран без объяснения выглядит как поломка.
export function EmptyNotice({ icon: Icon = Inbox, title, hint }) {
  return (
    <div className="grid h-full place-items-center px-6 py-10 text-center">
      <div>
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="font-serif text-lg font-bold text-ink">{title}</p>
        {hint && <p className="mt-1 max-w-xs text-sm text-muted">{hint}</p>}
      </div>
    </div>
  );
}
