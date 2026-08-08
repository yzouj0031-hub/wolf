-- Hotfix for deployments that already ran 20260808_online_lobby.sql.
-- Removes PL/pgSQL output-column ambiguity while preserving the client JSON keys.

drop function if exists public.online_create_room(text,text,integer);
drop function if exists public.online_join_room(text,text);

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
      v_code := v_code || substr(v_chars,1 + floor(random() * char_length(v_chars))::integer,1);
    end loop;
    begin
      insert into public.online_rooms(code,title,host_id,max_seats)
      values (
        v_code,
        left(coalesce(nullif(trim(p_title),''),'Moonlit Room'),36),
        auth.uid(),
        p_max_seats
      )
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

create or replace function public.online_join_room(
  p_code text,
  p_display_name text
)
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

  select r.* into v_room
  from public.online_rooms as r
  where r.code=upper(trim(p_code)) and r.status='lobby'
  for update;
  if not found then raise exception 'room not found or already started'; end if;

  if exists(
    select 1 from public.online_room_members as m
    where m.room_id=v_room.id and m.user_id=auth.uid()
  ) then
    update public.online_room_members as m
    set display_name=left(trim(p_display_name),24),last_seen_at=now()
    where m.room_id=v_room.id and m.user_id=auth.uid();
    return jsonb_build_object('room_id',v_room.id,'room_code',v_room.code);
  end if;

  select seats.seat into v_seat
  from generate_series(1,v_room.max_seats) as seats(seat)
  where not exists(
    select 1 from public.online_room_members as m
    where m.room_id=v_room.id and m.seat_no=seats.seat
  )
  order by seats.seat limit 1;
  if v_seat is null then raise exception 'room is full'; end if;

  insert into public.online_room_members(room_id,user_id,seat_no,display_name)
  values(v_room.id,auth.uid(),v_seat,left(trim(p_display_name),24));
  update public.online_rooms as r set updated_at=now() where r.id=v_room.id;

  return jsonb_build_object('room_id',v_room.id,'room_code',v_room.code);
end;
$$;

revoke all on function public.online_create_room(text,text,integer) from public;
revoke all on function public.online_join_room(text,text) from public;
grant execute on function public.online_create_room(text,text,integer) to authenticated;
grant execute on function public.online_join_room(text,text) to authenticated;
