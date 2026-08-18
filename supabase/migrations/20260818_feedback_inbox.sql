-- Owner-only mobile feedback inbox.
-- The administrator account is deliberately seeded out-of-band so its email
-- never enters the public repository.

create table if not exists public.feedback_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.feedback_admins enable row level security;
revoke all on public.feedback_admins from anon, authenticated;

create or replace function public.is_feedback_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.feedback_admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_feedback_admin() from public;
grant execute on function public.is_feedback_admin() to authenticated;

alter table public.match_feedback
  add column if not exists status text not null default 'new',
  add column if not exists admin_note text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.match_feedback
    add constraint match_feedback_status_check
    check (status in ('new','reviewing','resolved'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.match_feedback
    add constraint match_feedback_admin_note_length
    check (char_length(admin_note) <= 1000);
exception when duplicate_object then null;
end $$;

drop policy if exists "feedback admins read inbox" on public.match_feedback;
create policy "feedback admins read inbox"
on public.match_feedback for select to authenticated
using (public.is_feedback_admin());

drop policy if exists "feedback admins update workflow" on public.match_feedback;
create policy "feedback admins update workflow"
on public.match_feedback for update to authenticated
using (public.is_feedback_admin())
with check (public.is_feedback_admin());

grant select on public.match_feedback to authenticated;
grant update (status,admin_note,reviewed_at,updated_at) on public.match_feedback to authenticated;

create index if not exists match_feedback_status_created_idx
  on public.match_feedback(status,created_at desc);
