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
  if (!saved || saved.version !== 1) return null;
  const items = saved.items.map(item => ({ ...item, photo: URL.createObjectURL(item.blob), blob: undefined, motion: null }));
  const selected = selectedItems(items);
  return { ...saved.session, reviewItems: items, photos: selected.map(item => item.photo), crops: selected.map(item => item.crop), motions: selected.map(() => null), output: null, history: [], undoGroup: null };
}
let queue = Promise.resolve();
const media = new Map();
export function saveDraft(session) {
  // Prepare media immediately, before a subsequent reset can revoke object URLs.
  const items = session && !session.roomId ? reviewItems(session) : [];
  const pending = items.map(item => {
    if (!media.has(item.photo)) media.set(item.photo, fetch(item.photo).then(response => response.blob()));
    return media.get(item.photo).then(blob => ({ ...item, photo: undefined, motion: null, blob }));
  });
  const prepared = Promise.all(pending);
  // Attach a handler now: this work may finish before the preceding write.
  prepared.catch(() => {});
  const task = async () => {
    if (!session || session.roomId) return transact('readwrite', store => store.delete('current'));
    const settings = Object.fromEntries(Object.entries(session).filter(([key]) => !['history', 'photos', 'motions', 'reviewItems', 'output', 'undoGroup'].includes(key)));
    const value = { version: 1, session: settings, items: await prepared };
    return transact('readwrite', store => store.put(value, 'current'));
  };
  queue = queue.catch(() => {}).then(task);
  for (const url of media.keys()) if (!items.some(item => item.photo === url)) media.delete(url);
  return queue;
}
