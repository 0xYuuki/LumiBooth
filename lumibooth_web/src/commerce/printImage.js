import { normalizeCrop } from '../pages/user/photoCrop.js';

export const defaultPrintCrop = { x: 50, y: 50, zoom: 1 };

export function measurePrintDensity(strip, crops, exportScale) {
  const images = [...strip.querySelectorAll('.photo-aperture > img')];
  const densities = images.map((image, index) => {
    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = image;
    if (!naturalWidth || !naturalHeight || !clientWidth || !clientHeight) return 0;
    const crop = normalizeCrop(crops?.[index]);
    const scales = [clientWidth / naturalWidth, clientHeight / naturalHeight];
    const scale = crop.contain ? Math.min(...scales) : Math.max(...scales) * crop.zoom;
    return 1 / (scale * exportScale);
  });
  return densities.length ? Math.min(1, ...densities) : 0;
}

export function printPlacement(source, product, crop) {
  const { width_px: width, height_px: height } = product;
  const scale = Math.max(width / source.width, height / source.height) * crop.zoom;
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  return { scale, width: drawWidth, height: drawHeight,
    x: (width - drawWidth) * crop.x / 100, y: (height - drawHeight) * crop.y / 100 };
}

export function printQuality(sourceDensity, placement, product) {
  const dpi = sourceDensity > 0 ? Math.floor(product.target_dpi * sourceDensity / placement.scale) : null;
  const belowMinimum = dpi === null || dpi < product.minimum_dpi;
  return { dpi, warning: dpi === null || dpi < product.target_dpi, blocked: belowMinimum && product.low_resolution_policy === 'block' };
}

export function drawPrint(canvas, image, product, crop) {
  canvas.width = product.width_px;
  canvas.height = product.height_px;
  const placement = printPlacement({ width: image.naturalWidth, height: image.naturalHeight }, product, crop);
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
}

export function encodePrint(canvas, limit) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob || blob.type !== 'image/png' || !blob.size) return reject(new Error('Could not prepare the print PNG.'));
    if (blob.size > limit) return reject(new Error('This print file is above the product’s upload limit. Choose another product or edit the strip.'));
    resolve(blob);
  }, 'image/png'));
}
