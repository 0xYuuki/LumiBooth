import { restoreUpload } from '../context/customUploads';
import { storageFor } from './cloudBackup';
import { maxUploadBackupBytes, packUploadBackup, unpackUploadBackup, uploadBackupId, uploadBackupName } from './uploadBackupArchive';

const bucket = 'lumi-private-uploads';
const storage = owner => storageFor(owner, bucket);

function pathFor(owner, name) {
  if (!uploadBackupId(name)) throw new Error('Invalid upload backup.');
  return `${owner}/${name}`;
}

export async function listUploadBackups(owner) {
  const client = await storage(owner);
  const results = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.list(owner, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const files = data.filter(item => item.id && uploadBackupId(item.name));
    for (let start = 0; start < files.length; start += 8) {
      results.push(...await Promise.all(files.slice(start, start + 8).map(async file => {
        const { data: info } = await client.info(pathFor(owner, file.name));
        const { name, kind } = info?.metadata ?? {};
        return {
          ...file,
          title: typeof name === 'string' ? name.slice(0, 64) : '',
          kind: kind === 'sticker' || kind === 'background' ? kind : null,
        };
      })));
    }
    if (data.length < 100) break;
  }
  return results.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function backUpUpload(owner, item) {
  const archive = packUploadBackup(item);
  const client = await storage(owner);
  const path = pathFor(owner, uploadBackupName(item.id));
  const { error } = await client.upload(path, archive, {
    contentType: archive.type, cacheControl: '0', upsert: false,
    metadata: { name: item.name, kind: item.kind },
  });
  if (!error) return;
  if (Number(error.statusCode) === 409 || /already exists|duplicate/i.test(error.message)) {
    const existing = await client.info(path);
    if (!existing.error) return;
  }
  if (Number(error.statusCode) === 413 || /quota|limit|capacity/i.test(error.message)) {
    throw new Error('The cloud storage limit was reached.');
  }
  throw new Error('Upload failed. Check your connection and try again.');
}

export async function restoreUploadBackup(owner, name) {
  const client = await storage(owner);
  const { data, error } = await client.download(pathFor(owner, name), {}, {
    cache: 'no-store', signal: AbortSignal.timeout(120000),
  }).asStream();
  if (error) throw error;
  const reader = data.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxUploadBackupBytes) throw new Error('This backup exceeds the size limit.');
      chunks.push(value);
    }
  } finally {
    try { await reader.cancel(); } finally { reader.releaseLock(); }
  }
  const item = await unpackUploadBackup(new Blob(chunks), name);
  return restoreUpload(item, () => storage(owner));
}

export async function deleteUploadBackup(owner, name) {
  const client = await storage(owner);
  const path = pathFor(owner, name);
  const { data, error } = await client.remove([path]);
  if (error) throw error;
  if (!data.length) throw new Error('The cloud copy could not be deleted. Refresh the list and try again.');
}
