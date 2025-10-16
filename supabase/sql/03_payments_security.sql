-- Payments security tables and policies
-- Run once per project

create table if not exists public.payment_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  passphrase_hash text,
  duress_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_auth_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  outcome text not null check (outcome in ('success','duress','failure')),
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.payment_security enable row level security;
alter table public.payment_auth_audit enable row level security;

drop policy if exists "Users manage own payment security" on public.payment_security;
create policy "Users manage own payment security" on public.payment_security
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can read own audit" on public.payment_auth_audit;
create policy "Users can read own audit" on public.payment_auth_audit
  for select using (auth.uid() = user_id);

drop policy if exists "Insert audit server-side" on public.payment_auth_audit;
create policy "Insert audit server-side" on public.payment_auth_audit
  for insert with check (auth.uid() = user_id);
