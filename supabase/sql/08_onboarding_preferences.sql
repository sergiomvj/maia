-- Onboarding Inteligente: Tabela de preferências e contexto do usuário

create table if not exists public.profiles_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  identidade jsonb default '{}'::jsonb,
  rotina jsonb default '{}'::jsonb,
  preferencias jsonb default '{}'::jsonb,
  locais jsonb default '{}'::jsonb,
  notificacoes jsonb default '{}'::jsonb,
  privacidade jsonb default '{}'::jsonb,
  assistente jsonb default '{}'::jsonb,
  metas jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_preferences_updated_idx on public.profiles_preferences(updated_at desc);
create index if not exists profiles_preferences_gin_identidade on public.profiles_preferences using gin (identidade);
create index if not exists profiles_preferences_gin_preferencias on public.profiles_preferences using gin (preferencias);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_preferences_updated_at on public.profiles_preferences;
create trigger profiles_preferences_updated_at
  before update on public.profiles_preferences
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles_preferences enable row level security;

drop policy if exists "select_own_preferences" on public.profiles_preferences;
create policy "select_own_preferences"
  on public.profiles_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "upsert_own_preferences" on public.profiles_preferences;
create policy "upsert_own_preferences"
  on public.profiles_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "update_own_preferences" on public.profiles_preferences;
create policy "update_own_preferences"
  on public.profiles_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
