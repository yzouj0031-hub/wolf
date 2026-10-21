-- AI learning corpus: players may donate a finished match for AI learning.
-- The donating client distils the match into a short case with the player's own
-- model right away ("auto"); the case is validated by check constraints below and
-- goes live without a human. Administrators can retire a case or distil a pending
-- match by hand.
--
-- learning_matches : donated sanitized snapshots (same shape as community gallery
--                    replays, optionally anonymised). Only pending rows can be
--                    inserted by players; nobody but administrators can read them.
-- learning_cases   : short "someone played it this way and this happened" cases.
--                    Everyone may read approved rows. Players may insert one case
--                    per donated match (tied through source_submission_id);
--                    administrators may insert, update and retire freely.

create extension if not exists pgcrypto;

create table if not exists public.learning_matches (
  id uuid primary key default gen_random_uuid(),
  client_submission_id uuid not null unique,
  submitter_id uuid default auth.uid() references auth.users(id) on delete set null,
  note text not null default '' check (char_length(note) <= 600),
  anonymized boolean not null default true,
  mode_id text not null default '' check (char_length(mode_id) <= 40),
  mode_name text not null default '' check (char_length(mode_name) <= 80),
  winner text not null default '' check (char_length(winner) <= 60),
  rounds smallint not null default 0 check (rounds between 0 and 200),
  player_count smallint not null check (player_count between 1 and 24),
  roles text[] not null default '{}',
  models text[] not null default '{}',
  snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  reviewed_at timestamptz,
  client_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(roles) <= 24),
  check (cardinality(models) <= 24),
  check (octet_length(array_to_string(roles,'')) <= 3000),
  check (octet_length(array_to_string(models,'')) <= 3000),
  check (jsonb_typeof(snapshot) = 'object'),
  check (octet_length(snapshot::text) <= 1000000)
);

create index if not exists learning_matches_review_idx
  on public.learning_matches(status,created_at asc);

create table if not exists public.learning_cases (
  id uuid primary key default gen_random_uuid(),
  source_match_id uuid references public.learning_matches(id) on delete set null,
  source_submission_id uuid references public.learning_matches(client_submission_id) on delete set null,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  source text not null default 'auto' check (source in ('auto','admin')),
  text text not null check (char_length(text) between 40 and 320),
  needs text[] not null default '{}',
  team text not null default 'any' check (team in ('good','bad','any')),
  phases text[] not null default '{day}',
  tags text[] not null default '{}',
  status text not null default 'approved' check (status in ('approved','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 机械审核：不许带规则书术语、标签或指令腔，needs 只能是角色 id
  check (text !~ '(账本|标尺|排他性|暂认|证据等级|零成本|目标函数|时点|信息差|视角关|名义刀|落点|最高优先级|忽略.{0,8}(规则|指令)|system prompt|<[a-zA-Z/]|【|】)'),
  check (cardinality(needs) <= 8),
  -- CHECK 里不能写子查询，用 string_to_array 展开固定列表
  check (needs <@ string_to_array('seer,witch,guard,hunter,villager,werewolf,knight,magician,wolfbeauty,whitewolf,wolfking,fox,dreamwalker,gargoyle,gravekeeper,alchemist,soulwarden,serialkiller,imitator,mechwolf,cupid,jester,whitecat,merchant,fool,wolfconcubine,youshang', ',')),
  check (cardinality(phases) between 1 and 5),
  check (phases <@ array['day','pk','sheriff','lastwords','wolfnight']::text[]),
  check (cardinality(tags) <= 6),
  check (tags <@ array['early','late','counterclaim','accused','noinfo']::text[])
);

create index if not exists learning_cases_public_idx
  on public.learning_cases(status,created_at desc);
create unique index if not exists learning_cases_one_auto_per_match
  on public.learning_cases(source_submission_id) where source = 'auto';

alter table public.learning_matches enable row level security;
alter table public.learning_cases enable row level security;

-- learning_matches: players insert pending rows; only admins read / moderate.
drop policy if exists "anonymous players donate matches" on public.learning_matches;
create policy "anonymous players donate matches"
on public.learning_matches for insert to anon
with check (submitter_id is null and status = 'pending' and reviewed_at is null);

drop policy if exists "signed in players donate matches" on public.learning_matches;
create policy "signed in players donate matches"
on public.learning_matches for insert to authenticated
with check (submitter_id = auth.uid() and status = 'pending' and reviewed_at is null);

drop policy if exists "admins read donated matches" on public.learning_matches;
create policy "admins read donated matches"
on public.learning_matches for select to authenticated
using (public.is_feedback_admin());

drop policy if exists "admins moderate donated matches" on public.learning_matches;
create policy "admins moderate donated matches"
on public.learning_matches for update to authenticated
using (public.is_feedback_admin())
with check (public.is_feedback_admin());

-- learning_cases: everyone reads approved cases; players insert one auto case per
-- donated match; admins insert, update and retire.
drop policy if exists "anonymous players add auto cases" on public.learning_cases;
create policy "anonymous players add auto cases"
on public.learning_cases for insert to anon
with check (author_id is null and source = 'auto' and status = 'approved' and source_submission_id is not null and source_match_id is null);

drop policy if exists "signed in players add auto cases" on public.learning_cases;
create policy "signed in players add auto cases"
on public.learning_cases for insert to authenticated
with check (author_id = auth.uid() and source = 'auto' and status = 'approved' and source_submission_id is not null and source_match_id is null);

drop policy if exists "anyone reads approved learning cases" on public.learning_cases;
create policy "anyone reads approved learning cases"
on public.learning_cases for select to anon, authenticated
using (status = 'approved');

drop policy if exists "admins read all learning cases" on public.learning_cases;
create policy "admins read all learning cases"
on public.learning_cases for select to authenticated
using (public.is_feedback_admin());

drop policy if exists "admins write learning cases" on public.learning_cases;
create policy "admins write learning cases"
on public.learning_cases for insert to authenticated
with check (public.is_feedback_admin() and author_id = auth.uid() and source = 'admin');

drop policy if exists "admins update learning cases" on public.learning_cases;
create policy "admins update learning cases"
on public.learning_cases for update to authenticated
using (public.is_feedback_admin())
with check (public.is_feedback_admin());

revoke all on public.learning_matches from anon, authenticated;
grant insert on public.learning_matches to anon, authenticated;
grant select on public.learning_matches to authenticated;
grant update (status,admin_note,reviewed_at,updated_at) on public.learning_matches to authenticated;

revoke all on public.learning_cases from anon, authenticated;
grant select, insert on public.learning_cases to anon, authenticated;
grant update (status,updated_at) on public.learning_cases to authenticated;

comment on table public.learning_matches is
  'Matches donated for AI learning. snapshot is the sanitized gallery replay shape (no prompts, chain-of-thought, API config, memories or avatars), optionally anonymised.';
comment on table public.learning_cases is
  'Short cases distilled from donated matches (auto: by the donating client with its own model, one per match; admin: by hand). Approved rows are fetched by every client and mixed into the experience library; retire a bad one by setting status = retired.';
