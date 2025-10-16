-- Simple User Knowledge items for RAG

-- Enable extensions required for trigram indexes and vector embeddings
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.user_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_knowledge_user_idx on public.user_knowledge(user_id);
create index if not exists user_knowledge_title_trgm on public.user_knowledge using gin (title gin_trgm_ops);
create index if not exists user_knowledge_content_trgm on public.user_knowledge using gin (content gin_trgm_ops);
create index if not exists user_knowledge_tags_gin on public.user_knowledge using gin (tags);

-- Optional embeddings table for vector search (if pgvector installed)
create table if not exists public.user_knowledge_embeddings (
  knowledge_id uuid primary key references public.user_knowledge(id) on delete cascade,
  embedding vector(1536)
);

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists user_knowledge_updated_at on public.user_knowledge;
create trigger user_knowledge_updated_at
  before update on public.user_knowledge
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.user_knowledge enable row level security;
alter table public.user_knowledge_embeddings enable row level security;

-- Policies
drop policy if exists "select_own_user_knowledge" on public.user_knowledge;
create policy "select_own_user_knowledge"
  on public.user_knowledge for select
  using (auth.uid() = user_id);

drop policy if exists "insert_own_user_knowledge" on public.user_knowledge;
create policy "insert_own_user_knowledge"
  on public.user_knowledge for insert
  with check (auth.uid() = user_id);

drop policy if exists "update_own_user_knowledge" on public.user_knowledge;
create policy "update_own_user_knowledge"
  on public.user_knowledge for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete_own_user_knowledge" on public.user_knowledge;
create policy "delete_own_user_knowledge"
  on public.user_knowledge for delete
  using (auth.uid() = user_id);

-- Embeddings policies: match ownership via join
alter table public.user_knowledge_embeddings enable row level security;

drop policy if exists "select_own_user_knowledge_embeddings" on public.user_knowledge_embeddings;
create policy "select_own_user_knowledge_embeddings"
  on public.user_knowledge_embeddings for select
  using (exists (select 1 from public.user_knowledge k where k.id = knowledge_id and k.user_id = auth.uid()));

drop policy if exists "insert_own_user_knowledge_embeddings" on public.user_knowledge_embeddings;
create policy "insert_own_user_knowledge_embeddings"
  on public.user_knowledge_embeddings for insert
  with check (exists (select 1 from public.user_knowledge k where k.id = knowledge_id and k.user_id = auth.uid()));
