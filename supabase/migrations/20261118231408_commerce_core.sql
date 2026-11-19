create schema lumi_commerce;
revoke all on schema lumi_commerce from public, anon, authenticated;
grant usage on schema lumi_commerce to service_role;

create table lumi_commerce.print_products (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind ~ '^[a-z][a-z0-9_]{0,39}$'),
  sku text not null unique check (length(sku) between 1 and 120),
  title text not null check (length(title) between 1 and 120),
  variant text not null check (length(variant) between 1 and 120),
  reference_prefix text not null check (reference_prefix ~ '^[A-Z]{2,5}$'),
  tiktok_url text not null check (
    tiktok_url ~ '^https://([a-z0-9-]+[.])*tiktok[.]com/[^[:space:]]+$'
    and length(tiktok_url) <= 2048
  ),
  width_px integer not null check (width_px between 1 and 8192),
  height_px integer not null check (height_px between 1 and 8192),
  check (width_px::bigint * height_px <= 12000000),
  bleed_px integer not null check (bleed_px >= 0 and bleed_px * 2 < least(width_px, height_px)),
  target_dpi integer not null check (target_dpi between 1 and 1200),
  minimum_dpi integer not null check (minimum_dpi between 1 and target_dpi),
  low_resolution_policy text not null check (low_resolution_policy in ('warn', 'block')),
  max_png_bytes integer not null check (max_png_bytes between 1 and 8388608),
  max_quantity integer not null check (max_quantity between 1 and 50),
  pending_ttl_minutes integer not null check (pending_ttl_minutes between 5 and 10080),
  consent_version text not null check (length(consent_version) between 1 and 80),
  consent_text text not null check (length(consent_text) between 1 and 2000),
  enabled boolean not null default false
);

create table lumi_commerce.print_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  idempotency_key uuid not null,
  unique (owner_id, idempotency_key),
  receipt_hash text not null unique check (receipt_hash ~ '^[0-9a-f]{64}$'),
  code text not null unique,
  product_id uuid not null references lumi_commerce.print_products(id),
  specification jsonb not null,
  quantity integer not null check (quantity between 1 and 50),
  consent_version text not null,
  asset_key text generated always as (id::text || '/print.png') stored,
  asset_sha text check (asset_sha ~ '^[0-9a-f]{64}$'),
  asset_bytes integer check (asset_bytes between 1 and 8388608),
  check ((asset_sha is null) = (asset_bytes is null)),
  status text not null default 'draft_upload' check (status in (
    'draft_upload', 'awaiting_marketplace_order', 'needs_review', 'verified',
    'print_ready', 'printing', 'packed', 'shipped', 'completed', 'cancelled', 'refunded', 'expired'
  )),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  cleaned_at timestamptz,
  check (status in ('draft_upload', 'expired') or finalized_at is not null)
);
create index print_requests_pending_expiry on lumi_commerce.print_requests (expires_at)
  where status in ('draft_upload', 'awaiting_marketplace_order', 'expired') and cleaned_at is null;
create index print_requests_staff_page on lumi_commerce.print_requests (created_at desc, id desc)
  where finalized_at is not null;

create table lumi_commerce.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true
);

create table lumi_commerce.tiktok_order_matches (
  request_id uuid primary key references lumi_commerce.print_requests(id),
  order_id text not null,
  line_id text,
  allocation_start integer not null check (allocation_start between 1 and 50),
  quantity integer not null check (quantity between 1 and 50),
  verified_line_quantity integer not null check (verified_line_quantity between 1 and 50),
  check (allocation_start + quantity - 1 <= verified_line_quantity),
  verified_by uuid not null,
  verified_at timestamptz not null default now()
);
create index tiktok_order_matches_order on lumi_commerce.tiktok_order_matches (order_id, line_id);

create table lumi_commerce.print_order_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references lumi_commerce.print_requests(id),
  actor_id uuid,
  action text not null,
  detail jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index print_order_events_request on lumi_commerce.print_order_events (request_id, id);
alter table lumi_commerce.print_products enable row level security;
alter table lumi_commerce.print_requests enable row level security;
alter table lumi_commerce.staff_roles enable row level security;
alter table lumi_commerce.tiktok_order_matches enable row level security;
alter table lumi_commerce.print_order_events enable row level security;

