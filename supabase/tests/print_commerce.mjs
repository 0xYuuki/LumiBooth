import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

const backend = new URL(process.env.LUMI_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321');
const edge = new URL(process.env.LUMI_TEST_COMMERCE_URL ?? 'http://127.0.0.1:8000/v1/');
assert.ok([backend, edge].every(url => ['localhost', '127.0.0.1'].includes(url.hostname)));
const key = process.env.LUMI_TEST_SUPABASE_KEY;
const adminKey = process.env.LUMI_TEST_SERVICE_ROLE_KEY;
const cleanupKey = process.env.LUMI_COMMERCE_CLEANUP_SECRET;
const container = process.env.LUMI_TEST_DB_CONTAINER ?? 'supabase_db_lumibooth';
assert.ok(key && adminKey && cleanupKey && /^supabase_db_lumibooth(?:-[a-z0-9-]+)?$/.test(container));

async function response(url, { status = 200, headers, ...options } = {}) {
  const result = await fetch(url, { ...options, headers });
  assert.equal(result.status, status, `${url.pathname}: ${result.status === status ? '' : await result.text()}`);
  return result;
}

async function account(anonymous = false) {
  const credentials = anonymous ? {} : { email: `${randomUUID()}@example.com`, password: randomUUID() };
  const result = await response(new URL('/auth/v1/signup', backend), {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
  });
  const data = await result.json();
  assert.ok(data.access_token && data.user.id);
  return { id: data.user.id, token: data.access_token };
}

const seller = await account();
const customer = await account(true);
const unrelated = await account();
const product = randomUUID();
const disabled = randomUUID();
function sql(input) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input, encoding: 'utf8' });
}
sql(`
insert into lumi_commerce.staff_roles (user_id) values ('${seller.id}');
insert into lumi_commerce.print_products
  (id, kind, sku, title, variant, reference_prefix, tiktok_url, width_px, height_px, bleed_px,
    target_dpi, minimum_dpi, low_resolution_policy, max_png_bytes, max_quantity, pending_ttl_minutes,
    consent_version, consent_text, buyer_instructions, enabled)
values
  ('${product}', 'strip', '${product}', 'Test strip', 'Glossy', 'PS',
   'https://www.tiktok.com/test-listing', 2, 1, 0, 300, 200, 'warn', 1024, 3, 20, 'test-v1', 'Test only', 'Test seller instructions', true),
  ('${disabled}', 'strip', '${disabled}', 'Disabled', 'Glossy', 'PS',
   'https://www.tiktok.com/test-listing', 2, 1, 0, 300, 200, 'warn', 1024, 3, 20, 'test-v1', 'Test only', null, false);
`);

async function api(action, { token, receipt, status = 200, json, binary, headers } = {}) {
  const requestHeaders = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(receipt && { 'X-Lumi-Receipt': receipt }),
    'Content-Type': binary ? 'image/png' : 'application/json',
    ...headers,
  };
  const result = await response(new URL(action, edge), {
    status, method: 'POST', headers: requestHeaders, body: binary ?? JSON.stringify(json ?? {}),
  });
  if (result.headers.get('content-type') === 'image/png') return Buffer.from(await result.arrayBuffer());
  return result.json();
}

async function apiStatus(action, json, token) {
  const result = await fetch(new URL(action, edge), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  });
  await result.arrayBuffer();
  return result.status;
}

