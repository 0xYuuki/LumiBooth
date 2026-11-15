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
