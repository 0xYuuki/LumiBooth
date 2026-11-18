import { reviewItems, selectedItems } from './photoboothSession';

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lumibooth-local-draft', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const request = operation(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function loadDraft() {
  const saved = await transact('readonly', store => store.get('current'));
  return restoreProject(saved);
}

export function restoreProject(saved) {
  if (!saved || saved.version !== 1) return null;
  if (!Array.isArray(saved.items) || !saved.items.every(item => item?.blob instanceof Blob)) {
    throw new Error('Draft source photos are unavailable.');
  }
  const items = saved.items.map(item => ({ ...item, photo: URL.createObjectURL(item.blob), blob: undefined, motion: null }));
  const selected = selectedItems(items);
  return { ...saved.session, reviewItems: items, photos: selected.map(item => item.photo), crops: selected.map(item => item.crop), motions: selected.map(() => null), output: null, history: [], undoGroup: null };
}
let queue = Promise.resolve();
const media = new Map();
export function saveDraft(session) {
  // Prepare media immediately, before a subsequent reset can revoke object URLs.
  const items = session && !session.roomId ? reviewItems(session) : [];
  const prepared = session && !session.roomId ? serializeProject(session, (url) => {
    if (!media.has(url)) {
      const promise = readPhoto(url).catch((error) => {
        if (media.get(url) === promise) media.delete(url);
        throw error;
      });
      media.set(url, promise);
    }
    return media.get(url);
  }) : Promise.resolve(null);
  // Attach a handler now: this work may finish before the preceding write.
  prepared.catch(() => {});
  const task = async () => {
    const value = await prepared;
    return value ? transact('readwrite', store => store.put(value, 'current'))
      : transact('readwrite', store => store.delete('current'));
  };
  queue = queue.catch(() => {}).then(task);
  for (const url of media.keys()) if (!items.some(item => item.photo === url)) media.delete(url);
  return queue;
}

async function readPhoto(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Photo could not be read.');
  return response.blob();
}

export async function serializeProject(session, readMedia = readPhoto) {
  const settings = Object.fromEntries(Object.entries(session).filter(([key]) =>
    !['history', 'photos', 'motions', 'reviewItems', 'output', 'undoGroup'].includes(key)));
  const items = await Promise.all(reviewItems(session).map(async ({ photo, name, crop, selected, order }) => ({
    name, crop, selected, order, blob: await readMedia(photo),
  })));
  return { version: 1, session: settings, items };
}
