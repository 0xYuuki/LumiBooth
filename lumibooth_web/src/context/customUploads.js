const limitBytes = 20 * 1024 * 1024;
const limitPixels = 32_000_000;
const limitSide = 2048;
const kinds = new Set(['sticker', 'background']);

export const uploadDataPattern = /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isUploadData(value) {
  return typeof value === 'string' && value.length <= limitBytes * 4 / 3 + 32 && uploadDataPattern.test(value);
}

function photoDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && str(12, 4) === 'IHDR') {
    for (let i = 8; i + 12 <= bytes.length;) {
      const length = view.getUint32(i);
      if (length > bytes.length - i - 12) break;
      if (str(i + 4, 4) === 'acTL') throw new Error('Animated images are not supported.');
      i += length + 12;
    }
    return [view.getUint32(16), view.getUint32(20), 'image/png'];
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    for (let i = 2; i + 4 < bytes.length && bytes[i] === 255;) {
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 0xda || marker === 0xd9 || i + 2 > bytes.length) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = view.getUint16(i);
      if (length < 2 || i + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        return [view.getUint16(i + 5), view.getUint16(i + 3), 'image/jpeg'];
      }
      i += length;
    }
    throw new Error('The JPEG could not be decoded.');
  }
  if (bytes.length >= 20 && str(0, 4) === 'RIFF' && str(8, 4) === 'WEBP') {
    const chunk = str(12, 4);
    const uint24 = at => bytes[at] + bytes[at + 1] * 256 + bytes[at + 2] * 65536;
    if (chunk === 'VP8X' && bytes.length >= 30) {
      if (bytes[20] & 2) throw new Error('Animated images are not supported.');
      return [1 + uint24(24), 1 + uint24(27), 'image/webp'];
    }
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1, 'image/webp'];
    }
    if (chunk === 'VP8 ' && bytes.length >= 30 && str(23, 3) === '\x9d\x01\x2a') {
      return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff, 'image/webp'];
    }
    throw new Error('The WebP could not be decoded.');
  }
  throw new Error('Choose a still PNG, JPEG, or WebP image.');
}

export async function prepareUpload(file, { preserve = false } = {}) {
  if (!file.size || file.size > limitBytes) throw new Error('Choose an image up to 20 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const [width, height, type] = photoDimensions(bytes);
  if (preserve && (type !== file.type || type === 'image/jpeg')) throw new Error('Invalid backup image type.');
  if (!width || !height || width * height > limitPixels) throw new Error('Choose an image up to 32 megapixels.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type }));
  } catch {
    throw new Error('The image could not be decoded.');
  }
  try {
    if (preserve && Math.max(bitmap.width, bitmap.height) <= limitSide) {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return { image, width: bitmap.width, height: bitmap.height };
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, limitSide / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/webp', 0.94);
    if (!isUploadData(image)) throw new Error('This image could not be saved within the size limit.');
    return { image, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lumibooth-custom-uploads', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('uploads', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('uploads', mode);
      const request = operation(tx.objectStore('uploads'));
      tx.oncomplete = () => resolve(request?.result);
      tx.onabort = () => reject(tx.error ?? new Error('Could not save this change.'));
    });
  } finally {
    db.close();
  }
}

const cleanName = name => name.trim().slice(0, 60) || 'Untitled upload';

export async function addUpload(file, kind) {
  if (!kinds.has(kind)) throw new Error('Invalid upload type.');
  const entry = {
    ...await prepareUpload(file), id: crypto.randomUUID(), kind,
    name: cleanName(file.name.replace(/\.[^.]+$/, '')), createdAt: Date.now(),
  };
  await transact('readwrite', store => store.add(entry));
  return entry;
}

export async function listUploads(kind) {
  const entries = await transact('readonly', store => store.getAll());
  return entries.filter(entry => !kind || entry.kind === kind).sort((a, b) => b.createdAt - a.createdAt);
}

export async function restoreUpload({ id, name, kind, createdAt, image }, confirmAccount) {
  const prepared = await prepareUpload(image, { preserve: true });
  await confirmAccount();
  return transact('readwrite', store => {
    const request = store.get(id);
    let inserted = false;
    request.onsuccess = () => {
      if (!request.result) {
        store.add({ ...prepared, id, name, kind, createdAt });
        inserted = true;
      }
    };
    return { get result() { return inserted; } };
  });
}

export function renameUpload(id, name) {
  return transact('readwrite', store => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, name: cleanName(name) });
    };
  });
}

export function deleteUpload(id) {
  return transact('readwrite', store => store.delete(id));
}

export function uploadedBackgroundStyle(background) {
  if (!isUploadData(background?.image)) return {};
  const position = value => Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
  return {
    backgroundImage: `url("${background.image}")`,
    backgroundSize: background.fit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: `${position(background.x)}% ${position(background.y)}%`,
    backgroundRepeat: 'no-repeat',
  };
}
