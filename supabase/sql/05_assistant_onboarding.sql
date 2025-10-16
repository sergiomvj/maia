-- Tables for Assistant Onboarding and Dynamic Context

create table if not exists public.assistant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  traits jsonb default '{}'::jsonb,
  backstory text,
  motivations text,
  conflicts text,
  abilities jsonb default '[]'::jsonb,
  seed jsonb not null default '{}'::jsonb,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_profiles_user_id_idx on public.assistant_profiles(user_id);
create index if not exists assistant_profiles_gin_traits on public.assistant_profiles using gin (traits);

create table if not exists public.assistant_image_seeds (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references public.assistant_profiles(id) on delete cascade,
  seed jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_image_seeds_assistant_id_idx on public.assistant_image_seeds(assistant_id);

create table if not exists public.user_relationship_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assistant_id uuid references public.assistant_profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_relationship_context_user_idx on public.user_relationship_context(user_id);
create index if not exists user_relationship_context_assistant_idx on public.user_relationship_context(assistant_id);
create index if not exists user_relationship_context_gin_details on public.user_relationship_context using gin (details);

-- Triggers to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assistant_profiles_updated_at on public.assistant_profiles;
create trigger assistant_profiles_updated_at
  before update on public.assistant_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists user_relationship_context_updated_at on public.user_relationship_context;
create trigger user_relationship_context_updated_at
  before update on public.user_relationship_context
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.assistant_profiles enable row level security;
alter table public.assistant_image_seeds enable row level security;
alter table public.user_relationship_context enable row level security;

-- Policies: users can manage their own profiles and relationship context
drop policy if exists "select_own_assistant_profiles" on public.assistant_profiles;
create policy "select_own_assistant_profiles"
  on public.assistant_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "insert_own_assistant_profiles" on public.assistant_profiles;
create policy "insert_own_assistant_profiles"
  on public.assistant_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "update_own_assistant_profiles" on public.assistant_profiles;
create policy "update_own_assistant_profiles"
  on public.assistant_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete_own_assistant_profiles" on public.assistant_profiles;
create policy "delete_own_assistant_profiles"
  on public.assistant_profiles for delete
  using (auth.uid() = user_id);

drop policy if exists "select_images_by_owner" on public.assistant_image_seeds;
create policy "select_images_by_owner"
  on public.assistant_image_seeds for select
  using (exists (select 1 from public.assistant_profiles p where p.id = assistant_id and p.user_id = auth.uid()));

drop policy if exists "insert_images_by_owner" on public.assistant_image_seeds;
create policy "insert_images_by_owner"
  on public.assistant_image_seeds for insert
  with check (exists (select 1 from public.assistant_profiles p where p.id = assistant_id and p.user_id = auth.uid()));

drop policy if exists "select_own_relationship_context" on public.user_relationship_context;
create policy "select_own_relationship_context"
  on public.user_relationship_context for select
  using (auth.uid() = user_id);

drop policy if exists "insert_own_relationship_context" on public.user_relationship_context;
create policy "insert_own_relationship_context"
  on public.user_relationship_context for insert
  with check (auth.uid() = user_id);

drop policy if exists "update_own_relationship_context" on public.user_relationship_context;
create policy "update_own_relationship_context"
  on public.user_relationship_context for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete_own_relationship_context" on public.user_relationship_context;
create policy "delete_own_relationship_context"
  on public.user_relationship_context for delete
  using (auth.uid() = user_id);
