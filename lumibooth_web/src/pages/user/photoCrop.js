export const defaultCrop = { x: 0.5, y: 0.5, zoom: 1 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function normalizeCrop(crop) {
  const safe = (value, fallback) => Number.isFinite(value) ? value : fallback;
  return {
    x: clamp(safe(crop?.x, 0.5), 0, 1), y: clamp(safe(crop?.y, 0.5), 0, 1), zoom: clamp(safe(crop?.zoom, 1), 1, 3),
    ...(crop?.contain === true ? { contain: true } : {}),
  };
}
export function cropGeometry(imageWidth, imageHeight, width, height, crop) {
  const { x, y, zoom, contain } = normalizeCrop(crop);
  const ratio = contain ? Math.min(width / imageWidth, height / imageHeight)
    : Math.max(width / imageWidth, height / imageHeight) * zoom;
  const w = imageWidth * ratio;
  const h = imageHeight * ratio;
  return { x: (width - w) * (contain ? 0.5 : x), y: (height - h) * (contain ? 0.5 : y), width: w, height: h };
}

export function panCrop(crop, imageWidth, imageHeight, width, height, dx, dy) {
  const value = normalizeCrop(crop);
  const rect = cropGeometry(imageWidth, imageHeight, width, height, value);
  return normalizeCrop({ ...value, x: value.x - dx / (rect.width - width || Infinity), y: value.y - dy / (rect.height - height || Infinity) });
}

export function resizeCrop(crop, imageWidth, imageHeight, width, height, corner, dx, dy) {
  const start = cropGeometry(imageWidth, imageHeight, width, height, crop);
  const sx = corner.includes('left') ? -1 : 1;
  const sy = corner.includes('top') ? -1 : 1;
  const factor = 1 + (dx * sx * start.width + dy * sy * start.height) / (start.width ** 2 + start.height ** 2);
  const value = normalizeCrop({ ...crop, zoom: normalizeCrop(crop).zoom * factor });
  const next = cropGeometry(imageWidth, imageHeight, width, height, value);
  const left = sx < 0 ? start.x + start.width - next.width : start.x;
  const top = sy < 0 ? start.y + start.height - next.height : start.y;
  return normalizeCrop({ ...value, x: -left / (next.width - width || Infinity), y: -top / (next.height - height || Infinity) });
}
