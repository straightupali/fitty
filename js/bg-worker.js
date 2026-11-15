// Fitty — background removal worker.
// Runs the AI cut-out off the main thread so the page never freezes.
// The model session is created once and reused for every photo.
import { cleanCutout } from './cutout-clean.js';
const LIB_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const MAX_SIDE = 900;

let libPromise = null;
let currentJob = null;
let lastProgress = 0;

// One config object for every call → the library caches the model session.
const CONFIG = {
  model: 'small',               // quantized ISNet: smallest download, same quality as before
  output: { format: 'image/png' },
  progress: (key, current, total) => {
    const now = Date.now();
    if (!currentJob || now - lastProgress < 150) return;
    lastProgress = now;
    self.postMessage({ id: currentJob, type: 'progress', key, current, total });
  },
};

function loadLib() {
  if (!libPromise) libPromise = import(LIB_URL).catch((e) => { libPromise = null; throw e; });
  return libPromise;
}

self.onmessage = async (e) => {
  const { id, blob, warmup } = e.data;
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    self.postMessage({ id, type: 'error', fallback: true, message: 'No OffscreenCanvas in worker' });
    return;
  }
  try {
    const lib = await loadLib();
    if (warmup) { self.postMessage({ id, type: 'done', blob: null }); return; }
    if (e.data.preload) {
      currentJob = id;
      if (lib.preload) await lib.preload(CONFIG);
      else await (lib.removeBackground || lib.default)(await tinyImage(), CONFIG);
      self.postMessage({ id, type: 'done', blob: null });
      return;
    }
    currentJob = id;
    const cut = await (lib.removeBackground || lib.default)(blob, CONFIG);
    const out = await trimAndShrink(cut);
    self.postMessage({ id, type: 'done', blob: out });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  } finally {
    currentJob = null;
  }
};

async function tinyImage() {
  const c = new OffscreenCanvas(32, 32);
  c.getContext('2d').fillRect(8, 8, 16, 16);
  return c.convertToBlob({ type: 'image/png' });
}

// Crop transparent margins and downscale — all inside the worker.
async function trimAndShrink(blob) {
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close && bmp.close();
  const img = ctx.getImageData(0, 0, w, h);
  // Remove leftover background specks and make the garment solid again.
  const res = cleanCutout(img.data, w, h);
  if (res.changed) ctx.putImageData(img, 0, 0);
  const data = img.data;
  const opaque = (x, y) => data[(y * w + x) * 4 + 3] > 12;
  const rowHas = (y) => { for (let x = 0; x < w; x++) if (opaque(x, y)) return true; return false; };
  const colHas = (x, y0, y1) => { for (let y = y0; y <= y1; y++) if (opaque(x, y)) return true; return false; };
  let top = 0; while (top < h && !rowHas(top)) top++;
  if (top === h) return blob; // fully transparent — keep as is
  let bottom = h - 1; while (bottom > top && !rowHas(bottom)) bottom--;
  let left = 0; while (left < w && !colHas(left, top, bottom)) left++;
  let right = w - 1; while (right > left && !colHas(right, top, bottom)) right--;
  const pad = Math.round(Math.max(w, h) * 0.03);
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(w - 1, right + pad); bottom = Math.min(h - 1, bottom + pad);
  const cw = right - left + 1, ch = bottom - top + 1;
  const scale = Math.min(1, MAX_SIDE / Math.max(cw, ch));
  const o = new OffscreenCanvas(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(ch * scale)));
  o.getContext('2d').drawImage(c, left, top, cw, ch, 0, 0, o.width, o.height);
  let out = await o.convertToBlob({ type: 'image/webp', quality: 0.88 });
  if (out.type !== 'image/webp') out = await o.convertToBlob({ type: 'image/png' });
  return out;
}
