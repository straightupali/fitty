// Fitty — background removal worker.
// Runs the AI cut-out off the main thread so the page never freezes.
// The model session is created once and reused for every photo.
import { cleanCutout } from './cutout-clean.js';
const LIB_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const MAX_SIDE = 1024;   // the AI works at 1024 px — keep all the detail it produces

let libPromise = null;
let currentJob = null;
let lastProgress = 0;

// One config object per model → the library caches each model's session and reuses it.
//  'medium' = full-detail ISNet (fp16, ~88 MB): most accurate edges and backgrounds.
//  'small'  = compressed ISNet (8-bit, ~44 MB): quicker, slightly rougher.
const progress = (key, current, total) => {
  const now = Date.now();
  if (!currentJob || now - lastProgress < 150) return;
  lastProgress = now;
  self.postMessage({ id: currentJob, type: 'progress', key, current, total });
};
const CONFIGS = {};
const configFor = (model) => (CONFIGS[model] ||= { model, output: { format: 'image/png', quality: 1 }, progress });

function loadLib() {
  if (!libPromise) libPromise = import(LIB_URL).catch((e) => { libPromise = null; throw e; });
  return libPromise;
}

self.onmessage = async (e) => {
  const { id, blob, warmup } = e.data;
  const CONFIG = configFor(e.data.model === 'small' ? 'small' : 'medium');
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
    const out = await trimAndShrink(cut, blob);
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
async function trimAndShrink(blob, originalBlob = null) {
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close && bmp.close();
  const img = ctx.getImageData(0, 0, w, h);
  // The original photo (same size) tells the cleanup what the background looked like.
  let orig = null;
  if (originalBlob) {
    try {
      const ob = await createImageBitmap(originalBlob);
      const oc = new OffscreenCanvas(w, h);
      const octx = oc.getContext('2d', { willReadFrequently: true });
      octx.drawImage(ob, 0, 0, w, h);
      ob.close && ob.close();
      orig = octx.getImageData(0, 0, w, h).data;
    } catch { orig = null; }
  }
  // Remove leftover background, make the garment solid, clean the edges.
  const res = cleanCutout(img.data, w, h, orig);
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
