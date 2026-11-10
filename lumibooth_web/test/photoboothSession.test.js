import assert from 'node:assert/strict';
import test from 'node:test';
import { layouts, sessionReducer } from '../src/context/photoboothSession.js';

function startSession(state = null) {
  return sessionReducer(state, { type: 'start', layout: layouts[0] });
}

test('only valid captures fill the selected layout', () => {
  const session = startSession();
  assert.equal(sessionReducer(session, { type: 'capture', photo: null }), session);

  const captured = sessionReducer(session, { type: 'capture', photo: 'first-photo' });
  assert.deepEqual(captured.photos, ['first-photo']);
  assert.equal(sessionReducer(captured, { type: 'capture', photo: 'extra-photo' }), captured);
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
