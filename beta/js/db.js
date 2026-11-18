// Fitty — IndexedDB storage layer. Everything lives on this device.
import { DB_NAME, MAIN_DB_NAME } from './config.js';
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

// ---------- Photos are stored as raw bytes, not Blobs ----------
// Safari/iOS has a bug: when a record that holds a Blob is saved again (e.g. you edit a piece),
// the photo data can be deleted and the image shows as "?". Raw bytes (ArrayBuffer) don't have this problem.
const BLOB_FIELDS = { pieces: ['image', 'original'] };

async function encode(store, obj) {
  const fields = BLOB_FIELDS[store];
  if (!fields) return obj;
  const out = { ...obj };
  for (const f of fields) {
    const v = out[f];
    if (v instanceof Blob) out[f] = { __bytes: await v.arrayBuffer(), type: v.type || 'image/png' };
  }
  return out;
}
function decode(store, obj) {
  const fields = BLOB_FIELDS[store];
  if (!fields || !obj) return obj;
  for (const f of fields) {
    const v = obj[f];
    if (v && v.__bytes) obj[f] = new Blob([v.__bytes], { type: v.type });
  }
  return obj;
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  all: async (store) => (await tx(store, 'readonly', s => reqP(s.getAll()))).map(o => decode(store, o)),
  get: async (store, id) => decode(store, await tx(store, 'readonly', s => reqP(s.get(id)))),
  put: async (store, obj) => {
    if (store !== 'meta') obj.updatedAt = Date.now();
    const enc = await encode(store, obj);          // must finish before the transaction opens
    return tx(store, 'readwrite', s => reqP(s.put(enc)));
  },
  putRaw: async (store, obj) => {
    const enc = await encode(store, obj);
    return tx(store, 'readwrite', s => reqP(s.put(enc)));
  },
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

// One-time repair: convert photos saved as Blobs (before v2.2) to raw bytes.
// Photos Safari already lost can't be recovered — those pieces are flagged so you can re-add the photo.
export async function migratePhotos() {
  const raw = await tx('pieces', 'readonly', s => reqP(s.getAll()));
  let fixed = 0, lost = 0;
  for (const p of raw) {
    let changed = false;
    for (const f of BLOB_FIELDS.pieces) {
      const v = p[f];
      if (!(v instanceof Blob)) continue;
      changed = true;
      try {
        const buf = await v.arrayBuffer();
        if (!buf.byteLength) throw new Error('empty');
        p[f] = { __bytes: buf, type: v.type || 'image/png' };
        fixed++;
      } catch {
        p[f] = null;
        if (f === 'image') { p.imageLost = true; lost++; }
      }
    }
    if (changed) await tx('pieces', 'readwrite', s => reqP(s.put(p)));
  }
  return { fixed, lost };
}

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

// ---------- Beta: copy data from the main app ----------
// Opens the main app's database read-only. If it doesn't exist we abort the upgrade,
// so the browser never creates an empty one (that would break the main app).
function openMain() {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(MAIN_DB_NAME); } catch { resolve(null); return; }
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch { } };
    req.onsuccess = () => {
      const d = req.result;
      if (!STORES.every(s => d.objectStoreNames.contains(s))) { d.close(); resolve(null); return; }
      resolve(d);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

export async function mainAppCounts() {
  const m = await openMain();
  if (!m) return null;
  try {
    const t = m.transaction(['pieces', 'fits'], 'readonly');
    const [pieces, fits] = await Promise.all(['pieces', 'fits'].map(s => reqP(t.objectStore(s).count())));
    return { pieces, fits };
  } finally { m.close(); }
}

// Replaces everything in this (beta) database with a copy of the main app's data.
export async function copyFromMain() {
  const m = await openMain();
  if (!m) throw new Error('main app data not found');
  const data = {};
  try {
    const t = m.transaction(STORES, 'readonly');
    for (const s of STORES) data[s] = await reqP(t.objectStore(s).getAll());
  } finally { m.close(); }
  for (const s of STORES) {
    await db.clear(s);
    for (const row of data[s]) await tx(s, 'readwrite', st => reqP(st.put(row)));  // raw copy, photos included
  }
  return { pieces: data.pieces.length, fits: data.fits.length };
}
