-- Online lobby v2: one API provider may own multiple AI seats.

alter table public.online_rooms
  add column if not exists fill_mode text not null default 'wait'
  check (fill_mode in ('wait','host_fill','balanced'));

alter table public.online_room_members
  add column if not exists can_host_ai boolean not null default false;
alter table public.online_room_members
  add column if not exists max_ai_seats smallint not null default 0
  check (max_ai_seats between 0 and 15);
alter table public.online_room_members
  add column if not exists request_mode text not null default 'queue'
  check (request_mode in ('queue','parallel'));

create table if not exists public.online_room_ai_seats (
  room_id uuid not null references public.online_rooms(id) on delete cascade,
  seat_no smallint not null check (seat_no between 1 and 16),
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 36),
  model_label text not null default '' check (char_length(model_label) <= 40),
  created_at timestamptz not null default now(),
  primary key (room_id,seat_no)
);

create index if not exists online_room_ai_provider_idx
on public.online_room_ai_seats(room_id,provider_user_id);

alter table public.online_room_ai_seats enable row level security;

drop policy if exists "online members read ai seats" on public.online_room_ai_seats;
create policy "online members read ai seats"
on public.online_room_ai_seats for select to authenticated
using (public.is_online_room_member(room_id));

revoke all on public.online_room_ai_seats from anon,authenticated;
grant select on public.online_room_ai_seats to authenticated;

