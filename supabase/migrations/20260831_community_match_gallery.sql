-- Moderated public gallery for completed Werewolf matches.
-- Anonymous/authenticated clients may submit only pending rows. Everyone may read
-- published rows; feedback administrators review pending submissions in the app.

create extension if not exists pgcrypto;

create table if not exists public.community_matches (
  id uuid primary key default gen_random_uuid(),
  client_submission_id uuid not null unique,
  submitter_id uuid default auth.uid() references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  author_name text not null default '' check (char_length(author_name) <= 40),
  summary text not null default '' check (char_length(summary) <= 600),
  mode_id text not null default '' check (char_length(mode_id) <= 40),
  mode_name text not null default '' check (char_length(mode_name) <= 80),
  winner text not null default '' check (char_length(winner) <= 60),
  rounds smallint not null default 0 check (rounds between 0 and 200),
  player_count smallint not null check (player_count between 1 and 24),
  roles text[] not null default '{}',
  replay_data jsonb not null,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  client_created_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(roles) <= 24),
  check (octet_length(array_to_string(roles,'')) <= 3000),
  check (jsonb_typeof(replay_data) = 'object'),
  check (octet_length(replay_data::text) <= 1000000),
  check (status <> 'published' or published_at is not null)
);

create index if not exists community_matches_public_idx
  on public.community_matches(status,published_at desc);
create index if not exists community_matches_review_idx
  on public.community_matches(status,created_at asc);

alter table public.community_matches enable row level security;

drop policy if exists "anyone reads published community matches" on public.community_matches;
create policy "anyone reads published community matches"
on public.community_matches for select to anon, authenticated
using (status = 'published');

drop policy if exists "admins read all community submissions" on public.community_matches;
create policy "admins read all community submissions"
on public.community_matches for select to authenticated
using (public.is_feedback_admin());

drop policy if exists "anonymous players submit pending matches" on public.community_matches;
create policy "anonymous players submit pending matches"
on public.community_matches for insert to anon
with check (submitter_id is null and status = 'pending' and published_at is null);

drop policy if exists "signed in players submit pending matches" on public.community_matches;
create policy "signed in players submit pending matches"
on public.community_matches for insert to authenticated
with check (submitter_id = auth.uid() and status = 'pending' and published_at is null);

drop policy if exists "admins moderate community matches" on public.community_matches;
create policy "admins moderate community matches"
on public.community_matches for update to authenticated
using (public.is_feedback_admin())
with check (public.is_feedback_admin());

revoke all on public.community_matches from anon, authenticated;
grant select, insert on public.community_matches to anon, authenticated;
grant update (status,published_at,updated_at) on public.community_matches to authenticated;

comment on table public.community_matches is
  'Moderated public match gallery. replay_data is a sanitized replay snapshot, never a game save.';
