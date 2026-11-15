import assert from 'node:assert/strict';
import test from 'node:test';
import { layouts, sessionReducer } from '../src/context/photoboothSession.js';

function startSession(state = null) {
  return sessionReducer(state, { type: 'start', layout: layouts[0] });
}

test('valid captures fill the layout and extra shots stay in the review collection', () => {
  const session = startSession();
  assert.equal(sessionReducer(session, { type: 'capture', photo: null }), session);

  const captured = sessionReducer(session, { type: 'capture', photo: 'first-photo' });
  assert.deepEqual(captured.photos, ['first-photo']);
  const extra = sessionReducer(captured, { type: 'capture', photo: 'extra-photo' });
  assert.deepEqual(extra.photos, ['first-photo']);
  assert.equal(extra.reviewItems[1].photo, 'extra-photo');
  assert.equal(extra.reviewItems[1].selected, false);
});

test('an edit invalidates a rendered strip', () => {
  const session = startSession();
  const exported = sessionReducer(session, { type: 'export', session, output: 'strip' });
  const edited = sessionReducer(exported, { type: 'edit', changes: { frame: 'new-frame' } });

  assert.equal(exported.output, 'strip');
  assert.equal(edited.frame, 'new-frame');
  assert.equal(edited.output, null);
});

test('finishing or starting a new session discards photos and stale exports', () => {
  const session = sessionReducer(startSession(), { type: 'capture', photo: 'guest-photo' });
  const reset = sessionReducer(session, { type: 'reset' });
  const staleExport = { type: 'export', session, output: 'previous-strip' };
  const nextSession = startSession(reset);

  assert.equal(reset, null);
  assert.equal(sessionReducer(reset, staleExport), null);
  assert.equal(sessionReducer(nextSession, staleExport), nextSession);
  assert.deepEqual(nextSession.photos, []);
});

test('motion results stay with their shot and do not invalidate a concurrent strip export', () => {
  let session = sessionReducer(null, { type: 'start', layout: layouts[4] });
  for (let shot = 1; shot <= 6; shot++) {
    session = sessionReducer(session, {
      type: 'capture',
      photo: `photo-${shot}`,
      motion: shot === 2 ? null : { id: shot, status: 'pending' },
    });
  }
  const exportSnapshot = session;
  session = sessionReducer(session, { type: 'motionResult', id: 6, gif: 'gif-6' });
  session = sessionReducer(session, { type: 'motionResult', id: 3, gif: null });
  assert.equal(session.motions[1], null);
  assert.equal(session.motions[2].status, 'unavailable');
  assert.equal(session.motions[5].gif, 'gif-6');
  assert.equal(sessionReducer(session, { type: 'export', session: exportSnapshot, output: 'strip' }).output, 'strip');
  const discarded = sessionReducer(session, { type: 'discardMotion' });
  assert.equal(discarded.motions[5].gif, null);
  assert.equal(sessionReducer(discarded, { type: 'motionResult', id: 1, gif: 'stale' }), discarded);
  assert.equal(sessionReducer(null, { type: 'motionResult', id: 1, gif: 'stale' }), null);
});

test('review selects and orders a mixed photo pool while preserving motion and design', () => {
  let session = sessionReducer(null, { type: 'start', layout: layouts[1] });
  session = sessionReducer(session, { type: 'changeLayout', layout: layouts[1] });
  session = sessionReducer(session, { type: 'capture', photo: 'camera', motion: { id: 42, status: 'pending' } });
  session = sessionReducer(session, { type: 'addGallery', images: [{ url: 'gallery-1', name: 'One' }, { url: 'gallery-2', name: 'Two' }] });
  assert.deepEqual(session.photos, ['camera', 'gallery-1']);
  session = sessionReducer(session, { type: 'reviewSelect', index: 1 });
  session = sessionReducer(session, { type: 'reviewSelect', index: 2 });
  session = sessionReducer(session, { type: 'reviewMove', index: 2, offset: -1 });
  session = sessionReducer(session, { type: 'reviewMove', index: 1, offset: -1 });
  assert.deepEqual(session.photos, ['gallery-2', 'camera']);
  session = sessionReducer(session, { type: 'motionResult', id: 42, gif: 'camera-motion' });
  assert.equal(session.motions[0], null);
  assert.equal(session.motions[1].gif, 'camera-motion');
  session = sessionReducer(session, { type: 'edit', changes: { caption: 'Keep me', frame: 'custom' } });
  session = sessionReducer(session, { type: 'changeLayout', layout: layouts[0], source: 'gallery' });
  assert.equal(session.caption, 'Keep me');
  assert.equal(session.frame, 'custom');
  assert.equal(session.reviewItems.length, 3);
  assert.deepEqual(session.photos, ['gallery-2']);
  // A late result for a deselected shot must update the pool too.
  session = sessionReducer(session, { type: 'discardMotion' });
  assert.equal(session.reviewItems[1].motion.gif, null);
  session = sessionReducer(session, { type: 'reviewSelect', index: 0 });
  session = sessionReducer(session, { type: 'reviewSelect', index: 1 });
  assert.deepEqual(session.photos, ['camera']);
  assert.equal(session.motions[0].status, 'unavailable');
});

test('gallery suggests a fitting layout until the user chooses one, including five photos', () => {
  let session = sessionReducer(null, { type: 'start', layout: layouts[2] });
  session = sessionReducer(session, { type: 'addGallery', images: Array.from({ length: 5 }, (_, i) => ({url: `photo-${i}`})) });
  assert.equal(session.layout.count, 6);
  assert.equal(session.photos.length, 5);
  session = sessionReducer(session, { type: 'changeLayout', layout: layouts[3] });
  assert.equal(session.photos.length, 4);
  assert.equal(session.reviewItems.length, 5);
  session = sessionReducer(session, { type: 'addGallery', images: [{url: 'another'}] });
  assert.equal(session.layout.count, 4);
  assert.equal(session.reviewItems.length, 6);
});

test('selection follows tap order and Undo restores removed photos and crops', () => {
  let session = sessionReducer(null, { type: 'start', layout: layouts[2] });
  session = sessionReducer(session, { type: 'addGallery', images: [0, 1, 2].map(i => ({url: `photo-${i}`})) });
  session = sessionReducer(session, { type: 'reviewClear' });
  for (const index of [2, 0, 1]) session = sessionReducer(session, { type: 'reviewSelect', index });
  assert.deepEqual(session.photos, ['photo-2', 'photo-0', 'photo-1']);
  session = sessionReducer(session, { type: 'crop', index: 0, crop: {x: .2, y: .4, zoom: 2} });
  session = sessionReducer(session, { type: 'reviewRemove', index: 2 });
  assert.deepEqual(session.photos, ['photo-0', 'photo-1']);
  session = sessionReducer(session, { type: 'undo' });
  assert.deepEqual(session.photos, ['photo-2', 'photo-0', 'photo-1']);
  assert.equal(session.crops[0].zoom, 2);
  session = sessionReducer(session, { type: 'undo' });
  assert.equal(session.crops[0].zoom, 1);
});
