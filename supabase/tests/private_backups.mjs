import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = new URL(process.env.LUMI_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Run with a disposable local Supabase stack.');
const key = process.env.LUMI_TEST_SUPABASE_KEY;
assert.ok(key, 'Set LUMI_TEST_SUPABASE_KEY to the local publishable key.');
const uploads = process.argv.includes('--uploads');
const bucket = uploads ? 'lumi-private-uploads' : 'lumi-private-backups';

async function request(path, { token, body, contentType, upsert, method = 'GET' } = {}) {
  return fetch(new URL(path, url), {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(upsert ? { 'x-upsert': 'true' } : {}),
    },
    body,
  });
}

function json(method, data, token) {
  return { method, contentType: 'application/json', body: JSON.stringify(data), token };
}

async function ok(response) {
  assert.ok(response.ok, `Expected success, got ${response.status}: ${response.ok ? '' : await response.text()}`);
  return response;
}

async function register(account) {
  const body = account ? { email: `${randomUUID()}@example.com`, password: randomUUID() } : {};
  const result = await (await ok(await request('/auth/v1/signup', json('POST', body)))).json();
  assert.ok(result.access_token, 'Local test signup must return a session.');
  return { token: result.access_token, id: result.user.id };
}

const [owner, other, guest] = await Promise.all([register(true), register(true), register(false)]);
const name = `${uploads ? '' : 'web-'}${randomUUID()}.lumi`;
const path = `${owner.id}/${name}`;
const object = `/storage/v1/object/${bucket}/${path}`;
const read = `/storage/v1/object/authenticated/${bucket}/${path}`;
const contents = new Uint8Array([2, 5, 7]);
const list = token => request(`/storage/v1/object/list/${bucket}`, json('POST', { prefix: owner.id }, token));
const upload = (file, token, opts = {}) => request(`/storage/v1/object/${bucket}/${file}`, {
  method: 'POST', body: contents, contentType: 'application/octet-stream', token, ...opts,
});

try {
  assert.equal((await (await ok(await list(owner.token))).json()).length, 0);
  assert.equal((await upload(path, owner.token, { contentType: 'text/plain' })).ok, false);
  assert.equal((await (await ok(await list(owner.token))).json()).length, 0, 'A rejected upload must not create an entry.');
  if (uploads) {
    const tooLarge = new Uint8Array(20 * 1024 * 1024 + 4101);
    assert.equal((await upload(path, owner.token, { body: tooLarge })).ok, false);
    assert.equal((await request(`/storage/v1/object/upload/sign/${bucket}/${path}`,
      json('POST', {}, owner.token))).ok, false, 'Even the owner cannot generate a signed upload URL.');
  }
  await ok(await upload(path, owner.token));
  if (uploads) {
    assert.equal((await request(`/storage/v1/object/sign/${bucket}/${path}`,
      json('POST', { expiresIn: 60 }, owner.token))).ok, false, 'Even the owner cannot generate a signed download URL.');
  }
  assert.equal((await upload(path, owner.token)).ok, false, 'Retry has the same immutable key.');
  assert.equal((await upload(path, owner.token, { upsert: true })).ok, false);
  assert.equal((await upload(path, other.token, { upsert: true })).ok, false);
  assert.equal((await upload(`${owner.id}/nested/${name}`, owner.token)).ok, false);
  assert.equal((await upload(`${owner.id}/invalid.lumi`, owner.token)).ok, false);
  assert.equal((await upload(`${guest.id}/${name}`, guest.token)).ok, false);
  assert.equal((await upload(path, null)).ok, false);
  assert.equal((await request(read, { token: other.token })).ok, false);
  assert.equal((await request(read, { token: guest.token })).ok, false);
  assert.equal((await request(read)).ok, false);
  assert.equal((await request(`/storage/v1/object/public/${bucket}/${path}`)).ok, false);
  assert.equal((await (await ok(await list(other.token))).json()).length, 0);
  await request(object, { method: 'DELETE', token: other.token });
  const restored = await ok(await request(read, { token: owner.token }));
  assert.deepEqual(new Uint8Array(await restored.arrayBuffer()), contents, 'Another account cannot delete or replace the owner’s backup.');
  assert.equal((await (await ok(await list(owner.token))).json()).length, 1);
} finally {
  await ok(await request(`/storage/v1/object/${bucket}`, json('DELETE', { prefixes: [path] }, owner.token)));
}
assert.equal((await (await ok(await list(owner.token))).json()).length, 0);
console.log(`Private ${uploads ? 'upload' : 'strip'} backup authorization, retry, download and deletion passed.`);
