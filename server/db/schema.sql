-- Схема мессенджера «СООБЩЕНИЯ СЕКУНДЫ».
-- Выполняется в SQL Editor того же проекта Supabase, где живёт сайт
-- «НОВОСТИ СЕКУНДЫ»: аккаунт у человека один, и таблица public.users общая.
-- Файл безопасно выполнять повторно.

create extension if not exists "pgcrypto";

-- Когда пользователя видели последний раз. Колонка добавляется к общей
-- таблице сайта: подпись «был(а) недавно» должна пережить перезапуск сервера.
alter table public.users add column if not exists last_seen_at timestamptz;

-- Разговоры ----------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  kind        text        not null check (kind in ('direct', 'group')),
  -- У личной переписки названия нет: она подписывается именем собеседника.
  title       text,
  avatar_url  text,
  created_by  uuid        references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Последнее сообщение продублировано в разговор. Иначе список чатов стоил бы
  -- отдельного запроса на каждую строку списка, а он обновляется каждые
  -- несколько секунд у каждой открытой вкладки.
  last_message_at        timestamptz not null default now(),
  last_message_preview   text,
  last_message_sender_id uuid references public.users (id) on delete set null,
  -- Пара участников личной переписки, отсортированная и склеенная через дефис.
  -- Уникальность здесь — единственный надёжный способ не завести второй
  -- диалог с тем же человеком при двойном нажатии.
  direct_key  text unique
);

create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);

-- Участники ----------------------------------------------------------------
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'member')),
  joined_at       timestamptz not null default now(),
  -- До какого момента человек дочитал. Хранить отметку времени дешевле,
  -- чем строку на каждое прочитанное сообщение.
  last_read_at    timestamptz not null default '1970-01-01T00:00:00Z',
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);

-- Сообщения ----------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.users (id) on delete set null,
  body            text not null default '',
  -- Вложение: картинка или файл в Supabase Storage.
  attachment_url  text,
  attachment_type text check (attachment_type is null or attachment_type in ('image', 'file')),
  attachment_name text,
  attachment_size bigint,
  -- Ответ на сообщение. Вложенность не строится: показывается одна цитата.
  reply_to        uuid references public.messages (id) on delete set null,
  edited_at       timestamptz,
  -- Удаление мягкое: на месте сообщения остаётся подпись «Сообщение удалено»,
  -- иначе у собеседника посреди разговора молча пропадает реплика.
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);
