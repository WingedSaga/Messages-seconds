import { Loader2 } from 'lucide-react';

export default function Loader({ full = false, label = 'Загрузка' }) {
  const spinner = (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );

  if (!full) return spinner;

  return (
    <div className="grid h-full place-items-center bg-paper" role="status">
      {spinner}
    </div>
  );
}