grant select on lumi_commerce.print_products, lumi_commerce.staff_roles to service_role;
grant select, insert, update on lumi_commerce.print_requests to service_role;
grant select, insert on lumi_commerce.tiktok_order_matches, lumi_commerce.print_order_events to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lumi-prints', 'lumi-prints', false, 8388608, array['image/png']);
create policy "Lumi print media is server-only" on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'lumi-prints') with check (bucket_id <> 'lumi-prints');

create function lumi_commerce.require_staff(actor uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from lumi_commerce.staff_roles where user_id = actor and active) then
    raise insufficient_privilege using message = 'Staff access required.';
  end if;
end;
$$;
revoke all on function lumi_commerce.require_staff(uuid) from public, anon, authenticated;
grant execute on function lumi_commerce.require_staff(uuid) to service_role;

create function public.lumi_print_v1_catalog() returns setof lumi_commerce.print_products
language sql stable set search_path = '' as $$
  select * from lumi_commerce.print_products where enabled order by title, variant, id;
$$;

create function public.lumi_print_v1_create(
  actor uuid, retry_key uuid, receipt text, product uuid, units integer, consent text
) returns lumi_commerce.print_requests
language plpgsql set search_path = '' as $$
declare
  request lumi_commerce.print_requests;
  item lumi_commerce.print_products;
  reference_collision text;
begin
  if actor is null or retry_key is null or receipt is null or units is null then
    raise invalid_parameter_value using message = 'Print request fields are required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('lumi-print-owner:' || actor::text, 0));
  select * into request from lumi_commerce.print_requests
    where owner_id = actor and idempotency_key = retry_key;
  if found then
    if request.product_id is distinct from product or request.quantity is distinct from units
       or request.consent_version is distinct from consent or request.receipt_hash <> receipt then
      raise unique_violation using message = 'This retry key belongs to a different request.';
    end if;
    return request;
  end if;
  select * into item from lumi_commerce.print_products where id = product and enabled;
  if not found or consent is distinct from item.consent_version or units not between 1 and item.max_quantity then
    raise invalid_parameter_value using message = 'The selected product, quantity or consent version is unavailable.';
  end if;
  if (select count(*) from lumi_commerce.print_requests
      where owner_id = actor and status in ('draft_upload', 'awaiting_marketplace_order') and expires_at > now()) >= 8 then
    raise program_limit_exceeded using message = 'Too many pending print requests.';
  end if;
  for attempt in 1..5 loop
    begin
      insert into lumi_commerce.print_requests
        (owner_id, idempotency_key, receipt_hash, code, product_id, specification, quantity, consent_version, expires_at)
      values (actor, retry_key, receipt,
        item.reference_prefix || '-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 12)),
        item.id, to_jsonb(item) - array['enabled', 'pending_ttl_minutes'], units,
        item.consent_version, now() + make_interval(mins => item.pending_ttl_minutes))
      returning * into request;
      insert into lumi_commerce.print_order_events (request_id, actor_id, action)
        values (request.id, actor, 'upload_consented');
      return request;
    exception when unique_violation then
      get stacked diagnostics reference_collision = constraint_name;
      if reference_collision <> 'print_requests_code_key' then raise; end if;
    end;
  end loop;
  raise unique_violation using message = 'Could not allocate a print reference. Try again.';
end;
$$;

create function public.lumi_print_v1_receipt(request_id uuid, receipt text) returns lumi_commerce.print_requests
language sql stable set search_path = '' as $$
  select * from lumi_commerce.print_requests where id = request_id and receipt_hash = receipt;
$$;

create function public.lumi_print_v1_reserve(request_id uuid, receipt text, sha text, bytes integer)
returns lumi_commerce.print_requests language plpgsql set search_path = '' as $$
declare request lumi_commerce.print_requests;
begin
  select * into request from lumi_commerce.print_requests
    where id = request_id and receipt_hash = receipt for update;
  if not found then raise no_data_found using message = 'Print request unavailable.'; end if;
  if request.asset_sha is not null and (request.asset_sha is distinct from sha or request.asset_bytes is distinct from bytes) then
    raise unique_violation using message = 'This request already has a different print file.';
  end if;
  if request.finalized_at is not null then return request; end if;
  if request.status <> 'draft_upload' or request.expires_at <= now() then
    raise invalid_parameter_value using message = 'The upload window has expired.';
  end if;
  if not exists (select 1 from lumi_commerce.print_products where id = request.product_id and enabled) then
    raise invalid_parameter_value using message = 'The selected product is no longer available.';
  end if;
  if sha is null or bytes is null or bytes not between 1 and (request.specification->>'max_png_bytes')::integer then
    raise invalid_parameter_value using message = 'Invalid print file size.';
  end if;
  if request.asset_sha is null then
    update lumi_commerce.print_requests set asset_sha = sha, asset_bytes = bytes where id = request_id
      returning * into request;
  end if;
  return request;
