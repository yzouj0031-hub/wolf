-- Post-match feedback inbox.
-- Players may submit without an account, but frontend roles can never read,
-- update or delete feedback. The project owner reviews rows in Supabase Studio.

create extension if not exists pgcrypto;

create table if not exists public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid default auth.uid() references auth.users(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  categories text[] not null default '{}',
  comment text not null default '' check (char_length(comment) <= 2000),
  contact text not null default '' check (char_length(contact) <= 120),
  match_meta jsonb not null default '{}'::jsonb,
  client_created_at timestamptz,
  created_at timestamptz not null default now(),
  check (categories <@ array['ai_reasoning','rules','ui','performance','art','other']::text[]),
  check (cardinality(categories) <= 6),
  check (comment <> '' or cardinality(categories) > 0),
  check (jsonb_typeof(match_meta) = 'object'),
  check (octet_length(match_meta::text) <= 8192)
);

create index if not exists match_feedback_created_idx
  on public.match_feedback(created_at desc);
create index if not exists match_feedback_rating_idx
  on public.match_feedback(rating,created_at desc);

alter table public.match_feedback enable row level security;

drop policy if exists "anonymous players submit match feedback" on public.match_feedback;
create policy "anonymous players submit match feedback"
on public.match_feedback for insert to anon
with check (submitter_id is null);

drop policy if exists "signed in players submit own match feedback" on public.match_feedback;
create policy "signed in players submit own match feedback"
on public.match_feedback for insert to authenticated
with check (submitter_id = auth.uid());

revoke all on public.match_feedback from anon, authenticated;
grant insert on public.match_feedback to anon, authenticated;

comment on table public.match_feedback is
  'Private post-match feedback inbox. Read through Supabase Studio/service role only.';
