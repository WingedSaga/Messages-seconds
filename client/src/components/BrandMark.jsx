import { MessageSquare } from 'lucide-react';

// Название приложения. Набирается антиквой — так же, как заголовки на сайте
// «НОВОСТИ СЕКУНДЫ»: два продукта должны читаться как одно хозяйство.
export default function BrandMark({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white">
        <MessageSquare className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="font-serif leading-tight">
          <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            Сообщения
          </span>
          <span className="block text-lg font-bold tracking-tight text-brand-dark">СЕКУНДЫ</span>
        </span>
      )}
    </span>
  );
}
