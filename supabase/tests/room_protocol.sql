begin;
do $$
declare
  host_id uuid := gen_random_uuid();
  guest_id uuid := gen_random_uuid();
  stranger_id uuid := gen_random_uuid();
  room_id uuid;
  current_attempt uuid;
  captured_attempts uuid[] := '{}';
  result jsonb;
begin
  insert into public.lumi_rooms (host, guest, state, invite_hash)
  values (host_id, guest_id, 'capture', gen_random_uuid()::text) returning id into room_id;

  if has_function_privilege('authenticated', 'public.lumi_room_action(uuid,uuid,text,boolean,uuid,integer)', 'execute') then
    raise exception 'Guests must not be able to impersonate another caller.';
  end if;
  begin
    perform public.lumi_room_action(room_id, stranger_id, 'sync');
    raise exception 'A third user entered the room.';
  exception when raise_exception then
    if sqlerrm <> 'Room unavailable.' then raise; end if;
  end;
  begin
    perform public.lumi_room_action(room_id, host_id, 'start');
    raise exception 'An unready room started.';
  exception when raise_exception then
    if sqlerrm <> 'Both guests must be ready.' then raise; end if;
  end;

  for round_no in 1..3 loop
    perform public.lumi_room_action(room_id, host_id, 'sync', true, null, round_no);
    perform public.lumi_room_action(room_id, guest_id, 'sync', true, null, round_no);
    result := public.lumi_room_action(room_id, host_id, 'start');
    current_attempt := (result->>'attempt')::uuid;
    if (result->>'shutterAt')::bigint - (result->>'serverNow')::bigint <> 5000 then
      raise exception 'Countdown is not five seconds.';
    end if;

    if round_no = 1 then
      -- Backing out during countdown clears readiness and invalidates the attempt.
      result := public.lumi_room_action(room_id, guest_id, 'sync', false, null, round_no);
      if result->>'attempt' is not null or (result->>'hostReady')::boolean then
        raise exception 'Backgrounded guests must invalidate the countdown.';
      end if;
      perform public.lumi_room_action(room_id, host_id, 'sync', true, null, round_no);
      perform public.lumi_room_action(room_id, guest_id, 'sync', true, null, round_no);
      result := public.lumi_room_action(room_id, host_id, 'start');
      current_attempt := (result->>'attempt')::uuid;
    end if;

    update public.lumi_rooms set shutter_at = clock_timestamp() - interval '1 second' where id = room_id;
    perform public.lumi_room_action(room_id, guest_id, 'shot', null, current_attempt);
    result := public.lumi_room_action(room_id, host_id, 'shot', null, current_attempt);
    captured_attempts := array_append(captured_attempts, current_attempt);
    perform public.lumi_room_action(room_id, host_id, 'shot', null, current_attempt);
    if round_no < 3 and (result->>'round')::integer <> round_no + 1 then
      raise exception 'The round should advance once after both shots.';
    end if;
    if round_no < 3 then
      result := public.lumi_room_action(room_id, guest_id, 'sync', true, null, round_no);
      if (result->>'guestReady')::boolean then raise exception 'A stale heartbeat readied the next round.'; end if;
    end if;
  end loop;

  result := public.lumi_room_action(room_id, host_id, 'sync');
  if result->>'state' <> 'design' or (select count(*) from jsonb_each(result->'shots')) <> 6 then
    raise exception 'The editor should receive all six shots.';
  end if;
  for round_no in 1..3 loop
    if (result->'shots'->>(round_no::text || ':host'))::uuid is distinct from captured_attempts[round_no]
      or (result->'shots'->>(round_no::text || ':guest'))::uuid is distinct from captured_attempts[round_no] then
      raise exception 'A shot was stored under the wrong round or role.';
    end if;
  end loop;
  begin
    perform public.lumi_room_action(room_id, guest_id, 'finish');
    raise exception 'A guest could overwrite the final strip.';
  exception when raise_exception then
    if sqlerrm <> 'The strip is not ready.' then raise; end if;
  end;
  result := public.lumi_room_action(room_id, host_id, 'finish', null, gen_random_uuid());
  if result->>'state' <> 'complete' then raise exception 'The room never completed.'; end if;

  update public.lumi_rooms set expires_at = clock_timestamp() - interval '1 second' where id = room_id;
  begin
    perform public.lumi_room_action(room_id, host_id, 'sync');
    raise exception 'An expired room remained accessible.';
  exception when raise_exception then
    if sqlerrm <> 'Room unavailable.' then raise; end if;
  end;
end;
$$;
rollback;