create or replace function public.online_update_provider(
  p_room_id uuid,
  p_can_host_ai boolean,
  p_max_ai_seats integer default 0,
  p_request_mode text default 'queue'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_max_ai_seats not between 0 and 15 then raise exception 'AI seat limit must be between 0 and 15'; end if;
  if p_request_mode not in ('queue','parallel') then raise exception 'invalid request mode'; end if;
  if not exists(select 1 from public.online_rooms as r where r.id=p_room_id and r.status='lobby')
    then raise exception 'room is not editable'; end if;

  update public.online_room_members as m
  set can_host_ai=p_can_host_ai,
      max_ai_seats=case when p_can_host_ai then p_max_ai_seats else 0 end,
      request_mode=p_request_mode,
      last_seen_at=now()
  where m.room_id=p_room_id and m.user_id=auth.uid();
  if not found then raise exception 'not a room member'; end if;

  -- Provider capacity changes invalidate only that provider's generated seats.
  delete from public.online_room_ai_seats as a
  where a.room_id=p_room_id and a.provider_user_id=auth.uid();
end;
$$;

create or replace function public.online_configure_ai_fill(
  p_room_id uuid,
  p_fill_mode text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.online_rooms%rowtype;
  v_seat integer;
  v_provider uuid;
  v_provider_name text;
  v_model_label text;
  v_provider_count integer;
  v_created integer := 0;
begin
  if p_fill_mode not in ('wait','host_fill','balanced') then raise exception 'invalid fill mode'; end if;
  select r.* into v_room from public.online_rooms as r
  where r.id=p_room_id and r.host_id=auth.uid() and r.status='lobby'
  for update;
  if not found then raise exception 'only the host can configure empty seats'; end if;

  update public.online_rooms as r set fill_mode=p_fill_mode,updated_at=now() where r.id=p_room_id;
  delete from public.online_room_ai_seats as a where a.room_id=p_room_id;
  if p_fill_mode='wait' then return 0; end if;

  for v_seat in 1..v_room.max_seats loop
    if exists(select 1 from public.online_room_members as m where m.room_id=p_room_id and m.seat_no=v_seat) then
      continue;
    end if;

    if p_fill_mode='host_fill' then
      select m.user_id,m.display_name,m.model_label,
             (select count(*)::integer from public.online_room_ai_seats as used
              where used.room_id=p_room_id and used.provider_user_id=m.user_id)
      into v_provider,v_provider_name,v_model_label,v_provider_count
      from public.online_room_members as m
      where m.room_id=p_room_id and m.user_id=v_room.host_id
        and m.can_host_ai and m.max_ai_seats>0;
      if v_provider is null or v_provider_count >= (
        select m.max_ai_seats from public.online_room_members as m
        where m.room_id=p_room_id and m.user_id=v_room.host_id
      ) then
        raise exception 'host AI capacity is not enough for all empty seats';
      end if;
    else
      select m.user_id,m.display_name,m.model_label,coalesce(used.n,0)::integer
      into v_provider,v_provider_name,v_model_label,v_provider_count
      from public.online_room_members as m
      left join (
        select a.provider_user_id,count(*) as n
        from public.online_room_ai_seats as a where a.room_id=p_room_id
        group by a.provider_user_id
      ) as used on used.provider_user_id=m.user_id
      where m.room_id=p_room_id and m.can_host_ai and m.max_ai_seats>coalesce(used.n,0)
      order by coalesce(used.n,0),m.joined_at,m.seat_no
      limit 1;
      if v_provider is null then raise exception 'combined AI capacity is not enough for all empty seats'; end if;
    end if;

    insert into public.online_room_ai_seats(
      room_id,seat_no,provider_user_id,display_name,model_label
    ) values (
      p_room_id,v_seat,v_provider,
      left(v_provider_name || ' AI ' || (v_provider_count+1),36),
      left(coalesce(v_model_label,''),40)
    );
    v_created := v_created+1;
  end loop;
  return v_created;
end;
$$;

-- A human joining an already-filled lobby replaces the generated AI in that seat.
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
  where r.code=upper(trim(p_code)) and r.status='lobby' for update;
  if not found then raise exception 'room not found or already started'; end if;

  if exists(select 1 from public.online_room_members as m where m.room_id=v_room.id and m.user_id=auth.uid()) then
    update public.online_room_members as m
    set display_name=left(trim(p_display_name),24),last_seen_at=now()
    where m.room_id=v_room.id and m.user_id=auth.uid();
    return jsonb_build_object('room_id',v_room.id,'room_code',v_room.code);
  end if;

  select seats.seat into v_seat from generate_series(1,v_room.max_seats) as seats(seat)
  where not exists(select 1 from public.online_room_members as m where m.room_id=v_room.id and m.seat_no=seats.seat)
  order by case when exists(
    select 1 from public.online_room_ai_seats as a where a.room_id=v_room.id and a.seat_no=seats.seat
  ) then 0 else 1 end,seats.seat limit 1;
  if v_seat is null then raise exception 'room is full'; end if;

  delete from public.online_room_ai_seats as a where a.room_id=v_room.id and a.seat_no=v_seat;
  insert into public.online_room_members(room_id,user_id,seat_no,display_name)
  values(v_room.id,auth.uid(),v_seat,left(trim(p_display_name),24));
  update public.online_rooms as r set updated_at=now() where r.id=v_room.id;
  return jsonb_build_object('room_id',v_room.id,'room_code',v_room.code);
end;
$$;

create or replace function public.online_start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.online_rooms%rowtype;
  v_total integer;
begin
  select r.* into v_room from public.online_rooms as r
  where r.id=p_room_id and r.host_id=auth.uid() and r.status='lobby' for update;
  if not found then raise exception 'only the host can start this room'; end if;
  select (
    (select count(*) from public.online_room_members as m where m.room_id=p_room_id)
    + (select count(*) from public.online_room_ai_seats as a where a.room_id=p_room_id)
  ) into v_total;
  if v_total <> v_room.max_seats then raise exception 'all configured seats must be filled'; end if;
  if exists(select 1 from public.online_room_members as m where m.room_id=p_room_id and not m.ready)
    then raise exception 'all human members must be ready'; end if;
  update public.online_rooms as r set status='playing',updated_at=now() where r.id=p_room_id;
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
  select r.host_id=auth.uid() into v_was_host from public.online_rooms as r where r.id=p_room_id for update;
  delete from public.online_room_ai_seats as a where a.room_id=p_room_id and a.provider_user_id=auth.uid();
  delete from public.online_room_members as m where m.room_id=p_room_id and m.user_id=auth.uid();
  if not found then return; end if;
  select m.user_id into v_next_host from public.online_room_members as m
  where m.room_id=p_room_id order by m.joined_at,m.seat_no limit 1;
  if v_next_host is null then
    delete from public.online_rooms as r where r.id=p_room_id;
  elsif v_was_host then
    update public.online_rooms as r set host_id=v_next_host,fill_mode='wait',updated_at=now() where r.id=p_room_id;
    delete from public.online_room_ai_seats as a where a.room_id=p_room_id;
  else
    update public.online_rooms as r set updated_at=now() where r.id=p_room_id;
  end if;
end;
$$;

revoke all on function public.online_update_provider(uuid,boolean,integer,text) from public;
revoke all on function public.online_configure_ai_fill(uuid,text) from public;
grant execute on function public.online_update_provider(uuid,boolean,integer,text) to authenticated;
grant execute on function public.online_configure_ai_fill(uuid,text) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='online_room_ai_seats') then
    alter publication supabase_realtime add table public.online_room_ai_seats;
  end if;
end $$;
