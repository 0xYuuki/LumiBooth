import { isUploadData } from '../context/customUploads.js';

export const maxBackupBytes = 24 * 1024 * 1024;
const maxHeaderBytes = 128 * 1024;
const uuid = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
export const backupNamePattern = new RegExp(`^(web-${uuid}|flutter-[0-9]{1,20}-[0-9]{1,10})\\.lumi$`);
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

export function backupName(id) {
  const existing = `${id}.lumi`;
  return backupNamePattern.test(existing) ? existing : `web-${id}.lumi`;
}

export function restoredWebId(name) {
  if (!backupNamePattern.test(name)) throw new Error('Invalid backup name.');
  return name.replace(/^web-/, '').slice(0, -5);
}

function mapUploadImages(session, map) {
  const result = { ...session };
  if (session.background?.image != null) {
    result.background = { ...session.background, image: map(session.background.image) };
  }
  if (Array.isArray(session.stickers)) {
    result.stickers = session.stickers.map(sticker => sticker.art?.image != null
      ? { ...sticker, art: { ...sticker.art, image: map(sticker.art.image) } }
      : sticker);
  }
  return result;
}

async function dataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 16384) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
  }
  return `data:${blob.type};base64,${btoa(chunks.join(''))}`;
}

export function packWebWork({ poster, project, title, createdAt }) {
  if (!(poster instanceof Blob) || poster.size === 0) throw new Error('The local strip image is unavailable.');
  const sources = [];
  const uploads = [];
  const references = new Map();
  const session = project && mapUploadImages(project.session, image => {
    if (references.has(image)) return references.get(image);
    if (!isUploadData(image)) throw new Error('A custom image is unavailable.');
    const [header, encoded] = image.split(',');
    const type = header.slice(5, header.indexOf(';'));
    const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
    const index = uploads.length;
    uploads.push(new Blob([bytes], { type }));
    references.set(image, index);
    return index;
  });
  const edits = project ? {
    version: project.version,
    session,
    items: project.items.map(({ blob, ...item }) => {
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error('A source photo is unavailable.');
      sources.push(blob);
      return { ...item, bytes: blob.size, type: blob.type };
    }),
    ...(uploads.length ? { uploads: uploads.map(blob => ({ bytes: blob.size, type: blob.type })) } : {}),
  } : null;
  const header = new TextEncoder().encode(JSON.stringify({
    version: 1, platform: 'web', title, createdAt, posterBytes: poster.size, edits,
  }));
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, header.byteLength);
  const archive = new Blob([prefix, header, poster, ...sources, ...uploads], { type: 'application/octet-stream' });
  if (header.byteLength > maxHeaderBytes || archive.size > maxBackupBytes) {
    throw new Error('This strip exceeds the 24 MB backup limit.');
  }
  return archive;
}

export async function unpackWork(archive, name) {
  if (!backupNamePattern.test(name) || archive.size < 28 || archive.size > maxBackupBytes) throw new Error('Invalid backup.');
  const headerBytes = new DataView(await archive.slice(0, 4).arrayBuffer()).getUint32(0);
  if (!headerBytes || headerBytes > maxHeaderBytes || headerBytes + 4 >= archive.size) throw new Error('Invalid backup header.');
  const header = JSON.parse(await archive.slice(4, 4 + headerBytes).text());
  let offset = 4 + headerBytes;
  const take = (length, type) => {
    if (!Number.isSafeInteger(length) || length < 1 || length > archive.size - offset) throw new Error('Incomplete backup.');
    const part = archive.slice(offset, offset + length, type);
    offset += length;
    return part;
  };
  if (header.version !== 1 || !['flutter', 'web'].includes(header.platform)) throw new Error('Unsupported backup.');
  const poster = take(header.posterBytes, 'image/png');
  const png = new Uint8Array(await poster.slice(0, 24).arrayBuffer());
  if (png.length !== 24 || !pngSignature.every((byte, index) => png[index] === byte)) throw new Error('Invalid strip PNG.');
  const dimensions = new DataView(png.buffer);
  const width = dimensions.getUint32(16), height = dimensions.getUint32(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 24e6) throw new Error('Unsupported strip dimensions.');
  let project = null;
  if (header.platform === 'web' && header.edits != null) {
    const edits = header.edits;
    if (edits.version !== 1 || !edits.session || !Array.isArray(edits.items) || edits.items.length > 12) {
      throw new Error('Invalid editable project.');
    }
    const items = edits.items.map(({ bytes, type, ...item }) => {
      if (!/^image\/(png|jpeg|webp)$/.test(type)) throw new Error('Unsupported source photo.');
      return { ...item, blob: take(bytes, type) };
    });
    const uploads = await Promise.all((edits.uploads ?? []).map(({ bytes, type }) => {
      if (type !== 'image/png' && type !== 'image/webp') throw new Error('Unsupported custom image.');
      return dataUrl(take(bytes, type));
    }));
    project = {
      version: edits.version, items,
      session: mapUploadImages(edits.session, index => {
        if (!Number.isInteger(index) || !isUploadData(uploads[index])) throw new Error('Invalid custom image reference.');
        return uploads[index];
      }),
    };
  }
  if (header.platform === 'flutter' && header.projectBytes) take(header.projectBytes);
  if (offset !== archive.size) throw new Error('Invalid backup length.');
  return {
    id: restoredWebId(name), poster, project,
    createdAt: Number.isFinite(header.createdAt) && Math.abs(header.createdAt) <= 8.64e15 ? header.createdAt : Date.now(),
    title: typeof header.title === 'string' ? header.title.slice(0, 80) : 'Restored strip',
  };
}
