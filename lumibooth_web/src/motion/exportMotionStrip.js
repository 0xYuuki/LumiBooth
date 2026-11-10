import { toCanvas } from 'html-to-image';
import { frameLibrary } from '../pages/user/frameLibrary';

function aperture(cell, frame, index) {
  const style = getComputedStyle(cell);
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  const { offsetLeft: left, offsetTop: top } = cell;
  if (!frame.artwork) {
    return { x: left, y: top, width, height, radius: frame.radius ?? 4 };
  }
  const [x, y, w, h, radius] = frame.window;
  return {
    x: left + x * width / 400,
    y: top + y * height / 300,
    width: w * width / 400,
    height: h * height / 300,
    radius: radius * width / 400,
    angle: (index % 2 ? 1 : -1) * (frame.tilt ?? 0) * Math.PI / 180,
    pivotX: left + width / 2,
    pivotY: top + height / 2,
  };
}

export async function exportMotionStrip(strip, session, signal) {
  const { width, height } = strip.getBoundingClientRect();
  const scale = Math.min(2, 480 / width, 960 / height);
  const frame = session.frame ?? frameLibrary.Templates[0];
  const tracks = await Promise.all(session.motions.flatMap((motion, index) => motion?.gif
    ? [motion.gif.arrayBuffer().then((bytes) => ({
        bytes,
        slot: aperture(strip.querySelector(`[data-photo-index="${index}"]`), frame, index),
      }))]
    : []));
  if (!tracks.length) throw new Error('Motion is unavailable.');
  signal.throwIfAborted();
  await document.fonts.ready;
  const layer = await toCanvas(strip, {
    width, height, pixelRatio: scale,
    style: { background: 'transparent', outline: 'none', boxShadow: 'none' },
  });
  signal.throwIfAborted();
  const poster = await createImageBitmap(await (await fetch(session.output, { signal })).blob());
  try {
    const context = layer.getContext('2d');
    const overlay = context.getImageData(0, 0, layer.width, layer.height).data.buffer;
    signal.throwIfAborted();
    const worker = new Worker(new URL('./stripEncoder.worker.js', import.meta.url), { type: 'module' });
    try {
      return await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        worker.onmessage = ({ data }) => data ? resolve(data) : reject(new Error('Could not encode the strip.'));
        worker.onerror = reject;
        worker.postMessage(
          { poster, overlay, tracks, width: layer.width, height: layer.height, scale },
          [poster, overlay, ...tracks.map(({ bytes }) => bytes)],
        );
      });
    } finally {
      worker.terminate();
    }
  } finally {
    poster.close();
  }
}
