alter table lumi_commerce.print_requests
  add column shipping_deadline date,
  add column tracking_reference text check (tracking_reference ~ '^[A-Za-z0-9_-]{1,100}$');

create table lumi_commerce.print_reprints (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references lumi_commerce.print_requests(id),
  retry_key uuid not null,
  quantity integer not null check (quantity between 1 and 50),
  reason text not null check (length(btrim(reason)) between 1 and 300),
  status text not null default 'queued' check (status in ('queued', 'printing', 'completed', 'cancelled')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, retry_key)
);
create unique index print_reprints_one_active on lumi_commerce.print_reprints (request_id)
  where status in ('queued', 'printing');
alter table lumi_commerce.print_reprints enable row level security;
grant select, insert, update on lumi_commerce.print_reprints to service_role;

create function public.lumi_print_v1_staff_queue(
  actor uuid, lookup text, by_sku text, by_status text, from_time timestamptz,
  through_time timestamptz, before_created timestamptz, before_id uuid
) returns setof jsonb language plpgsql stable set search_path = '' as $$
begin
  perform lumi_commerce.require_staff(actor);
  return query
    select (to_jsonb(r) - array['owner_id','receipt_hash','idempotency_key','asset_key','asset_sha','asset_bytes'])
      || jsonb_build_object('orderId', m.order_id)
    from lumi_commerce.print_requests r
    left join lumi_commerce.tiktok_order_matches m on m.request_id = r.id
    where r.finalized_at is not null
      and (lookup is null or r.code = upper(lookup) or m.order_id = lookup)
      and (by_sku is null or r.specification->>'sku' = by_sku)
      and (by_status is null or by_status = case
        when r.status = 'awaiting_marketplace_order' and r.expires_at <= now() then 'expired' else r.status end)
      and (from_time is null or r.created_at >= from_time)
      and (through_time is null or r.created_at < through_time)
      and (before_created is null or (r.created_at, r.id) < (before_created, before_id))
    order by r.created_at desc, r.id desc limit 50;
end;
$$;

