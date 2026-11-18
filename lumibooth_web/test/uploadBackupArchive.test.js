import test from 'node:test';
import assert from 'node:assert/strict';
import { packUploadBackup, unpackUploadBackup, uploadBackupName } from '../src/online/uploadBackupArchive.js';

test('upload backups share the native archive format and preserve their stable identity', async () => {
  const bytes = Uint8Array.of(137, 80, 78, 71);
  const item = { name: 'Café', kind: 'sticker', createdAt: 1700000000000, image: 'data:image/png;base64,iVBORw==' };
  const header = new TextEncoder().encode('{"version":1,"name":"Café","kind":"sticker","createdAt":1700000000000,"type":"image/png"}');
  const archive = new Blob([Uint8Array.of(0, 0, 0, header.length), header, bytes]);
  const id = 'upload-1700000000000000-3';
  const restored = await unpackUploadBackup(archive, uploadBackupName(id));
  assert.deepEqual({ ...restored, image: undefined }, { ...item, id, image: undefined });
  assert.equal(restored.image.type, 'image/png');
  assert.deepEqual(new Uint8Array(await restored.image.arrayBuffer()), bytes);
  assert.deepEqual(await packUploadBackup(item).arrayBuffer(), await archive.arrayBuffer());
  await assert.rejects(unpackUploadBackup(archive, '../invalid.lumi'));
  await assert.rejects(unpackUploadBackup(archive.slice(0, -bytes.length), uploadBackupName(id)));
});
