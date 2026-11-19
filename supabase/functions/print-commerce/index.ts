import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { PrintError, readBody, validatedPrintPng } from './png.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(30_000) }) },
});
const media = db.storage.from('lumi-prints');
const allowedOrigin = Deno.env.get('LUMI_WEB_ORIGIN');
const enabled = Deno.env.get('LUMI_COMMERCE_ENABLED') === 'true';
const cleanupSecret = Deno.env.get('LUMI_COMMERCE_CLEANUP_SECRET');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const receipt = /^[0-9a-f]{64}$/;

type Specification = {
  max_png_bytes: number;
  width_px: number;
  height_px: number;
  [key: string]: unknown;
};
type PrintRequest = {
  id: string;
  code: string;
  status: string;
  quantity: number;
  specification: Specification;
  expires_at: string;
  created_at: string;
  finalized_at: string | null;
  asset_key: string;
};

function required(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new PrintError(400, 'Invalid request field.');
  return value;
}

function quantity(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 50) {
    throw new PrintError(400, 'Invalid quantity.');
  }
  return value;
}

async function digest(data: BufferSource) {
  const output = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(output)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function receiptHash(value: unknown) {
  if (typeof value !== 'string' || !receipt.test(value)) throw unavailable();
  return digest(new TextEncoder().encode(value));
}

const unavailable = () => new PrintError(404, 'Print request unavailable.');

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(`lumi_print_v1_${name}`, args);
  if (error) {
    switch (error.code) {
      case '42501': throw new PrintError(403, 'Staff access required.');
      case 'P0002': throw unavailable();
      case '23505': throw new PrintError(409, error.message);
      case '22023': throw new PrintError(422, error.message);
      case '54000': throw new PrintError(429, error.message);
      default: throw new PrintError(503, 'Print service is temporarily unavailable.');
    }
  }
  return data as T;
}

async function row(name: string, args: Record<string, unknown>) {
  const data = await rpc<PrintRequest | PrintRequest[] | null>(name, args);
  const item = Array.isArray(data) ? data[0] : data;
  if (!item?.id) throw unavailable();
  return item;
}

async function actor(request: Request, staff = false) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new PrintError(401, 'Sign in to continue.');
  const { data } = await db.auth.getUser(header.slice(7));
  if (!data.user) throw new PrintError(401, 'Session unavailable.');
  if (staff && data.user.is_anonymous !== false) throw new PrintError(403, 'Staff access required.');
  return data.user.id;
}

function summary(item: PrintRequest, staff = false) {
  const expired = ['draft_upload', 'awaiting_marketplace_order'].includes(item.status)
    && Date.parse(item.expires_at) <= Date.now();
  return {
    requestId: item.id, code: item.finalized_at ? item.code : null,
    status: expired ? 'expired' : item.status, quantity: item.quantity,
    specification: item.specification, expiresAt: item.expires_at,
    ...(staff ? { createdAt: item.created_at } : {}),
  };
}

async function json(request: Request): Promise<Record<string, unknown>> {
  const body = await readBody(request, 4096);
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch { /* The same response covers malformed JSON and invalid UTF-8. */ }
  throw new PrintError(400, 'Invalid request.');
}

async function upload(request: Request, url: URL) {
  const id = required(url.searchParams.get('requestId'), uuid);
  const hash = await receiptHash(request.headers.get('x-lumi-receipt'));
  const current = await row('receipt', { request_id: id, receipt: hash });
  if (!current.finalized_at && (current.status !== 'draft_upload' || Date.parse(current.expires_at) <= Date.now())) {
    throw new PrintError(409, 'The upload window has expired.');
  }
  if (request.headers.get('content-type') !== 'image/png') throw new PrintError(415, 'Choose a PNG file.');
  const { max_png_bytes, width_px, height_px } = current.specification;
  const png = await validatedPrintPng(await readBody(request, max_png_bytes), width_px, height_px);
  const sha = await digest(await png.arrayBuffer());
  const key = { request_id: id, receipt: hash, sha };
  const reserved = await row('reserve', { ...key, bytes: png.size });
  if (reserved.finalized_at) return summary(reserved);

  const { error } = await media.upload(reserved.asset_key, png, {
    contentType: 'image/png', cacheControl: '0', upsert: false,
  });
  if (error) {
    const { data: existing } = await media.download(reserved.asset_key);
    if (!existing || existing.size !== png.size || await digest(await existing.arrayBuffer()) !== sha) {
      throw new PrintError(503, 'Upload could not be confirmed. Retry with the same file.');
    }
  }
  return summary(await row('finalize', key));
}

