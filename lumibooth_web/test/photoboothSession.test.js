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
