insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lumi-media', 'lumi-media', false, 16777216, array['image/png', 'image/gif', 'image/jpeg']);

create table public.lumi_shares (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  cleaned_at timestamptz,
  published boolean not null default false
);

create table public.lumi_rooms (
  id uuid primary key default gen_random_uuid(),
  host uuid not null,
  guest uuid,
  invite_hash text not null unique,
  expires_at timestamptz not null default now() + interval '1 hour',
  state text not null default 'waiting' check (state in ('waiting', 'capture', 'design', 'complete', 'cancelled')),
  round integer not null default 1 check (round between 1 and 3),
  revision integer not null default 0,
  attempt uuid,
  shutter_at timestamptz,
  host_ready_until timestamptz,
  guest_ready_until timestamptz,
  finished_asset uuid,
  cleaned_at timestamptz,
  shots jsonb not null default '{}'
);

create index lumi_shares_owner on public.lumi_shares (owner, expires_at);
create index lumi_rooms_host on public.lumi_rooms (host, expires_at);
create index lumi_shares_expiry on public.lumi_shares (expires_at);
create index lumi_rooms_expiry on public.lumi_rooms (expires_at);
alter table public.lumi_shares enable row level security;
alter table public.lumi_rooms enable row level security;
revoke all on public.lumi_shares, public.lumi_rooms from anon, authenticated;
grant select, insert, update, delete on public.lumi_shares, public.lumi_rooms to service_role;

