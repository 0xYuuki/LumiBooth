function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lumibooth-print-orders', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('receipts', { keyPath: 'localId' });
      request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(names, mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      const result = action(tx);
      tx.oncomplete = () => resolve(result?.result);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function newPrintIntent(product, quantity) {
  const receiptToken = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  return {
    localId: crypto.randomUUID(), receiptToken, product, quantity, createdAt: Date.now(),
    status: 'local_pending',
  };
}

export function storePrintIntent(intent, png) {
  return transact(['receipts', 'files'], 'readwrite', tx => {
    tx.objectStore('receipts').add(intent);
    tx.objectStore('files').add(png, intent.localId);
  });
}

export function loadPrintReceipt(id) {
  return transact(['receipts'], 'readonly', tx => tx.objectStore('receipts').get(id));
}

export function loadPrintFile(id) {
  return transact(['files'], 'readonly', tx => tx.objectStore('files').get(id));
}

export async function listPrintReceipts() {
  const items = await transact(['receipts'], 'readonly', tx => tx.objectStore('receipts').getAll());
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function storePrintReceipt(id, summary) {
  return transact(['receipts', 'files'], 'readwrite', tx => {
    const receipts = tx.objectStore('receipts');
    const request = receipts.get(id);
    request.onsuccess = () => {
      if (!request.result || (summary.status === 'draft_upload' &&
          !['local_pending', 'draft_upload'].includes(request.result.status))) return;
      receipts.put({ ...request.result, ...summary });
      if (summary.status !== 'draft_upload') tx.objectStore('files').delete(id);
    };
  });
}

export function forgetPrintReceipt(id) {
  return transact(['receipts', 'files'], 'readwrite', tx => {
    tx.objectStore('receipts').delete(id);
    tx.objectStore('files').delete(id);
  });
}
