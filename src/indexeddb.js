import { encryptData, decryptData } from './encryption.js';

const DB_NAME = 'wealth-accelerator-db';
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'primary';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore(mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function persistSnapshot(snapshot, passphrase) {
  const encrypted = await encryptData(snapshot, passphrase);
  await withStore('readwrite', (store) => store.put(encrypted, SNAPSHOT_KEY));
  return encrypted;
}

export async function loadSnapshot(passphrase) {
  try {
    const payload = await withStore('readonly', (store) => store.get(SNAPSHOT_KEY));
    if (!payload) return null;
    return await decryptData(payload, passphrase);
  } catch (error) {
    console.warn('Failed to load snapshot', error);
    return null;
  }
}

export async function clearSnapshot() {
  await withStore('readwrite', (store) => store.delete(SNAPSHOT_KEY));
}

export async function exportSnapshot(passphrase) {
  const payload = await withStore('readonly', (store) => store.get(SNAPSHOT_KEY));
  if (!payload) return null;
  const decrypted = await decryptData(payload, passphrase);
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    snapshot: decrypted
  });
}

export async function importSnapshot(blob, passphrase) {
  const parsed = typeof blob === 'string' ? JSON.parse(blob) : blob;
  if (!parsed.snapshot) {
    throw new Error('Invalid snapshot payload');
  }
  await persistSnapshot(parsed.snapshot, passphrase);
  return parsed.snapshot;
}
