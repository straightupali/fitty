// Fitty — IndexedDB storage layer. Everything lives on this device.
const DB_NAME = 'fitbud'; // internal name kept from before the rename, so existing data stays
const DB_VERSION = 1;
export const STORES = ['pieces', 'fits', 'groups', 'wears', 'meta'];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pieces')) db.createObjectStore('pieces', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('fits')) db.createObjectStore('fits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('wears')) {
        const w = db.createObjectStore('wears', { keyPath: 'id' });
        w.createIndex('date', 'date');
        w.createIndex('fitId', 'fitId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  all: (store) => tx(store, 'readonly', s => reqP(s.getAll())),
  get: (store, id) => tx(store, 'readonly', s => reqP(s.get(id))),
  put: (store, obj) => {
    if (store !== 'meta') obj.updatedAt = Date.now();
    return tx(store, 'readwrite', s => reqP(s.put(obj)));
  },
  putRaw: (store, obj) => tx(store, 'readwrite', s => reqP(s.put(obj))),
  del: (store, id) => tx(store, 'readwrite', s => reqP(s.delete(id))),
  clear: (store) => tx(store, 'readwrite', s => reqP(s.clear())),
  async getMeta(key, fallback) {
    const r = await this.get('meta', key);
    return r ? r.value : fallback;
  },
  setMeta(key, value) { return this.putRaw('meta', { key, value }); },
};

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// Ask the browser not to evict our data when storage is tight.
export async function persistStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch { /* not supported */ }
}

// ---------- Export / import (sync between devices by file) ----------

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

export async function exportAll() {
  const out = { app: 'fitty', version: 1, exportedAt: new Date().toISOString() };
  for (const store of STORES) {
    const rows = await db.all(store);
    if (store === 'pieces') {
      out.pieces = await Promise.all(rows.map(async p => ({
        ...p,
        image: p.image ? await blobToDataURL(p.image) : null,
        original: p.original ? await blobToDataURL(p.original) : null,
      })));
    } else out[store] = rows;
  }
  return out;
}

// Merge: records are matched by id; the newer one (updatedAt) wins.
// Settings (meta) are only taken if `includeSettings` is true.
export async function importAll(data, { replace = false, includeSettings = false } = {}) {
  if (!data || (data.app !== 'fitty' && data.app !== 'fitbud')) throw new Error('This file is not a Fitty backup.'); // old FitBud backups still import
  if (replace) for (const s of ['pieces', 'fits', 'groups', 'wears']) await db.clear(s);
  const stats = { added: 0, updated: 0, kept: 0 };
  for (const store of ['groups', 'pieces', 'fits', 'wears']) {
    const incoming = data[store] || [];
    const existing = new Map((await db.all(store)).map(r => [r.id, r]));
    for (const rec of incoming) {
      const cur = existing.get(rec.id);
      if (cur && (cur.updatedAt || 0) >= (rec.updatedAt || 0)) { stats.kept++; continue; }
      const row = { ...rec };
      if (store === 'pieces') {
        row.image = typeof row.image === 'string' ? await dataURLToBlob(row.image) : null;
        row.original = typeof row.original === 'string' ? await dataURLToBlob(row.original) : null;
      }
      await db.putRaw(store, row);
      cur ? stats.updated++ : stats.added++;
    }
  }
  if (includeSettings) for (const m of data.meta || []) await db.putRaw('meta', m);
  return stats;
}
