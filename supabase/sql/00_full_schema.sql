-- Maia Full Schema (Executable & Idempotent)
-- This script creates required tables, extensions, RLS policies, and indexes.
-- Safe to run multiple times.

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- =============================
-- PROFILES (user preferences)
-- =============================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  llm_provider text check (llm_provider in ('gemini','openai','anthropic')) default 'gemini',
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

alter table public.profiles
  add column if not exists language text check (language in ('pt-BR','en','es'));

-- default language if null
update public.profiles set language = 'pt-BR' where language is null;

-- =============
-- NOTES + RAG
-- =============
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;
drop policy if exists "Users manage their own notes." on public.notes;
create policy "Users manage their own notes." on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.notes_embeddings (
  note_id uuid primary key references public.notes(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Optional RLS mirroring: allow access to embeddings of own notes via join
alter table public.notes_embeddings enable row level security;
drop policy if exists "Users read their notes embeddings" on public.notes_embeddings;
create policy "Users read their notes embeddings" on public.notes_embeddings
  for select using (exists (
    select 1 from public.notes n
    where n.id = public.notes_embeddings.note_id and n.user_id = auth.uid()
  ));

-- =====================
-- REMINDERS (to-do)
-- =====================
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  due_date date,
  due_time text,
  priority text check (priority in ('High','Medium','Low')) default 'Medium',
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.reminders enable row level security;
drop policy if exists "Users manage their own reminders" on public.reminders;
create policy "Users manage their own reminders" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================
-- SHOPPING LIST
-- =============================
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  quantity int not null default 1,
  is_collected boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.shopping_list_items enable row level security;
drop policy if exists "Users manage shopping list" on public.shopping_list_items;
create policy "Users manage shopping list" on public.shopping_list_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================
-- CHAT HISTORY
-- =============================
create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  speaker text check (speaker in ('user','maia','system')) not null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_history enable row level security;
drop policy if exists "Users manage their chat history" on public.chat_history;
create policy "Users manage their chat history" on public.chat_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================
-- OAUTH TOKENS (integrations)
-- =============================
create table if not exists public.oauth_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.oauth_tokens enable row level security;
drop policy if exists "Users manage their own oauth tokens" on public.oauth_tokens;
create policy "Users manage their own oauth tokens" on public.oauth_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============
-- INDEXES
-- =============
create index if not exists idx_notes_user_created on public.notes (user_id, created_at desc);
create index if not exists idx_reminders_user_created on public.reminders (user_id, created_at desc);
create index if not exists idx_shop_items_user_collected_created on public.shopping_list_items (user_id, is_collected, created_at desc);
create index if not exists idx_chat_user_created on public.chat_history (user_id, created_at desc);
