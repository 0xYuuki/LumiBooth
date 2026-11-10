import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { decompressFrames, parseGIF } from 'gifuct-js';
import { motionDuration, motionFrameInterval } from './motionBuffer';

function makeTrack({ bytes, slot }) {
  const frames = decompressFrames(parseGIF(bytes), true);
  const { width, height } = frames[0].dims;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  let duration = 0;
  return {
    canvas, context, slot,
    frames: frames.map((frame) => ({ ...frame, end: duration += frame.delay })),
    get duration() { return duration; },
    previous: null,
  };
}

function paintTrack(context, track, time, overlay, scale) {
  const frame = track.frames.find(({ end }) => end > time);
  if (!frame) return;
  if (track.previous !== frame) {
    const { width, height, left, top } = frame.dims;
    track.context.putImageData(new ImageData(frame.patch, width, height), left, top);
    track.previous = frame;
  }
  const { x, y, width, height, radius, angle, pivotX, pivotY } = track.slot;
  const image = track.canvas;
  const ratio = Math.max(width / image.width, height / image.height);
  context.save();
  context.scale(scale, scale);
  if (angle) {
    context.translate(pivotX, pivotY);
    context.rotate(angle);
    context.translate(-pivotX, -pivotY);
  }
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x + (width - image.width * ratio) / 2,
    y + (height - image.height * ratio) / 2, image.width * ratio, image.height * ratio);
  context.resetTransform();
  context.drawImage(overlay, 0, 0);
  context.restore();
}

self.onmessage = ({ data: { poster, overlay, tracks, width, height, scale } }) => {
  try {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const layer = new OffscreenCanvas(width, height);
    layer.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(overlay), width, height), 0, 0);
    const clips = tracks.map(makeTrack);
    const duration = Math.min(motionDuration, Math.max(...clips.map((clip) => clip.duration)));
    const gif = GIFEncoder();
    for (let time = 0; time < duration; time += motionFrameInterval) {
      context.drawImage(poster, 0, 0, width, height);
      clips.forEach((clip) => paintTrack(context, clip, time, layer, scale));
      const pixels = new Uint8Array(context.getImageData(0, 0, width, height).data.buffer);
      const palette = quantize(pixels, 256);
      const delay = Math.floor(Math.min(time + motionFrameInterval, duration) / 10) * 10 - Math.floor(time / 10) * 10;
      gif.writeFrame(applyPalette(pixels, palette), width, height, { palette, delay: Math.max(10, delay), repeat: 0 });
    }
    gif.finish();
    self.postMessage(new Blob([gif.bytesView()], { type: 'image/gif' }));
  } catch {
    self.postMessage(null);
  } finally {
    poster.close();
  }
};
