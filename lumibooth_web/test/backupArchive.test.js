import assert from 'node:assert/strict';
import test from 'node:test';
import { backupName, packWebWork, unpackWork } from '../src/online/backupArchive.js';

const id = '12345678-1234-1234-1234-123456789abc';
const png = new Uint8Array(24);
png.set([137, 80, 78, 71, 13, 10, 26, 10]);
new DataView(png.buffer).setUint32(16, 1);
new DataView(png.buffer).setUint32(20, 1);
const poster = new Blob([png], { type: 'image/png' });

test('web archives preserve stable identity, poster, source photos and edit metadata', async () => {
  const project = {
    version: 1, session: { caption: 'Keepsake', layout: { id: '1-photo' } },
    items: [{ selected: true, crop: { zoom: 2 }, blob: poster }],
  };
  const archive = packWebWork({ poster, project, title: 'Keepsake', createdAt: 123 });
  const restored = await unpackWork(archive, backupName(id));
  assert.equal(restored.id, id);
  assert.equal(restored.createdAt, 123);
  assert.deepEqual(restored.project.session, project.session);
  assert.deepEqual(restored.project.items[0].crop, { zoom: 2 });
  assert.deepEqual(new Uint8Array(await restored.project.items[0].blob.arrayBuffer()), png);
  await assert.rejects(unpackWork(archive.slice(0, -1), backupName(id)), /Incomplete backup/);
  await assert.rejects(unpackWork(archive, '../unexpected.lumi'), /Invalid backup/);
});

test('a Flutter archive restores its poster on the web with the original cloud identity', async () => {
  const nativeEdits = new TextEncoder().encode('{"version":1}');
  const header = new TextEncoder().encode(JSON.stringify({
    version: 1, platform: 'flutter', posterBytes: poster.size, projectBytes: nativeEdits.length, createdAt: 42,
  }));
  const prefix = new DataView(new ArrayBuffer(4));
  prefix.setUint32(0, header.length);
  const name = 'flutter-1700000000000000-0.lumi';
  const restored = await unpackWork(new Blob([prefix, header, poster, nativeEdits]), name);
  assert.equal(backupName(restored.id), name);
  assert.equal(restored.project, null);
  assert.deepEqual(new Uint8Array(await restored.poster.arrayBuffer()), png);
});
