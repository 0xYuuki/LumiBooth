import { restoreProject, serializeProject } from './localDraft';
import { layouts, requiredPhotos, selectedItems } from './photoboothSession';

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lumibooth-saved-works', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('works', { keyPath: 'id' });
      request.result.createObjectStore('details', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(stores, mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, mode);
      transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction aborted.'));
      try {
        const request = operation(transaction);
        transaction.oncomplete = () => resolve(request?.result);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}

export async function listWorks() {
  const entries = await transact('works', 'readonly', tx => tx.objectStore('works').getAll());
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

export function loadWork(id) {
  // Read both stores through one transaction so a concurrent deletion is consistent.
  let detail;
  return transact(['works', 'details'], 'readonly', tx => {
    detail = tx.objectStore('details').get(id);
    return tx.objectStore('works').get(id);
  }).then(work => work ? { ...work, ...detail.result } : null);
}

export function deleteWork(id) {
  return transact(['works', 'details'], 'readwrite', tx => {
    tx.objectStore('works').delete(id);
    tx.objectStore('details').delete(id);
  });
}

async function thumbnailFor(poster) {
  const bitmap = await createImageBitmap(poster);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 280 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create strip thumbnail.'));
    }, 'image/png'));
  } finally {
    bitmap.close();
  }
}

export async function saveWork(session) {
  // Start reading source URLs before navigation can release the draft.
  const [poster, project] = await Promise.all([
    fetch(session.output).then(response => {
      if (!response.ok) throw new Error('Could not read the finished strip.');
      return response.blob();
    }),
    session.roomId ? null : serializeProject(session),
  ]);
  const thumbnail = await thumbnailFor(poster);
  const work = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: session.caption?.trim() || session.frame?.name || session.layout.name,
    thumbnail,
    bytes: thumbnail.size + poster.size + (project?.items.reduce((sum, item) => sum + item.blob.size, 0) ?? 0),
  };
  await transact(['works', 'details'], 'readwrite', tx => {
    tx.objectStore('works').add(work);
    tx.objectStore('details').add({ id: work.id, poster, project });
  });
  return work.id;
}

export async function editWork(project) {
  const layout = layouts.find(layout => layout.id === project?.session?.layout?.id);
  if (project?.version !== 1 || !layout || !Array.isArray(project.items) ||
      !Array.isArray(project.session.stickers) ||
      !project.items.every(item => item?.blob instanceof Blob && item.blob.size) ||
      selectedItems(project.items).length !== requiredPhotos(layout)) {
    throw new Error('Editable source photos are unavailable.');
  }
  await Promise.all(project.items.map(async (item) => {
    const decoded = await createImageBitmap(item.blob);
    decoded.close();
  }));
  return restoreProject({ ...project, session: { ...project.session, layout } });
}
