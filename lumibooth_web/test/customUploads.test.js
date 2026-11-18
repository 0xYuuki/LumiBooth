import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareUpload, uploadedBackgroundStyle } from '../src/context/customUploads.js';

test('the importer rejects spoofed types and oversized images before decoding', async () => {
  const svg = new Blob(['<svg/>'], { type: 'image/png' });
  await assert.rejects(prepareUpload(svg), /still PNG, JPEG, or WebP/);

  const header = new Uint8Array(24);
  header.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const dimensions = new DataView(header.buffer);
  dimensions.setUint32(16, 8192);
  dimensions.setUint32(20, 8192);
  await assert.rejects(prepareUpload(new Blob([header])), /32 megapixels/);
  await assert.rejects(prepareUpload({ size: 20 * 1024 * 1024 + 1 }), /20 MB/);

  dimensions.setUint32(16, 100);
  dimensions.setUint32(20, 100);
  await assert.rejects(prepareUpload(new Blob([header])), /could not be decoded/);
});

test('background styling only accepts embedded raster data and clamps placement', () => {
  assert.deepEqual(uploadedBackgroundStyle({ image: 'https://example.com/remote.png' }), {});
  const style = uploadedBackgroundStyle({ image: 'data:image/png;base64,AAAA', fit: 'contain', x: -8, y: 110 });
  assert.equal(style.backgroundPosition, '0% 100%');
  assert.equal(style.backgroundSize, 'contain');
  assert.equal(style.backgroundRepeat, 'no-repeat');
});