function chunk(name, data) {
  const typeAndData = Buffer.concat([Buffer.from(name), data]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([size, typeAndData, crc]);
}
function png(red, width = 2, raw = Buffer.of(0, red, 0, 0, red, 0, 0)) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const auth = customer.token;
const staff = seller.token;
const goodPng = png(90);
function intent() {
  return { productId: product, quantity: 1, idempotencyKey: randomUUID(), receiptToken: randomBytes(32).toString('hex'),
    consentVersion: 'test-v1', consentAccepted: true };
}
const create = (draft, status) => api('create', { json: draft, token: auth, status });
const upload = (id, receipt, binary, status) => api(`upload?requestId=${id}`, { receipt, binary, status });
const find = (requestId, receipt, status) => api('status', { receipt, status, json: { requestId } });

const catalog = await api('catalog');
assert.equal(catalog.products.find(item => item.id === product).buyer_instructions, 'Test seller instructions');
assert.ok(!catalog.products.some(item => item.id === disabled));
await api('create', { json: intent(), status: 401 });
await create({ ...intent(), consentAccepted: false }, 422);
await create({ ...intent(), productId: disabled }, 422);

const first = intent();
const [draft, resubmitted] = await Promise.all([create(first), create(first)]);
assert.equal(draft.requestId, resubmitted.requestId);
assert.equal(draft.code, null);
await create({ ...first, quantity: 2 }, 409);
await find(draft.requestId, randomBytes(32).toString('hex'), 404);
await upload(draft.requestId, randomBytes(32).toString('hex'), goodPng, 404);
await upload(draft.requestId, first.receiptToken, goodPng.subarray(0, -1), 422);
await upload(draft.requestId, first.receiptToken, png(90, 3), 422);
await upload(draft.requestId, first.receiptToken, png(90, 2, Buffer.alloc(200)), 422);
await upload(draft.requestId, first.receiptToken, Buffer.alloc(1025), 413);

const reserved = await response(new URL('/rest/v1/rpc/lumi_print_v1_reserve', backend), {
  method: 'POST',
  headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request_id: draft.requestId, receipt: createHash('sha256').update(first.receiptToken).digest('hex'),
    sha: createHash('sha256').update(goodPng).digest('hex'), bytes: goodPng.length,
  }),
});
await reserved.arrayBuffer();
assert.equal((await find(draft.requestId, first.receiptToken)).status, 'draft_upload');
const [ready, retried] = await Promise.all([
  upload(draft.requestId, first.receiptToken, goodPng), upload(draft.requestId, first.receiptToken, goodPng),
]);
assert.match(ready.code, /^PS-[A-F0-9]{12}$/);
assert.equal(ready.code, retried.code);
assert.equal(ready.specification.buyer_instructions, 'Test seller instructions');
assert.equal((await find(draft.requestId, first.receiptToken)).status, 'awaiting_marketplace_order');
await upload(draft.requestId, first.receiptToken, png(120), 409);
await api('staff-list', { token: unrelated.token, status: 403 });
await api('staff-list', { token: auth, status: 403 });
const directRpc = await fetch(new URL('/rest/v1/rpc/lumi_print_v1_staff_detail', backend), {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${staff}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ actor: seller.id, requested: ready.requestId }),
});
assert.ok(!directRpc.ok);
await directRpc.arrayBuffer();
await api('staff-media', { token: staff, json: { requestId: ready.requestId }, status: 404 });
const privateReady = await api('staff-detail', { token: staff, json: { requestId: ready.requestId } });
assert.equal(privateReady.fileStatus, 'locked');
assert.equal(privateReady.match, null);
for (const token of [auth, unrelated.token]) {
  await api('staff-detail', { token, json: { requestId: ready.requestId }, status: 403 });
}
await api('staff-list', { token: staff, json: { fromDate: '2026-02-31' }, status: 400 });
const path = `${ready.requestId}/print.png`;
for (const token of [key, auth, staff]) {
  const result = await fetch(new URL(`/storage/v1/object/authenticated/lumi-prints/${path}`, backend),
    { headers: { apikey: key, ...(token !== key ? { Authorization: `Bearer ${token}` } : {}) } });
  assert.ok(!result.ok);
  await result.arrayBuffer();
}

async function finishedRequest() {
  const draft = intent();
  const pending = await create(draft);
  return upload(pending.requestId, draft.receiptToken, goodPng);
}
const second = await finishedRequest();
const third = await finishedRequest();
const held = await finishedRequest();
await api('staff-transition', { token: staff, json: {
  requestId: held.requestId, status: 'needs_review', reason: 'Order details pending',
}});
const matching = {
  orderId: randomUUID(), lineId: 'line1', sku: product, variant: 'Glossy',
  lineQuantity: 2, firstUnit: 1, sellerCenterVerified: true, shippingDeadline: '2030-12-31',
};
await api('staff-match', { token: staff, json: { ...matching, code: ready.code, sellerCenterVerified: false }, status: 422 });
await api('staff-match', { token: staff, json: { ...matching, code: ready.code, variant: 'Matte' }, status: 422 });
await api('staff-match', { token: unrelated.token, json: { ...matching, code: ready.code }, status: 403 });
await api('staff-transition', { token: staff, json: { requestId: ready.requestId, status: 'printing' }, status: 409 });
const statuses = await Promise.all([ready, second].map(candidate =>
  apiStatus('staff-match', { ...matching, code: candidate.code }, staff)));
assert.deepEqual([...statuses].sort(), [200, 409]);
const matched = [ready, second][statuses.indexOf(200)];
const abandoned = [ready, second][statuses.indexOf(409)];
await api('staff-match', { token: staff, json: { ...matching, firstUnit: 2, code: third.code } });
await api('staff-match', { token: staff, json: { ...matching, firstUnit: 2, code: abandoned.code }, status: 409 });
assert.deepEqual(await api('staff-media', { token: staff, json: { requestId: matched.requestId } }), goodPng);
await api('staff-media', { token: unrelated.token, json: { requestId: matched.requestId }, status: 403 });
await api('staff-transition', { token: staff, json: { requestId: matched.requestId, status: 'print_ready' } });
await api('staff-transition', { token: staff, json: { requestId: matched.requestId, status: 'printing' } });

sql(`update lumi_commerce.print_requests set expires_at = now() - interval '10 minutes'
  where id in ('${abandoned.requestId}', '${matched.requestId}', '${held.requestId}');`);