end;
$$;

create function public.lumi_print_v1_finalize(request_id uuid, receipt text, sha text)
returns lumi_commerce.print_requests language plpgsql set search_path = '' as $$
declare request lumi_commerce.print_requests;
begin
  select * into request from lumi_commerce.print_requests
    where id = request_id and receipt_hash = receipt for update;
  if not found then raise no_data_found using message = 'Print request unavailable.'; end if;
  if request.asset_sha is null or request.asset_sha is distinct from sha then
    raise unique_violation using message = 'The print file has not been reserved.';
  end if;
  if request.finalized_at is not null then return request; end if;
  if request.status <> 'draft_upload' or request.expires_at <= now() then
    raise invalid_parameter_value using message = 'The upload window has expired.';
  end if;
  if not exists (select 1 from storage.objects
      where bucket_id = 'lumi-prints' and name = request.asset_key
        and metadata->>'mimetype' = 'image/png' and metadata->>'size' = request.asset_bytes::text) then
    raise no_data_found using message = 'The print file is unavailable.';
  end if;
  update lumi_commerce.print_requests set status = 'awaiting_marketplace_order', finalized_at = now()
    where id = request_id returning * into request;
  insert into lumi_commerce.print_order_events (request_id, actor_id, action)
    values (request.id, request.owner_id, 'file_finalized');
  return request;
end;
$$;

create function public.lumi_print_v1_match(
  actor uuid, reference text, seller_order text, seller_line text, compared_sku text,
  compared_variant text, line_units integer, first_unit integer, attested boolean
) returns lumi_commerce.print_requests language plpgsql set search_path = '' as $$
declare request lumi_commerce.print_requests;
begin
  perform lumi_commerce.require_staff(actor);
  if attested is distinct from true or seller_order is null or seller_order !~ '^[A-Za-z0-9_-]{1,80}$'
     or (seller_line is not null and seller_line !~ '^[A-Za-z0-9_-]{1,80}$')
     or line_units is null or line_units not between 1 and 50
     or first_unit is null or first_unit not between 1 and 50 then
    raise invalid_parameter_value using message = 'Record the verified order and confirm Seller Center verification.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('lumi-print-order:' || seller_order, 0));
  select * into request from lumi_commerce.print_requests where code = reference for update;
  if not found then raise no_data_found using message = 'Print request unavailable.'; end if;
  if request.status not in ('awaiting_marketplace_order','needs_review')
     or request.finalized_at is null
     or (request.status = 'awaiting_marketplace_order' and request.expires_at <= now()) then
    raise unique_violation using message = 'The request is not available to match.';
  end if;
  if (request.specification->>'sku') is distinct from compared_sku
     or (request.specification->>'variant') is distinct from compared_variant
     or first_unit + request.quantity - 1 > line_units
     or (seller_line is null and (first_unit <> 1 or request.quantity <> line_units)) then
    raise invalid_parameter_value using message = 'The verified SKU, variant or quantity does not match.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'lumi-prints' and name = request.asset_key) then
    raise no_data_found using message = 'The print file is unavailable.';
  end if;
  if exists (
    select 1 from lumi_commerce.tiktok_order_matches m
    join lumi_commerce.print_requests previous on previous.id = m.request_id
    where m.order_id = seller_order and (
      seller_line is null or m.line_id is null or (
        m.line_id = seller_line and (
          m.verified_line_quantity <> line_units
          or previous.specification->>'sku' is distinct from compared_sku
          or previous.specification->>'variant' is distinct from compared_variant
          or int4range(m.allocation_start, m.allocation_start + m.quantity)
            && int4range(first_unit, first_unit + request.quantity)
        )
      )
    )
  ) then
    raise unique_violation using message = 'This order or item allocation is already in use.';
  end if;
  insert into lumi_commerce.tiktok_order_matches
    (request_id, order_id, line_id, allocation_start, quantity, verified_line_quantity, verified_by)
    values (request.id, seller_order, seller_line, first_unit, request.quantity, line_units, actor);
  update lumi_commerce.print_requests set status = 'verified' where id = request.id returning * into request;
  insert into lumi_commerce.print_order_events (request_id, actor_id, action, detail)
    values (request.id, actor, 'seller_center_attested', jsonb_build_object('source', 'staff'));
  return request;
