import { applyPalette, GIFEncoder, quantize } from 'gifenc';
self.onmessage = ({ data: { id, clip: { frames, start, end } } }) => {
  try {
    const gif = GIFEncoder();
    frames.forEach(({ width, height, time, data }, index) => {
      const pixels = new Uint8Array(data);
      const palette = quantize(pixels, 256);
      const frameStart = index === 0 ? start : time;
      const frameEnd = frames[index + 1]?.time ?? end;
      const delay = Math.max(1, Math.floor((frameEnd - start) / 10) - Math.floor((frameStart - start) / 10)) * 10;
      gif.writeFrame(applyPalette(pixels, palette), width, height, { palette, delay, repeat: 0 });
    });
    gif.finish();
    self.postMessage({ id, gif: new Blob([gif.bytesView()], { type: 'image/gif' }) });
  } catch {
    self.postMessage({ id, gif: null });
  }
};
