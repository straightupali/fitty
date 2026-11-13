// Fitty — image helpers: downscale, background removal (on-device), object URL cache.

const MAX_SIDE = 900;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, q) {
  return new Promise(res => canvas.toBlob(b => res(b), type, q));
}

// Decode off the main thread when the browser can (createImageBitmap), else via <img>.
async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close && bmp.close() };
    } catch { /* fall through */ }
  }
  const img = await loadImage(blob);
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => { } };
}

// Downscale + re-encode so the database stays small. Keeps transparency (webp/png).
export async function shrink(blob, maxSide = MAX_SIDE) {
  const im = await decode(blob);
  const scale = Math.min(1, maxSide / Math.max(im.w, im.h));
  const w = Math.max(1, Math.round(im.w * scale)), h = Math.max(1, Math.round(im.h * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im.src, 0, 0, w, h);
  im.done();
  let out = await canvasToBlob(c, 'image/webp', 0.86);
  if (!out || out.type !== 'image/webp') out = await canvasToBlob(c, 'image/png');
  return out;
}

// ---------- Background removal ----------
// Runs in a Web Worker (js/bg-worker.js) so the page stays responsive while the AI works.
// If the browser can't run it in a worker (very old Safari), it falls back to the main thread.
const BG_LIB_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
let worker = null, workerBroken = false, jobSeq = 0;
const jobs = new Map();

function getWorker() {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./bg-worker.js', import.meta.url), { type: 'module' });
  } catch { workerBroken = true; return null; }
  worker.onmessage = (e) => {
    const { id, type } = e.data;
    const job = jobs.get(id);
    if (!job) return;
    if (type === 'progress') { job.onProgress && e.data.total && job.onProgress(Math.round((e.data.current / e.data.total) * 100), e.data.key); return; }
    jobs.delete(id);
    if (type === 'done') job.resolve(e.data.blob);
    else {
      const err = new Error(e.data.message);
      err.fallback = !!e.data.fallback;
      if (err.fallback) { workerBroken = true; worker.terminate(); worker = null; }
      job.reject(err);
    }
  };
  worker.onerror = (e) => {
    // The worker itself failed to start (e.g. module workers unsupported).
    e.preventDefault && e.preventDefault();
    workerBroken = true;
    try { worker.terminate(); } catch { }
    worker = null;
    for (const [id, job] of jobs) { const err = new Error('Worker unavailable'); err.fallback = true; job.reject(err); jobs.delete(id); }
  };
  return worker;
}

function viaWorker(w, blob, onProgress, warmup = false) {
  return new Promise((resolve, reject) => {
    const id = ++jobSeq;
    jobs.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, blob, warmup });
  });
}

// Start downloading/compiling the model in the background before it's needed.
export function warmUpBackgroundRemoval() {
  const w = getWorker();
  if (w) viaWorker(w, null, null, true).catch(() => { });
}

export async function removeBackground(blob, onProgress) {
  const w = getWorker();
  if (w) {
    try { return await viaWorker(w, blob, onProgress); }
    catch (err) { if (!err.fallback) throw err; }
  }
  return removeOnMainThread(blob, onProgress);
}

// Fallback path (blocks the page while it runs — only used if workers can't).
let bgLib = null;
async function removeOnMainThread(blob, onProgress) {
  if (!bgLib) bgLib = await import(/* @vite-ignore */ BG_LIB_URL);
  const fn = bgLib.removeBackground || bgLib.default;
  const result = await fn(blob, {
    model: 'small',
    output: { format: 'image/png' },
    progress: (key, current, total) => { if (onProgress && total) onProgress(Math.round((current / total) * 100), key); },
  });
  return trimTransparent(result);
}

async function trimTransparent(blob) {
  const img = await loadImage(blob);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 12) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return blob;
  const pad = Math.round(Math.max(width, height) * 0.03);
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const o = document.createElement('canvas');
  o.width = maxX - minX + 1; o.height = maxY - minY + 1;
  o.getContext('2d').drawImage(c, minX, minY, o.width, o.height, 0, 0, o.width, o.height);
  return (await canvasToBlob(o, 'image/webp', 0.9)) || canvasToBlob(o, 'image/png');
}

// Object URL cache keyed by piece id + updatedAt so images don't re-decode on every render.
const urlCache = new Map();
export function imageURL(piece) {
  if (!piece || !piece.image) return null;
  const key = piece.id + ':' + (piece.updatedAt || 0);
  if (urlCache.has(key)) return urlCache.get(key);
  for (const k of urlCache.keys()) if (k.startsWith(piece.id + ':')) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); }
  const u = URL.createObjectURL(piece.image);
  urlCache.set(key, u);
  return u;
}
