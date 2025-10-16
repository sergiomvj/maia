-- Chat history schema with RLS and idempotent triggers

create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  speaker text not null check (speaker in ('user','maia')),
  text text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_history_user_created_idx on public.chat_history(user_id, created_at desc);

-- RLS
alter table public.chat_history enable row level security;

drop policy if exists "select_own_chat" on public.chat_history;
create policy "select_own_chat"
  on public.chat_history for select
  using (auth.uid() = user_id);

drop policy if exists "insert_own_chat" on public.chat_history;
create policy "insert_own_chat"
  on public.chat_history for insert
  with check (auth.uid() = user_id);
