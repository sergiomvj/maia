-- Add language preference to profiles
-- Safe to run multiple times

-- Ensure base table `public.profiles` exists (minimal schema)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  llm_provider text check (llm_provider in ('gemini','openai','anthropic')) default 'gemini',
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS and owner-only access
alter table public.profiles enable row level security;
drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile" on public.profiles
  for all
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

alter table if exists public.profiles
  add column if not exists language text check (language in ('pt-BR','en','es'));

-- Optional: default to pt-BR if null
update public.profiles set language = 'pt-BR' where language is null;
