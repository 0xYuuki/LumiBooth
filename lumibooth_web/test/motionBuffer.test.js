import assert from 'node:assert/strict';
import test from 'node:test';
import { createMotionBuffer } from '../src/motion/motionBuffer.js';

const frame = (time, width = 320) => ({ time, width, height: 240 });

test('the shutter keeps at most five seconds of frames in order and clears the buffer', () => {
  const buffer = createMotionBuffer();
  for (let time = 0; time <= 5375; time += 125) buffer.add(frame(time));
  const { frames: captured, start, end } = buffer.take(5376);

  assert.equal(captured.length, 40);
  assert.equal(captured[0].time, 500);
  assert.equal(captured.at(-1).time, 5375);
  assert.equal(end - start, 5000);
  assert.deepEqual(buffer.take(5500).frames, []);
});

test('expired frames, camera dimension changes, and explicit cleanup discard old motion', () => {
  const buffer = createMotionBuffer();
  buffer.add(frame(10));
  assert.deepEqual(buffer.take(5100).frames, []);
  buffer.add(frame(5200));
  buffer.add(frame(5400, 240));
  assert.equal(buffer.remaining(5500), 4900);
  assert.deepEqual(buffer.take(5500), { frames: [frame(5400, 240)], start: 5400, end: 5500 });
  buffer.add(frame(5600));
  buffer.clear();
  assert.deepEqual(buffer.take(5700).frames, []);
});


test('a frame at the shutter timestamp is excluded', () => {
  const buffer = createMotionBuffer();
  buffer.add(frame(1000));
  buffer.add(frame(1125));
  assert.deepEqual(buffer.take(1125).frames, [frame(1000)]);
});

test('successive shots wait only for missing motion and get the same clip duration', () => {
  const buffer = createMotionBuffer();
  for (const firstSample of [400, 5800]) {
    const pressed = firstSample + 250;
    buffer.add(frame(firstSample));
    assert.equal(buffer.remaining(pressed), 4750);
    const shutter = pressed + buffer.remaining(pressed);
    for (let time = firstSample + 131; time < shutter; time += 131) buffer.add(frame(time));
    const { frames, start, end } = buffer.take(shutter);
    assert.equal(end - start, 5000);
    assert.equal(frames[0].time, firstSample);
    assert.ok(frames.at(-1).time < shutter);
    assert.equal(buffer.remaining(shutter), 5000);
  }
});
