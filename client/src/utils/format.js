const HOUR_FORMAT = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const DAY_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const DAY_YEAR_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Время сообщения — всегда часы и минуты: в ленте они идут подряд,
// и дата вынесена в отдельный разделитель.
export function formatTime(value) {
  return HOUR_FORMAT.format(new Date(value));
}

// Разделитель дня в ленте: «Сегодня», «Вчера» или дата словами.
export function formatDayLabel(value) {
  const date = new Date(value);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (date.getFullYear() === new Date().getFullYear()) return DAY_FORMAT.format(date);
  return DAY_YEAR_FORMAT.format(date);
}

// Метка в списке чатов: сегодня — время, на этой неделе — день, дальше — дата.
export function formatListStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (days === 0) return HOUR_FORMAT.format(date);
  if (days === 1) return 'вчера';
  if (days < 7) return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(date);
}

// «был(а) недавно» без указания пола: пол в базе не хранится.
export function formatLastSeen(value) {
  if (!value) return 'не в сети';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);

  if (minutes < 1) return 'в сети';
  if (minutes < 60) return `был(а) ${minutes} мин назад`;
  if (minutes < 24 * 60) return `был(а) ${Math.round(minutes / 60)} ч назад`;
  return `был(а) ${formatDayLabel(value).toLowerCase()}`;
}

// Русский счёт: «1 участник», «2 участника», «5 участников».
// Без этого в шапке группы каждый раз получалось «2 участников».
export function plural(count, one, few, many) {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return `${count} ${many}`;
  if (mod10 === 1) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1048576).toFixed(1)} МБ`;
}

// Счётчик непрочитанных: трёхзначные числа ломают круглую метку.
export function formatUnread(count) {
  return count > 99 ? '99+' : String(count);
}

// Инициал для запасного аватара. Пустое имя не должно давать пустой круг.
export function initialOf(name) {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}