-- Serialize transitions for each room. The Edge Function obtains the caller
-- from the verified user token and supplies it to this service-only RPC.
create function public.lumi_room_action(
  room_id uuid, caller uuid, command text, ready boolean default null,
  shot_attempt uuid default null, known_round integer default null
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  room public.lumi_rooms;
  role text;
  clock timestamptz;
  shot_key text;
  changed boolean := false;
  was_ready boolean;
begin
  select * into room from public.lumi_rooms where id = room_id for update;
  clock := clock_timestamp();
  if not found or room.expires_at <= clock or room.state = 'cancelled'
    or (caller is distinct from room.host and caller is distinct from room.guest) then
    raise exception 'Room unavailable.';
  end if;
  role := case when caller = room.host then 'host' else 'guest' end;
  shot_key := room.round::text || ':' || role;

  if room.attempt is not null and clock > room.shutter_at + interval '45 seconds' then
    room.shots := room.shots - (room.round::text || ':host') - (room.round::text || ':guest');
    room.attempt := null;
    room.shutter_at := null;
    room.host_ready_until := null;
    room.guest_ready_until := null;
    changed := true;
  end if;

  case command
    when 'sync' then
      if ready is not null and known_round = room.round and room.state in ('waiting', 'capture') then
        if role = 'host' then
          was_ready := coalesce(room.host_ready_until > clock, false);
          room.host_ready_until := case when ready then clock + interval '12 seconds' end;
        else
          was_ready := coalesce(room.guest_ready_until > clock, false);
          room.guest_ready_until := case when ready then clock + interval '12 seconds' end;
        end if;
        changed := changed or was_ready <> ready;
        if not ready and room.attempt is not null and clock < room.shutter_at then
          room.attempt := null;
          room.shutter_at := null;
          room.host_ready_until := null;
          room.guest_ready_until := null;
          changed := true;
        end if;
      end if;
    when 'start' then
      if role <> 'host' or room.state <> 'capture' or room.attempt is not null
        or not coalesce(room.host_ready_until > clock, false)
        or not coalesce(room.guest_ready_until > clock, false) then
        raise exception 'Both guests must be ready.';
      end if;
      room.attempt := gen_random_uuid();
      room.shutter_at := clock + interval '5 seconds';
      changed := true;
    when 'retry' then
      if room.state <> 'capture' or room.attempt is null or room.attempt <> shot_attempt
        or shot_attempt is null then
        raise exception 'This round has already changed.';
      end if;
      room.shots := room.shots - (room.round::text || ':host') - (room.round::text || ':guest');
      room.attempt := null;
      room.shutter_at := null;
      room.host_ready_until := null;
      room.guest_ready_until := null;
      changed := true;
    when 'upload' then
      if room.state <> 'capture' or shot_attempt is null or room.attempt is distinct from shot_attempt
        or clock < room.shutter_at - interval '250 milliseconds' then
        raise exception 'This shot is no longer expected.';
      end if;
    when 'shot' then
      if shot_attempt is null then raise exception 'Invalid shot.'; end if;
      -- A repeat after either participant advances the round is a read.
      if not exists (
        select 1 from jsonb_each_text(room.shots) as previous(key, value)
        where split_part(previous.key, ':', 2) = role and previous.value = shot_attempt::text
      ) then
        if room.state <> 'capture' or room.attempt is distinct from shot_attempt
          or clock < room.shutter_at - interval '250 milliseconds' then
          raise exception 'This shot is no longer expected.';
        end if;
        room.shots := jsonb_set(room.shots, array[shot_key], to_jsonb(shot_attempt::text));
        if room.shots ? (room.round::text || ':host') and room.shots ? (room.round::text || ':guest') then
          room.attempt := null;
          room.shutter_at := null;
          room.host_ready_until := null;
          room.guest_ready_until := null;
          if room.round = 3 then room.state := 'design'; else room.round := room.round + 1; end if;
        end if;
        changed := true;
      end if;
    when 'prepare_final' then
      if role <> 'host' or room.state not in ('design', 'complete') then
        raise exception 'The strip is not ready.';
      end if;
    when 'finish' then
      if role <> 'host' or room.state not in ('design', 'complete') or shot_attempt is null
        or (room.state = 'complete' and room.finished_asset is distinct from shot_attempt) then
        raise exception 'The strip is not ready.';
      end if;
      changed := room.state <> 'complete';
      room.state := 'complete';
      room.finished_asset := shot_attempt;
    when 'cancel' then
      if room.state <> 'complete' then
        room.state := 'cancelled';
        room.expires_at := clock;
        changed := true;
      end if;
    else raise exception 'Unknown room command.';
  end case;

  if changed or (command = 'sync' and ready is not null) then
    if changed then room.revision := room.revision + 1; end if;
    update public.lumi_rooms set
      state = room.state, round = room.round, revision = room.revision, attempt = room.attempt,
      shutter_at = room.shutter_at, host_ready_until = room.host_ready_until,
      guest_ready_until = room.guest_ready_until, shots = room.shots, expires_at = room.expires_at,
      finished_asset = room.finished_asset
    where id = room_id;
  end if;

  return jsonb_build_object(
    'id', room.id, 'role', role, 'state', room.state, 'round', room.round, 'attempt', room.attempt,
    'revision', room.revision, 'hostReady', coalesce(room.host_ready_until > clock, false),
    'guestReady', coalesce(room.guest_ready_until > clock, false),
    'submitted', room.attempt is not null and room.shots ? (room.round::text || ':' || role),
    'shutterAt', (extract(epoch from room.shutter_at) * 1000)::bigint,
    'serverNow', (extract(epoch from clock) * 1000)::bigint, 'expiresAt', room.expires_at,
    'shots', case when room.state = 'design' and role = 'host' then room.shots end,
    'finishedAsset', room.finished_asset
  );
end;
$$;
revoke execute on function public.lumi_room_action(uuid, uuid, text, boolean, uuid, integer) from public, anon, authenticated;
grant execute on function public.lumi_room_action(uuid, uuid, text, boolean, uuid, integer) to service_role;

create function public.lumi_room_channel_allowed(topic text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lumi_rooms
    where 'lumi-room:' || id::text = topic and expires_at > now()
      and (host = (select auth.uid()) or guest = (select auth.uid()))
  );
$$;
revoke execute on function public.lumi_room_channel_allowed(text) from public, anon;
grant execute on function public.lumi_room_channel_allowed(text) to authenticated;

create policy "LumiBooth members receive their room events"
on realtime.messages for select to authenticated
using (extension = 'broadcast' and public.lumi_room_channel_allowed((select realtime.topic())));

create function public.lumi_notify_room() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.revision <> old.revision then
    perform realtime.send(jsonb_build_object('revision', new.revision), 'room', 'lumi-room:' || new.id::text, true);
  end if;
  return new;
exception when others then
  -- A room without a connected listener still needs to progress.
  return new;
end;
$$;
create trigger lumi_room_changed after update on public.lumi_rooms
for each row execute function public.lumi_notify_room();