async function cleanup(request: Request) {
  if (!cleanupSecret || request.headers.get('x-lumi-cleanup') !== cleanupSecret) {
    throw new PrintError(403, 'Access denied.');
  }
  const expired = await rpc<{ request_id: string; file_key: string }[]>('expire');
  let removed = 0;
  for (let start = 0; start < expired.length; start += 5) {
    await Promise.all(expired.slice(start, start + 5).map(async ({ request_id, file_key }) => {
      const { error } = await media.remove([file_key]);
      if (error) throw new PrintError(503, 'Cleanup could not be confirmed.');
      await rpc('cleaned', { request_id });
      removed++;
    }));
  }
  return { removed };
}

async function action(name: string, request: Request, url: URL) {
  if (name === 'cleanup') return cleanup(request);
  if (!enabled) throw new PrintError(404, 'Print ordering is unavailable.');
  if (name === 'catalog') {
    const items = await rpc<Record<string, unknown>[]>('catalog');
    return { products: items.map(({ enabled: _enabled, pending_ttl_minutes: _ttl, ...item }) => item) };
  }
  if (name === 'upload') return upload(request, url);
  if (name === 'status') {
    const input = await json(request);
    const hash = await receiptHash(request.headers.get('x-lumi-receipt'));
    return summary(await row('receipt', { request_id: required(input.requestId, uuid), receipt: hash }));
  }
  if (name === 'create') {
    const owner = await actor(request);
    const input = await json(request);
    if (input.consentAccepted !== true) throw new PrintError(422, 'Confirm print upload consent to continue.');
    return summary(await row('create', {
      actor: owner, product: required(input.productId, uuid), units: quantity(input.quantity),
      retry_key: required(input.idempotencyKey, uuid), receipt: await receiptHash(input.receiptToken),
      consent: required(input.consentVersion, /^.{1,80}$/),
    }));
  }
  if (!['staff-list', 'staff-media', 'staff-match', 'staff-transition'].includes(name)) throw unavailable();
  const staff = await actor(request, true);
  const input = await json(request);
  if (name === 'staff-list') {
    const cursor = input.beforeCreated != null || input.beforeId != null;
    const before = cursor ? required(input.beforeCreated, /^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/) : null;
    if (before && !Number.isFinite(Date.parse(before))) throw new PrintError(400, 'Invalid page cursor.');
    const rows = await rpc<PrintRequest[]>('staff_list', {
      actor: staff, before_created: before, before_id: cursor ? required(input.beforeId, uuid) : null,
    });
    return { requests: rows.map(item => summary(item, true)) };
  }
  if (name === 'staff-match') {
    return summary(await row('match', {
      actor: staff, reference: required(input.code, /^[A-Z]{2,5}-[A-F0-9]{12}$/),
      seller_order: required(input.orderId, /^[A-Za-z0-9_-]{1,80}$/),
      seller_line: input.lineId == null ? null : required(input.lineId, /^[A-Za-z0-9_-]{1,80}$/),
      compared_sku: required(input.sku, /^.{1,120}$/), compared_variant: required(input.variant, /^.{1,120}$/),
      line_units: quantity(input.lineQuantity), first_unit: quantity(input.firstUnit ?? 1),
      attested: input.sellerCenterVerified === true,
    }), true);
  }
  const requestId = required(input.requestId, uuid);
  if (name === 'staff-transition') {
    return summary(await row('transition', {
      actor: staff, request_id: requestId, next_status: required(input.status, /^[a-z_]{1,40}$/),
      reason: input.reason == null ? null : required(input.reason, /^.{1,300}$/),
    }), true);
  }
  const file = await rpc<string>('staff_media', { actor: staff, request_id: requestId });
  const { data, error } = await media.download(file);
  if (error || !data) throw unavailable();
  return data;
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, x-lumi-receipt',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  });
  if (origin) {
    if (origin !== allowedOrigin) return new Response(null, { status: 403, headers });
    headers.set('Access-Control-Allow-Origin', origin);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });

  try {
    const url = new URL(request.url);
    const [version, name] = url.pathname.split('/').slice(-2);
    if (version !== 'v1') throw unavailable();
    const result = await action(name, request, url);
    if (result instanceof Blob) {
      headers.set('Content-Type', 'image/png');
      headers.set('Content-Disposition', 'attachment; filename="lumibooth-print.png"');
      return new Response(result, { headers });
    }
    return Response.json(result, { headers });
  } catch (error) {
    if (!(error instanceof PrintError)) console.error('LumiBooth print operation failed');
    return Response.json({ error: error instanceof PrintError ? error.message : 'Print service temporarily unavailable.' }, {
      status: error instanceof PrintError ? error.status : 503, headers,
    });
  }
});
