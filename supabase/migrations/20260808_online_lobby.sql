-- AI Werewolf online lobby v1
-- Rooms, seats, readiness, heartbeat and lobby messages.

create extension if not exists pgcrypto;

create table if not exists public.online_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  title text not null check (char_length(title) between 1 and 36),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','playing','closed')),
  max_seats smallint not null default 12 check (max_seats between 4 and 16),
  ruleset jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_room_members (
  room_id uuid not null references public.online_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_no smallint not null check (seat_no between 1 and 16),
  display_name text not null check (char_length(display_name) between 1 and 24),
  controller_type text not null default 'human' check (controller_type in ('human','personal_ai','hosted_ai')),
  model_label text not null default '' check (char_length(model_label) <= 40),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id,user_id),
  unique (room_id,seat_no)
);

create table if not exists public.online_room_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.online_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'chat' check (kind in ('chat','system')),
  body jsonb not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(body) = 'object'),
  check (char_length(coalesce(body->>'text','')) between 1 and 500)
);

create index if not exists online_room_members_user_idx on public.online_room_members(user_id);
create index if not exists online_room_messages_room_idx on public.online_room_messages(room_id,id desc);

alter table public.online_rooms enable row level security;
alter table public.online_room_members enable row level security;
alter table public.online_room_messages enable row level security;

create or replace function public.is_online_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.online_room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

drop policy if exists "online members read rooms" on public.online_rooms;
create policy "online members read rooms"
on public.online_rooms for select to authenticated
using (public.is_online_room_member(id));

drop policy if exists "online members read seats" on public.online_room_members;
create policy "online members read seats"
on public.online_room_members for select to authenticated
using (public.is_online_room_member(room_id));

drop policy if exists "online members read messages" on public.online_room_messages;
create policy "online members read messages"
on public.online_room_messages for select to authenticated
using (public.is_online_room_member(room_id));

drop policy if exists "online members send messages" on public.online_room_messages;
create policy "online members send messages"
on public.online_room_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_online_room_member(room_id)
  and kind = 'chat'
);

revoke all on public.online_rooms from anon, authenticated;
revoke all on public.online_room_members from anon, authenticated;
revoke all on public.online_room_messages from anon, authenticated;
grant select on public.online_rooms to authenticated;
grant select on public.online_room_members to authenticated;
grant select,insert on public.online_room_messages to authenticated;
grant usage,select on sequence public.online_room_messages_id_seq to authenticated;

create or replace function public.online_create_room(
  p_title text,
  p_display_name text,
  p_max_seats integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_code text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(p_display_name,''))) not between 1 and 24 then raise exception 'invalid display name'; end if;
  if p_max_seats not between 4 and 16 then raise exception 'seat count must be between 4 and 16'; end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * char_length(v_chars))::integer, 1);
    end loop;
    begin
      insert into public.online_rooms(code,title,host_id,max_seats)
      values (v_code,left(coalesce(nullif(trim(p_title),''),'Moonlit Room'),36),auth.uid(),p_max_seats)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.online_room_members(room_id,user_id,seat_no,display_name)
  values (v_room_id,auth.uid(),1,left(trim(p_display_name),24));
  return jsonb_build_object('room_id',v_room_id,'room_code',v_code);
end;
$$;

create or replace function public.online_join_room(p_code text,p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.online_rooms%rowtype;
  v_seat integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(p_display_name,''))) not between 1 and 24 then raise exception 'invalid display name'; end if;

  select r.* into v_room from public.online_rooms as r
  where r.code = upper(trim(p_code)) and r.status = 'lobby'
  for update;
  if not found then raise exception 'room not found or already started'; end if;

  if exists(select 1 from public.online_room_members as m where m.room_id=v_room.id and m.user_id=auth.uid()) then
    update public.online_room_members as m set display_name=left(trim(p_display_name),24),last_seen_at=now()
    where m.room_id=v_room.id and m.user_id=auth.uid();
    return jsonb_build_object('room_id',v_room.id,'room_code',v_room.code);
  end if;

  select seats.seat into v_seat from generate_series(1,v_room.max_seats) as seats(seat)
  where not exists(select 1 from public.online_room_members m where m.room_id=v_room.id and m.seat_no=seats.seat)
  order by seats.seat limit 1;
  if v_seat is null then raise exception 'room is full'; end if;

  insert into public.online_room_members(room_id,user_id,seat_no,display_name)
  values(v_room.id,auth.uid(),v_seat,left(trim(p_display_name),24));
  update public.online_rooms as r set updated_at=now() where r.id=v_room.id;
  return jsonb_build_object('room_id',v_room.id,'room_code',v_room.code);
