const MAX_PHOTOS = 12;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const MAX_EDGE = 2048;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The image could not be decoded.'));
    image.src = url;
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The image could not be resized.'));
    }, 'image/jpeg', 0.92);
  });
}

async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Unsupported image type.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Image exceeds the 20 MB limit.');

  let url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no pixels.');

    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale < 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare this image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const resized = await canvasBlob(canvas);
      URL.revokeObjectURL(url);
      url = URL.createObjectURL(resized);
    }
    return { name: file.name, url };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function prepareGalleryFiles(fileList) {
  const files = Array.from(fileList);
  if (files.length > MAX_PHOTOS) {
    return { images: [], skipped: files.length, message: 'Choose up to 12 photos at a time.' };
  }

  const images = [];
  let skipped = 0;
  let totalBytes = 0;
  for (const file of files) {
    if (totalBytes + file.size > MAX_TOTAL_BYTES) {
      skipped++;
      continue;
    }
    totalBytes += file.size;
    try {
      images.push(await preparePhoto(file));
    } catch {
      skipped++;
    }
  }
  return { images, skipped };
}

export function releaseGalleryFiles(images) {
  for (const image of images) URL.revokeObjectURL(image.url);
}