await api('cleanup', { status: 403 });
await api('cleanup', { headers: { 'X-Lumi-Cleanup': cleanupKey } });
await api('cleanup', { headers: { 'X-Lumi-Cleanup': cleanupKey } });
const { requests } = await api('staff-list', { token: staff });
assert.equal(requests.find(item => item.requestId === abandoned.requestId).status, 'expired');
assert.equal(requests.find(item => item.requestId === matched.requestId).status, 'printing');
assert.equal(requests.find(item => item.requestId === held.requestId).status, 'needs_review');
const status = sql(`select case when exists (
    select 1 from storage.objects where bucket_id = 'lumi-prints' and name = '${abandoned.requestId}/print.png'
  ) then 'file_remains' else 'file_removed' end;`);
assert.match(status, /file_removed/);
assert.deepEqual(await api('staff-media', { token: staff, json: { requestId: matched.requestId } }), goodPng);
await api('staff-match', { token: staff, json: { ...matching, orderId: randomUUID(), code: held.code } });
const detail = () => api('staff-detail', { token: staff, json: { requestId: matched.requestId } });
const ship = (status, expectedStatus, rest = {}, code = 200) => api('staff-transition', {
  token: staff, json: { requestId: matched.requestId, status, expectedStatus, ...rest }, status: code,
});
const queue = json => api('staff-list', { token: staff, json });
const state = await detail();
assert.equal(state.fileStatus, 'ready');
assert.equal(state.match.order_id, matching.orderId);
assert.equal(state.match.verified_by, seller.id);
assert.equal(state.request.shippingDeadline, matching.shippingDeadline);
assert.ok(state.events.some(event => event.action === 'shipping_deadline_recorded'));
assert.ok(!JSON.stringify(state).includes('asset_key'));
assert.ok(!JSON.stringify(state).includes('receipt_hash'));
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', dateStyle: 'short' })
  .format(new Date(state.request.createdAt));
assert.deepEqual((await queue({
  lookup: matching.orderId, sku: product, status: 'printing', fromDate: localDate, throughDate: localDate,
})).requests.map(item => item.requestId), [matched.requestId]);
assert.deepEqual((await queue({ lookup: matched.code.toLowerCase() })).requests.map(item => item.requestId), [matched.requestId]);
assert.deepEqual((await queue({ lookup: matched.code, beforeCreated: state.request.createdAt,
  beforeId: matched.requestId })).requests, []);
assert.deepEqual((await queue({ lookup: 'DOES-NOT-EXIST' })).requests, []);
await ship('packed', 'verified', {}, 409);

const job = { requestId: matched.requestId, retryKey: randomUUID(), quantity: 1, reason: 'Print quality check' };
await api('staff-reprint', { token: unrelated.token, json: job, status: 403 });
const duplicates = await Promise.all([1, 2].map(() => api('staff-reprint', { token: staff, json: job })));
assert.equal(duplicates[0].jobId, duplicates[1].jobId);
assert.equal((await detail()).reprints.length, 1);
await api('staff-reprint', { token: staff, json: { ...job, retryKey: randomUUID() }, status: 409 });
await ship('packed', 'printing', {}, 409);
const updateReprint = (jobId, status, expectedStatus) => api('staff-reprint-update', {
  token: staff, json: { jobId, requestId: matched.requestId, status, expectedStatus },
});
await updateReprint(duplicates[0].jobId, 'printing', 'queued');
await updateReprint(duplicates[0].jobId, 'completed', 'printing');
assert.equal((await detail()).request.status, 'printing');
await ship('packed', 'printing');
await ship('shipped', 'packed', { trackingReference: 'TEST-TRACK-001' });
await ship('completed', 'shipped');
const shipped = await detail();
assert.equal(shipped.request.trackingReference, 'TEST-TRACK-001');
assert.ok(shipped.events.some(event => event.action === 'tracking_recorded' && event.actor_id === seller.id));
const refundJob = await api('staff-reprint', { token: staff, json: { ...job, retryKey: randomUUID() } });
await ship('refunded', 'completed', { reason: 'Seller Center refund confirmed' });
const refunded = await detail();
assert.equal(refunded.fileStatus, 'locked');
assert.equal(refunded.reprints.find(item => item.id === refundJob.jobId).status, 'cancelled');
assert.ok(refunded.events.some(event => event.action === 'reprint_cancelled' && event.detail.jobId === refundJob.jobId));
await api('staff-media', { token: staff, json: { requestId: matched.requestId }, status: 404 });

const removed = await response(new URL('/storage/v1/object/lumi-prints', backend), {
  method: 'DELETE', headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefixes: [`${third.requestId}/print.png`] }),
});
await removed.arrayBuffer();
const missing = await api('staff-detail', { token: staff, json: { requestId: third.requestId } });
assert.equal(missing.fileStatus, 'missing');
const missingRelease = await api('staff-transition', { token: staff, status: 404,
  json: { requestId: third.requestId, expectedStatus: 'verified', status: 'print_ready' },
});
assert.equal(missingRelease.error, 'The print file is missing.');

console.log('Commerce lifecycle, private receipts, matching, queue filters, tracking, reprints, refund and cleanup passed.');