create function public.lumi_print_v1_staff_detail(actor uuid, requested uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare payload jsonb;
begin
  perform lumi_commerce.require_staff(actor);
  select jsonb_build_object(
    'request', to_jsonb(r) - array['owner_id','receipt_hash','idempotency_key','asset_key','asset_sha','asset_bytes'],
    'match', to_jsonb(m),
    'fileStatus', case
      when r.status not in ('verified','print_ready','printing','packed','shipped','completed') then 'locked'
      when exists (select 1 from storage.objects where bucket_id = 'lumi-prints' and name = r.asset_key) then 'ready'
      else 'missing' end,
    'reprints', coalesce((select jsonb_agg(to_jsonb(j) - 'retry_key' order by j.created_at desc)
      from lumi_commerce.print_reprints j where j.request_id = r.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from (
      select * from lumi_commerce.print_order_events where request_id = r.id order by id desc limit 100
    ) e), '[]'::jsonb)
  ) into payload
  from lumi_commerce.print_requests r
  left join lumi_commerce.tiktok_order_matches m on m.request_id = r.id
  where r.id = requested and r.finalized_at is not null;
  if payload is null then raise no_data_found using message = 'Print request unavailable.'; end if;
  return payload;
end;
$$;

create function public.lumi_print_v1_staff_attest(
  actor uuid, reference text, seller_order text, seller_line text, compared_sku text,
  compared_variant text, line_units integer, first_unit integer, attested boolean, deadline date
) returns lumi_commerce.print_requests language plpgsql set search_path = '' as $$
declare item lumi_commerce.print_requests;
begin
  item := public.lumi_print_v1_match(
    actor, reference, seller_order, seller_line, compared_sku, compared_variant, line_units, first_unit, attested
  );
  if deadline is not null then
    update lumi_commerce.print_requests set shipping_deadline = deadline where id = item.id returning * into item;
    insert into lumi_commerce.print_order_events (request_id, actor_id, action, detail)
      values (item.id, actor, 'shipping_deadline_recorded', jsonb_build_object('sellerCenterDate', deadline));
  end if;
  return item;
end;
$$;

create function public.lumi_print_v1_staff_progress(
  actor uuid, requested uuid, expected text, next_status text, reason text, tracking text
) returns lumi_commerce.print_requests language plpgsql set search_path = '' as $$
declare item lumi_commerce.print_requests;
begin
  perform lumi_commerce.require_staff(actor);
  select * into item from lumi_commerce.print_requests where id = requested for update;
  if not found then raise no_data_found using message = 'Print request unavailable.'; end if;
  if expected is not null and item.status <> expected then
    raise unique_violation using message = 'The request changed. Refresh it before continuing.';
  end if;
  if tracking is not null and (next_status <> 'shipped' or tracking !~ '^[A-Za-z0-9_-]{1,100}$') then
    raise invalid_parameter_value using message = 'Enter a valid Seller Center tracking reference when recording shipment.';
  end if;
  if next_status in ('print_ready','printing') and item.status in ('verified','print_ready')
    and not exists (select 1 from storage.objects where bucket_id = 'lumi-prints' and name = item.asset_key) then
    raise no_data_found using message = 'The print file is missing.';
  end if;
  if next_status in ('packed','shipped','completed') and exists (
    select 1 from lumi_commerce.print_reprints where request_id = requested and status in ('queued','printing')
  ) then raise unique_violation using message = 'Resolve the active reprint before advancing fulfillment.'; end if;
  item := public.lumi_print_v1_transition(actor, requested, next_status, reason);
  if tracking is not null then
    update lumi_commerce.print_requests set tracking_reference = tracking where id = requested returning * into item;
    insert into lumi_commerce.print_order_events (request_id, actor_id, action, detail)
      values (requested, actor, 'tracking_recorded', jsonb_build_object('reference', tracking, 'source', 'staff'));
  end if;
  if next_status = 'refunded' then
    with cancelled as (
      update lumi_commerce.print_reprints set status = 'cancelled', updated_at = now()
        where request_id = requested and status in ('queued','printing') returning id
    )
    insert into lumi_commerce.print_order_events (request_id, actor_id, action, detail)
      select requested, actor, 'reprint_cancelled', jsonb_build_object('jobId', id, 'reason', 'Order refunded')
      from cancelled;
  end if;
  return item;
end;
$$;

create function public.lumi_print_v1_staff_reprint(
  actor uuid, requested uuid, retry uuid, units integer, explanation text
) returns uuid language plpgsql set search_path = '' as $$
declare
  item lumi_commerce.print_requests;
  job lumi_commerce.print_reprints;
begin
  perform lumi_commerce.require_staff(actor);
  select * into item from lumi_commerce.print_requests where id = requested for update;
  if not found then raise no_data_found using message = 'Print request unavailable.'; end if;
  if retry is null or units is null or units not between 1 and item.quantity
     or length(coalesce(btrim(explanation), '')) not between 1 and 300 then
    raise invalid_parameter_value using message = 'Give a reason and a quantity within the original order.';
  end if;
  select * into job from lumi_commerce.print_reprints where request_id = requested and retry_key = retry;
  if found then
    if job.quantity <> units or job.reason <> btrim(explanation) then
      raise unique_violation using message = 'This reprint retry belongs to a different request.';
    end if;
    return job.id;
  end if;
  if item.status not in ('printing','packed','shipped','completed') then
    raise unique_violation using message = 'Reprints are available once original printing has started.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'lumi-prints' and name = item.asset_key) then
    raise no_data_found using message = 'The print file is missing.';
  end if;
  if exists (select 1 from lumi_commerce.print_reprints where request_id = requested and status in ('queued','printing')) then
    raise unique_violation using message = 'This request already has an active reprint.';
  end if;
  insert into lumi_commerce.print_reprints (request_id, retry_key, quantity, reason, created_by)
    values (requested, retry, units, btrim(explanation), actor) returning * into job;
  insert into lumi_commerce.print_order_events (request_id, actor_id, action, detail)
    values (requested, actor, 'reprint_queued', jsonb_build_object('jobId', job.id, 'quantity', units, 'reason', job.reason));
  return job.id;
end;
$$;

create function public.lumi_print_v1_staff_reprint_update(
  actor uuid, requested uuid, job_id uuid, expected text, next_status text, explanation text
) returns void language plpgsql set search_path = '' as $$
declare
  item lumi_commerce.print_requests;
  job lumi_commerce.print_reprints;
begin
  perform lumi_commerce.require_staff(actor);
  select * into item from lumi_commerce.print_requests where id = requested for update;
  if not found then raise no_data_found using message = 'Print request unavailable.'; end if;
  select * into job from lumi_commerce.print_reprints where id = job_id and request_id = requested for update;
  if not found then raise no_data_found using message = 'Reprint unavailable.'; end if;
  if job.status is distinct from expected or not coalesce(case next_status
    when 'printing' then job.status = 'queued'
    when 'completed' then job.status = 'printing'
    when 'cancelled' then job.status in ('queued','printing')
    else false end, false) then
    raise unique_violation using message = 'The reprint changed. Refresh it before continuing.';
  end if;
  if next_status = 'cancelled' and length(coalesce(btrim(explanation), '')) not between 1 and 300 then
    raise invalid_parameter_value using message = 'Give a short reason for cancelling this reprint.';
  end if;
  if next_status <> 'cancelled' and item.status not in ('printing','packed','shipped','completed') then
    raise unique_violation using message = 'The request is no longer eligible for reprinting.';
  end if;
  if next_status = 'printing' and
    not exists (select 1 from storage.objects where bucket_id = 'lumi-prints' and name = item.asset_key) then
    raise no_data_found using message = 'The print file is missing.';
  end if;
  update lumi_commerce.print_reprints set status = next_status, updated_at = now() where id = job_id;
  insert into lumi_commerce.print_order_events (request_id, actor_id, action, detail)
    values (requested, actor, 'reprint_' || next_status,
      jsonb_strip_nulls(jsonb_build_object('jobId', job_id,
        'reason', case when next_status = 'cancelled' then btrim(explanation) end)));
end;
$$;

do $$
declare routine regprocedure;
begin
  for routine in select oid::regprocedure from pg_proc
    where pronamespace = 'public'::regnamespace and starts_with(proname::text, 'lumi_print_v1_staff_')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', routine);
    execute format('grant execute on function %s to service_role', routine);
  end loop;
end;
$$;
