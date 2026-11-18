import { loadWork, storeWork } from '../context/savedWorks';
import { accountSupabase } from './lumiClient';
import { backupName, backupNamePattern, maxBackupBytes, packWebWork, unpackWork } from './backupArchive';

const bucket = 'lumi-private-backups';

async function storageFor(owner) {
  const client = accountSupabase();
  const { data, error } = await client.auth.getSession();
  if (error || data.session?.user.id !== owner || data.session?.user.is_anonymous) {
    throw new Error('Sign in again to use cloud backup.');
  }
  return client.storage.from(bucket);
}

function pathFor(owner, name) {
  if (!backupNamePattern.test(name)) throw new Error('Invalid backup name.');
  return `${owner}/${name}`;
}

export async function listBackups(owner) {
  const storage = await storageFor(owner);
  const backups = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await storage.list(owner, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    backups.push(...data.filter(item => item.id && backupNamePattern.test(item.name)));
    if (data.length < 100) break;
  }
  return backups.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function uploadBackup(owner, id) {
  const work = await loadWork(id);
  if (!work) throw new Error('The local strip is no longer available.');
  const archive = packWebWork(work);
  const storage = await storageFor(owner);
  const path = pathFor(owner, backupName(id));
  const { error } = await storage.upload(path, archive, {
    contentType: archive.type, cacheControl: '0', upsert: false,
  });
  if (!error) return true;
  if (Number(error.statusCode) === 409 || /already exists|duplicate/i.test(error.message)) {
    const existing = await storage.info(path);
    if (!existing.error) return false;
  }
  throw new Error('Upload failed. Try again when you’re online.');
}

export async function restoreBackup(owner, backup, onProgress) {
  const storage = await storageFor(owner);
  const { data, error } = await storage.download(pathFor(owner, backup.name), {}, {
    cache: 'no-store', signal: AbortSignal.timeout(120000),
  }).asStream();
  if (error) throw error;
  const reader = data.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBackupBytes) throw new Error('This backup exceeds the size limit.');
      chunks.push(value);
      onProgress(bytes, backup.metadata?.size);
    }
  } finally {
    try { await reader.cancel(); } finally { reader.releaseLock(); }
  }
  const work = await unpackWork(new Blob(chunks), backup.name);
  await storageFor(owner);
  return storeWork(work);
}

export async function deleteBackup(owner, name) {
  const storage = await storageFor(owner);
  const { error } = await storage.remove([pathFor(owner, name)]);
  if (error) throw error;
}
