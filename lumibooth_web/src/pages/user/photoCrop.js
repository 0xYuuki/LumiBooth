export const defaultCrop = { x: 0.5, y: 0.5, zoom: 1 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function normalizeCrop(crop = {}) {
  const safe = (value, fallback) => Number.isFinite(value) ? value : fallback;
  return { x: clamp(safe(crop.x, 0.5), 0, 1), y: clamp(safe(crop.y, 0.5), 0, 1), zoom: clamp(safe(crop.zoom, 1), 1, 3) };
}
export function cropGeometry(imageWidth, imageHeight, width, height, crop) {
  const { x, y, zoom } = normalizeCrop(crop);
  const ratio = Math.max(width / imageWidth, height / imageHeight) * zoom;
  const w = imageWidth * ratio;
  const h = imageHeight * ratio;
  return { x: (width - w) * x, y: (height - h) * y, width: w, height: h };
}