end;
$$;

create or replace function public.online_update_member(
  p_room_id uuid,
  p_display_name text,
  p_controller text,
  p_model_label text default '',
  p_ready boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_controller not in ('human','personal_ai','hosted_ai') then raise exception 'invalid controller'; end if;
  if char_length(trim(coalesce(p_display_name,''))) not between 1 and 24 then raise exception 'invalid display name'; end if;
  if char_length(coalesce(p_model_label,'')) > 40 then raise exception 'model label is too long'; end if;
  if not exists(select 1 from public.online_rooms where id=p_room_id and status='lobby') then raise exception 'room is not editable'; end if;

  update public.online_room_members
  set display_name=left(trim(p_display_name),24),controller_type=p_controller,
      model_label=left(trim(coalesce(p_model_label,'')),40),ready=p_ready,last_seen_at=now()
  where room_id=p_room_id and user_id=auth.uid();
  if not found then raise exception 'not a room member'; end if;
end;
$$;

create or replace function public.online_touch_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.online_room_members set last_seen_at=now()
  where room_id=p_room_id and user_id=auth.uid();
end;
$$;

create or replace function public.online_start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  perform 1 from public.online_rooms where id=p_room_id and host_id=auth.uid() and status='lobby' for update;
  if not found then raise exception 'only the host can start this room'; end if;
  select count(*) into v_count from public.online_room_members where room_id=p_room_id;
  if v_count < 2 then raise exception 'at least two players are required'; end if;
  if exists(select 1 from public.online_room_members where room_id=p_room_id and not ready)
    then raise exception 'all players must be ready'; end if;
  update public.online_rooms set status='playing',updated_at=now() where id=p_room_id;
end;
$$;

create or replace function public.online_leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_host boolean;
  v_next_host uuid;
begin
  select host_id=auth.uid() into v_was_host from public.online_rooms where id=p_room_id for update;
  delete from public.online_room_members where room_id=p_room_id and user_id=auth.uid();
  if not found then return; end if;
  select user_id into v_next_host from public.online_room_members where room_id=p_room_id order by joined_at,seat_no limit 1;
  if v_next_host is null then
    delete from public.online_rooms where id=p_room_id;
  elsif v_was_host then
    update public.online_rooms set host_id=v_next_host,updated_at=now() where id=p_room_id;
  else
    update public.online_rooms set updated_at=now() where id=p_room_id;
  end if;
end;
$$;

revoke all on function public.is_online_room_member(uuid) from public;
revoke all on function public.online_create_room(text,text,integer) from public;
revoke all on function public.online_join_room(text,text) from public;
revoke all on function public.online_update_member(uuid,text,text,text,boolean) from public;
revoke all on function public.online_touch_room(uuid) from public;
revoke all on function public.online_start_room(uuid) from public;
revoke all on function public.online_leave_room(uuid) from public;
grant execute on function public.is_online_room_member(uuid) to authenticated;
grant execute on function public.online_create_room(text,text,integer) to authenticated;
grant execute on function public.online_join_room(text,text) to authenticated;
grant execute on function public.online_update_member(uuid,text,text,text,boolean) to authenticated;
grant execute on function public.online_touch_room(uuid) to authenticated;
grant execute on function public.online_start_room(uuid) to authenticated;
grant execute on function public.online_leave_room(uuid) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='online_rooms') then
    alter publication supabase_realtime add table public.online_rooms;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='online_room_members') then
    alter publication supabase_realtime add table public.online_room_members;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='online_room_messages') then
    alter publication supabase_realtime add table public.online_room_messages;
  end if;
end $$;
