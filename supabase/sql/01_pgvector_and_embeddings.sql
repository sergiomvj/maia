-- Enable pgvector extension in the extensions schema
create extension if not exists vector with schema extensions;

-- Ensure base table `public.notes` exists (minimal schema)
create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- Generic RLS policy for notes (owner-only)
drop policy if exists "Users can manage their own notes." on public.notes;
create policy "Users can manage their own notes." on public.notes
  for all
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- Notes embeddings table
create table if not exists public.notes_embeddings (
  note_id uuid primary key references public.notes(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

alter table public.notes_embeddings enable row level security;

-- RLS: allow only owner via join with notes.user_id
drop policy if exists "Users can manage their own notes embeddings." on public.notes_embeddings;
create policy "Users can manage their own notes embeddings." on public.notes_embeddings
  for all
  using (exists (
    select 1 from public.notes n where n.id = notes_embeddings.note_id and n.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.notes n where n.id = notes_embeddings.note_id and n.user_id = auth.uid()
  ));

-- Optional helper function for upsert (embedding provided by caller)
create or replace function public.upsert_note_embedding(p_note_id uuid, p_content text, p_embedding vector)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notes_embeddings(note_id, content, embedding)
  values (p_note_id, p_content, p_embedding)
  on conflict (note_id)
  do update set content = excluded.content, embedding = excluded.embedding;
$$;

-- Search function: returns note ids ranked by vector distance; caller can combine with full-text or BM25 separately
create or replace function public.search_notes_by_embedding(p_embedding vector, p_limit int default 10)
returns table(note_id uuid, distance float4)
language sql
stable
set search_path = public
as $$
  select ne.note_id, (ne.embedding <-> p_embedding) as distance
  from public.notes_embeddings ne
  where ne.embedding is not null
  order by ne.embedding <-> p_embedding
  limit p_limit;
$$;
