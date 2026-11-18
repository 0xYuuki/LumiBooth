import { isUploadData } from '../context/customUploads.js';

const uploadId = /^(?:upload-[0-9]{1,20}-[0-9]{1,10}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/;
const maxHeader = 4096;
const maxImage = 20 * 1024 * 1024;
export const maxUploadBackupBytes = maxHeader + 4 + maxImage;

export function uploadBackupName(id) {
  if (!uploadId.test(id)) throw new Error('Invalid upload identifier.');
  return `${id}.lumi`;
}

export function uploadBackupId(name) {
  const id = typeof name === 'string' && name.endsWith('.lumi') ? name.slice(0, -5) : '';
  return uploadId.test(id) ? id : null;
}

function validDetails({ version, name, kind, createdAt, type }) {
  return version === 1 && typeof name === 'string' && name.trim() && name.length <= 64 &&
    (kind === 'sticker' || kind === 'background') &&
    Number.isSafeInteger(createdAt) && createdAt >= 0 && createdAt <= 8640000000000000 &&
    (type === 'image/png' || type === 'image/webp');
}

export function packUploadBackup({ name, kind, createdAt, image }) {
  if (!isUploadData(image)) throw new Error('The local image is unavailable.');
  const [mime, encoded] = image.split(',');
  const type = mime.slice(5, mime.indexOf(';'));
  const details = { version: 1, name, kind, createdAt, type };
  if (!validDetails(details)) throw new Error('The local image is unavailable.');
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  if (bytes.length === 0 || bytes.length > maxImage) throw new Error('The image exceeds the 20 MB backup limit.');
  const header = new TextEncoder().encode(JSON.stringify(details));
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, header.length);
  return new Blob([prefix, header, bytes], { type: 'application/octet-stream' });
}

export async function unpackUploadBackup(blob, fileName) {
  const id = uploadBackupId(fileName);
  if (!id || blob.size < 6 || blob.size > maxUploadBackupBytes) throw new Error('Invalid upload backup.');
  const length = new DataView(await blob.slice(0, 4).arrayBuffer()).getUint32(0);
  if (!length || length > maxHeader || 4 + length >= blob.size || blob.size - 4 - length > maxImage) {
    throw new Error('Invalid upload backup size.');
  }
  const details = JSON.parse(await blob.slice(4, 4 + length).text());
  if (!details || !validDetails(details)) throw new Error('Invalid upload backup details.');
  const { name, kind, createdAt, type } = details;
  const image = blob.slice(4 + length, blob.size, type);
  return { id, name, kind, createdAt, image };
}
