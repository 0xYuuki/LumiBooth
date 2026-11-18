import test from 'node:test';
import assert from 'node:assert/strict';
import { cropGeometry, normalizeCrop } from '../src/pages/user/photoCrop.js';
import { layouts, sessionReducer } from '../src/context/photoboothSession.js';

test('crop fills every aperture and clamps pan and zoom without revealing empty space', () => {
  for (const [iw, ih, w, h] of [[600, 200, 100, 150], [200, 600, 160, 90], [320, 240, 75, 100]]) {
    for (const crop of [{}, { x: -10, y: 8, zoom: 0 }, { x: 1, y: 0, zoom: 3 }]) {
      const rect = cropGeometry(iw, ih, w, h, crop);
      assert.ok(rect.x <= 0 && rect.y <= 0);
      assert.ok(rect.x + rect.width >= w - 1e-8);
      assert.ok(rect.y + rect.height >= h - 1e-8);
    }
  }
  assert.deepEqual(normalizeCrop({ x: NaN, y: Infinity, zoom: -1 }), { x: 0.5, y: 0.5, zoom: 1 });
});

test('crops follow photos through reordering, deselection and layout changes and invalidate exports', () => {
  let state = sessionReducer(null, { type: 'start', layout: layouts[1] });
  state = sessionReducer(state, { type: 'addGallery', images: [{ url: 'a' }, { url: 'b' }] });
  const snapshot = state;
  state = sessionReducer(state, { type: 'crop', index: 0, crop: { x: 0, y: 1, zoom: 2 } });
  assert.equal(sessionReducer(state, { type: 'export', session: snapshot, output: 'stale' }), state);
  state = sessionReducer(state, { type: 'reviewMove', index: 0, offset: 1 });
  assert.deepEqual(state.crops[1], { x: 0, y: 1, zoom: 2 });
  state = sessionReducer(state, { type: 'reviewSelect', index: 1 });
  state = sessionReducer(state, { type: 'reviewSelect', index: 1 });
  state = sessionReducer(state, { type: 'changeLayout', layout: layouts[2] });
  assert.deepEqual(state.crops[1], { x: 0, y: 1, zoom: 2 });
});

test('corner resizing preserves the opposite corner until the frame coverage limit', async () => {
  const { resizeCrop, panCrop } = await import('../src/pages/user/photoCrop.js');
  const initial = { x: .5, y: .5, zoom: 1.5 };
  for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    const before = cropGeometry(600, 400, 200, 200, initial);
    const adjusted = resizeCrop(initial, 600, 400, 200, 200, corner, corner.includes('left') ? -20 : 20, corner.includes('top') ? -20 : 20);
    const after = cropGeometry(600, 400, 200, 200, adjusted);
    assert.ok(after.width > before.width);
    assert.ok(Math.abs((corner.includes('left') ? after.x + after.width : after.x) - (corner.includes('left') ? before.x + before.width : before.x)) < 1e-8);
    assert.ok(Math.abs((corner.includes('top') ? after.y + after.height : after.y) - (corner.includes('top') ? before.y + before.height : before.y)) < 1e-8);
  }
  assert.equal(panCrop(initial, 600, 400, 200, 200, 10000, 0).x, 0);
});

test('full-photo fit preserves all pixels across portrait and landscape openings', () => {
  for (const [imageWidth, imageHeight] of [[600, 200], [200, 600]]) {
    for (const [width, height] of [[150, 200], [200, 150], [200, 200], [150, 200]]) {
      const rect = cropGeometry(imageWidth, imageHeight, width, height, {
        x: 1, y: 0, zoom: 3, contain: true,
      });
      assert.ok(Math.abs(rect.width / rect.height - imageWidth / imageHeight) < 1e-10);
      assert.ok(rect.x >= -1e-10 && rect.y >= -1e-10);
      assert.ok(Math.abs(rect.x + rect.width / 2 - width / 2) < 1e-10);
      assert.ok(Math.abs(rect.y + rect.height / 2 - height / 2) < 1e-10);
    }
  }
});