end;
$$;

create function public.lumi_print_v1_transition(actor uuid, request_id uuid, next_status text, reason text)
returns lumi_commerce.print_requests language plpgsql set search_path = '' as $$
declare request lumi_commerce.print_requests;
begin
  perform lumi_commerce.require_staff(actor);
  select * into request from lumi_commerce.print_requests where id = request_id for update;
  if not found then raise no_data_found using message = 'Print request unavailable.'; end if;
  if not coalesce(case next_status
    when 'needs_review' then request.status = 'awaiting_marketplace_order' and request.expires_at > now()
    when 'print_ready' then request.status = 'verified'
    when 'printing' then request.status = 'print_ready'
    when 'packed' then request.status = 'printing'
    when 'shipped' then request.status = 'packed'
    when 'completed' then request.status = 'shipped'
    when 'cancelled' then request.status in ('awaiting_marketplace_order', 'needs_review', 'verified', 'print_ready')
    when 'refunded' then request.status in ('verified','print_ready','printing','packed','shipped','completed')
    else false end, false) then
    raise unique_violation using message = 'This status change is unavailable.';
  end if;
  if length(coalesce(reason, '')) > 300 or
     (next_status in ('needs_review','cancelled','refunded') and nullif(btrim(reason), '') is null) then
    raise invalid_parameter_value using message = 'Give a short reason for this status change.';
  end if;
  update lumi_commerce.print_requests set status = next_status where id = request_id returning * into request;
  insert into lumi_commerce.print_order_events (request_id, actor_id, action, detail)
    values (request_id, actor, next_status, jsonb_strip_nulls(jsonb_build_object('reason', reason)));
  return request;
end;
$$;

create function public.lumi_print_v1_staff_list(actor uuid, before_created timestamptz, before_id uuid)
returns setof lumi_commerce.print_requests language plpgsql stable set search_path = '' as $$
begin
  perform lumi_commerce.require_staff(actor);
  return query select * from lumi_commerce.print_requests r
    where r.finalized_at is not null and (
      before_created is null or (r.created_at, r.id) < (before_created, before_id)
    ) order by r.created_at desc, r.id desc limit 50;
end;
$$;

create function public.lumi_print_v1_staff_media(actor uuid, request_id uuid)
returns text language plpgsql volatile set search_path = '' as $$
declare file_key text;
begin
  perform lumi_commerce.require_staff(actor);
  select asset_key into file_key from lumi_commerce.print_requests
    where id = request_id and status in ('verified','print_ready','printing','packed','shipped','completed') for share;
  if file_key is null then raise no_data_found using message = 'Print file unavailable.'; end if;
  insert into lumi_commerce.print_order_events (request_id, actor_id, action)
    values (request_id, actor, 'staff_file_access_authorized');
  return file_key;
end;
$$;

create function public.lumi_print_v1_expire()
returns table (request_id uuid, file_key text) language plpgsql set search_path = '' as $$
begin
  return query
    with due as (
      select id from lumi_commerce.print_requests
      where status in ('draft_upload', 'awaiting_marketplace_order') and expires_at <= now()
      order by expires_at limit 50 for update skip locked
    ), expired as (
      update lumi_commerce.print_requests r set status = 'expired'
      from due where r.id = due.id returning r.id
    ), logged as (
      insert into lumi_commerce.print_order_events (request_id, action)
      select id, 'expired' from expired returning 1
    )
    select r.id, r.asset_key from lumi_commerce.print_requests r
      where r.status = 'expired' and r.cleaned_at is null and r.expires_at <= now() - interval '5 minutes'
      order by r.expires_at limit 50;
end;
$$;

create function public.lumi_print_v1_cleaned(request_id uuid)
returns void language sql set search_path = '' as $$
  update lumi_commerce.print_requests set cleaned_at = now()
    where id = request_id and status = 'expired' and cleaned_at is null;
$$;

-- Keep the Edge RPCs callable only by its server-side key.
do $$
declare routine regprocedure;
begin
  for routine in select oid::regprocedure from pg_proc
    where pronamespace = 'public'::regnamespace and proname like 'lumi_print_v1_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', routine);
    execute format('grant execute on function %s to service_role', routine);
  end loop;
end;
$$;
