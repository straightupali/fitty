// Fitty — main app (vanilla JS, no build step)
import { db, uid, persistStorage, exportAll, importAll } from './db.js';
import { DEFAULT_LOCATION, DEFAULT_MAPPING, weightForTemp, searchCity, getForecast, describeCode } from './weather.js';
import { scoreFits, pickWeighted, toISO, fromISO, daysBetween } from './recommend.js';
import { shrink, removeBackground, imageURL, warmUpBackgroundRemoval, prepareOffline, offlineReady, looksLikeNetworkError } from './images.js';
import { PALETTE, colorInfo, colorFromName, extractColor, harmony } from './colors.js';
import { computeLearning, effectiveWeight } from './learn.js';
import { buildPlan, repickDay } from './planner.js';
import { generateIdeas, comboKey } from './ideas.js';

// ---------------------------------------------------------------- constants
const CATS = [
  { id: 'top', label: 'Tops', one: 'Top' },
  { id: 'bottom', label: 'Bottoms', one: 'Bottom' },
  { id: 'outerwear', label: 'Outerwear', one: 'Outerwear' },
  { id: 'shoes', label: 'Shoes', one: 'Shoes' },
  { id: 'accessory', label: 'Accessories', one: 'Accessory' },
];
const CAT = Object.fromEntries(CATS.map((c, i) => [c.id, { ...c, i }]));
const GROUP_COLORS = ['#D9A79A', '#A9BFA8', '#A7B8CC', '#E2C38E', '#C7B2D6', '#9FC9C6', '#E5A9B8', '#B9AE9E'];
const DEFAULT_SETTINGS = { location: DEFAULT_LOCATION, mapping: DEFAULT_MAPPING, blockDays: 2, fadeDays: 7, autoBg: true,
  learn: true, learnSince: 0 };
const APP_VERSION = '2.1';
const WEIGHT_WORDS = ['Very light', 'Light', 'Mild', 'Medium', 'Warm', 'Heaviest'];

const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  fits: '<path d="M10 6.2a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v1.5"/><path d="M12 10.5 3.4 16.8c-.8.6-.4 1.7.6 1.7h16c1 0 1.4-1.1.6-1.7L12 10.5z"/>',
  wardrobe: '<path d="M8.5 3.5 4 5.8 2.3 10l3.2 1.6L7 10v10.5h10V10l1.5 1.6 3.2-1.6L20 5.8l-4.5-2.3c-.6 1.6-2 2.5-3.5 2.5s-2.9-.9-3.5-2.5z"/>',
  history: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  camera: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10.5H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17.5 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  trash: '<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  wand: '<path d="m4 20 11-11M14 4l.6 1.9L16.5 6.5l-1.9.6L14 9l-.6-1.9-1.9-.6 1.9-.6zM19 10l.4 1.1 1.1.4-1.1.4L19 13l-.4-1.1-1.1-.4 1.1-.4z"/>',
  undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',
  shuffle: '<path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M17.5 14.5 20 17l-2.5 2.5M4 17h3.5c1.4 0 2.3-.9 3-2M13.5 9c.7-1.1 1.6-2 3-2H20M17.5 4.5 20 7l-2.5 2.5"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  edit: '<path d="M4.5 19.5 5.3 16 16 5.3a1.8 1.8 0 0 1 2.6 2.6L7.9 18.7z"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  down: '<path d="m6 9.5 6 6 6-6"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  up: '<path d="m6 14.5 6-6 6 6"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const isDesktop = () => matchMedia('(min-width: 900px) and (pointer: fine)').matches;

// ---------------------------------------------------------------- state
const S = {
  view: 'today',
  pieces: [], fits: [], groups: [], wears: [],
  settings: { ...DEFAULT_SETTINGS },
  mode: 'tomorrow',
  group: 'all',          // Today group filter
  fitsGroup: 'all',      // Fits list filter
  wardCat: 'all',
  forecast: null, weatherErr: null, weatherLoading: false,
  manual: {},            // date -> manual target weight
  histMonth: null,
  histTab: 'calendar',
  plan: {},              // week plan: date -> fitId
  dismissedIdeas: new Set(),
  bgBusy: new Set(),
  installPrompt: null,
};

const pieceById = (id) => S.pieces.find(p => p.id === id);
const fitById = (id) => S.fits.find(f => f.id === id);
const groupById = (id) => S.groups.find(g => g.id === id);
const todayISO = () => toISO(new Date());
const tomorrowISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return toISO(d); };
const targetDate = () => (S.mode === 'today' ? todayISO() : tomorrowISO());
const sortPieces = (ids) => ids.map(pieceById).filter(Boolean).sort((a, b) => CAT[a.category].i - CAT[b.category].i);

async function saveSettings() { await db.setMeta('settings', S.settings); }

// Daily state: skips + current picks reset every new day.
function daily() {
  let d;
  try { d = JSON.parse(localStorage.getItem('fitbud:daily') || 'null'); } catch { d = null; }
  if (!d || d.day !== todayISO()) d = { day: todayISO(), skips: {}, picks: {} };
  return d;
}
function saveDaily(d) { try { localStorage.setItem('fitbud:daily', JSON.stringify(d)); } catch { } }

// ---------------------------------------------------------------- toasts
function toast(msg, action, ms = 2400) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.run(); el.remove(); };
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), action ? ms + 2500 : ms);
  return el;
}

// ---------------------------------------------------------------- sheets (modals) + back button
const sheets = [];
let ignorePop = false, backPending = null, backResolve = null;

async function pushLayer() {
  if (backPending) await backPending;
  history.pushState({ fbSheet: true }, '');
}
function popLayer() {
  ignorePop = true;
  backPending = new Promise(r => { backResolve = r; });
  setTimeout(() => { if (ignorePop) { ignorePop = false; backResolve(); backPending = null; } }, 600);
  history.back();
}
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; backResolve && backResolve(); backPending = null; return; }
  const top = sheets[sheets.length - 1];
  if (top) { top._close(); if (sheets.length) pushLayer(); }
});

function openSheet(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap' + (opts.movable ? ' movable' : '');
  wrap.innerHTML = `<div class="sheet-backdrop" ${opts.movable ? '' : 'data-close'}></div>
    <div class="sheet ${opts.cls || ''} ${opts.movable ? 'movable' : ''}" role="dialog" aria-modal="${opts.movable ? 'false' : 'true'}">
      <div class="grabber"></div><div class="sheet-head"></div><div class="sheet-body"></div><div class="sheet-foot"></div>
    </div>`;
  wrap.style.zIndex = ++zTop; // newest window on top
  $('#sheets').appendChild(wrap);
  const head = $('.sheet-head', wrap), body = $('.sheet-body', wrap), foot = $('.sheet-foot', wrap);
  const h = {
    el: wrap, body, opts, closed: false,
    rerender() {
      const title = typeof opts.title === 'function' ? opts.title() : opts.title;
      const collapsed = $('.sheet', wrap).classList.contains('collapsed');
      head.innerHTML = `<h2>${esc(title)}</h2><div class="head-btns">${opts.movable
        ? `<button class="btn icon ghost" data-peek aria-label="${collapsed ? 'Expand' : 'Move out of the way'}" title="${collapsed ? 'Expand' : 'Minimize'}">${icon(collapsed ? 'up' : 'down')}</button>` : ''}<button class="btn icon ghost" data-close aria-label="Close">${icon('x')}</button></div>`;
      if (opts.movable) head.title = 'Drag to move';
      const st = body.scrollTop;
      body.innerHTML = opts.body();
      body.scrollTop = st;
      const f = opts.foot ? opts.foot() : '';
      foot.innerHTML = f; foot.style.display = f ? '' : 'none';
      opts.onRender && opts.onRender(h);
    },
    close() {
      if (h.closed) return;
      h._close();
      if (sheets.length === 0) popLayer();
    },
    _close() {
      if (h.closed) return;
      h.closed = true; wrap.remove();
      sheets.splice(sheets.indexOf(h), 1);
      opts.onClose && opts.onClose();
    },
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { h.close(); return; }
    const a = e.target.closest('[data-act]');
    if (a && opts.onAct) opts.onAct(a.dataset.act, a, e, h);
  });
  wrap.addEventListener('input', (e) => opts.onInput && opts.onInput(e, h));
  wrap.addEventListener('change', (e) => opts.onChange && opts.onChange(e, h));
  if (opts.drop) bindDrop(wrap, opts.drop);
  if (sheets.length === 0) pushLayer();
  sheets.push(h);
  h.rerender();
  if (opts.movable) makeMovable(h);
  if (opts.autofocus && isDesktop()) setTimeout(() => { const i = $(opts.autofocus, wrap); i && i.focus(); }, 60);
  return h;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close();
});

// Drag a sheet by its header (and minimize it) so you can see what's underneath.
const lastMovablePos = {}; // desktop: remember where you left each kind of window
let zTop = 60;
function makeMovable(h) {
  const kind = h.opts.movable;
  const sheet = $('.sheet', h.el);
  const narrow = () => !matchMedia('(min-width: 900px)').matches;
  let pos = { x: 0, y: 0 }, drag = null;
  const apply = () => { sheet.style.translate = `${pos.x}px ${pos.y}px`; };
  const clamp = (p) => {
    const r = sheet.getBoundingClientRect();
    const baseL = r.left - pos.x, baseT = r.top - pos.y;
    if (narrow()) return { x: 0, y: Math.max(-baseT + 8, Math.min(p.y, r.height - 70)) };
    // It can slide off the left edge, but the right side (with the ⌄ and ✕ buttons) stays on screen.
    return {
      x: Math.max(-baseL - r.width + 280, Math.min(p.x, innerWidth - baseL - r.width - 8)),
      y: Math.max(-baseT, Math.min(p.y, innerHeight - baseT - 64)),
    };
  };
  const setCollapsed = (on) => {
    sheet.classList.toggle('collapsed', on);
    h.rerender();
    requestAnimationFrame(() => { pos = clamp(pos); apply(); });
  };
  // Desktop: start where you last left it, or beside the editor on wide screens.
  requestAnimationFrame(() => {
    if (narrow()) return;
    if (lastMovablePos[kind]) pos = { ...lastMovablePos[kind] };
    else if (kind === 'picker' && innerWidth >= 1200) { const r = sheet.getBoundingClientRect(); pos = { x: innerWidth - r.right - 24, y: 0 }; }
    sheet.classList.add('no-anim');
    pos = clamp(pos); apply();
    requestAnimationFrame(() => sheet.classList.remove('no-anim'));
  });
  h.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-peek]')) setCollapsed(!sheet.classList.contains('collapsed'));
  });
  h.el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.sheet')) {
      h.el.style.zIndex = ++zTop; // clicked window comes to the front…
      // …but the pieces window always stays above the fit editor it belongs to.
      if (kind === 'editor') sheets.filter(x => x.opts.movable === 'picker').forEach(x => { x.el.style.zIndex = ++zTop; });
    }
    const hd = e.target.closest('.sheet-head, .grabber');
    if (!hd || e.target.closest('button, input, select')) return;
    drag = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false, hd };
    hd.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  });
  h.el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    pos = clamp({ x: drag.ox + dx, y: drag.oy + dy });
    apply();
  });
  const end = () => {
    if (!drag) return;
    sheet.classList.remove('dragging');
    // A tap (no movement) on the header of a minimized window expands it again.
    if (!drag.moved && sheet.classList.contains('collapsed')) setCollapsed(false);
    if (!narrow()) lastMovablePos[kind] = { ...pos };
    drag = null;
  };
  h.el.addEventListener('pointerup', end);
  h.el.addEventListener('pointercancel', end);
}

function ask({ title, text, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    openSheet({
      cls: 'narrow', title,
      body: () => `<p style="margin:0 0 6px;color:var(--ink-2)">${esc(text)}</p>`,
      foot: () => `<button class="btn grow" data-close>Cancel</button><button class="btn grow ${danger ? 'danger solid' : 'primary'}" data-act="ok">${esc(ok)}</button>`,
      onAct: (act, el, e, h) => { if (act === 'ok') { done = true; resolve(true); h.close(); } },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

function promptText({ title, placeholder = '', value = '', ok = 'Save' }) {
  return new Promise((resolve) => {
    let done = false, val = value;
    openSheet({
      cls: 'narrow', title, autofocus: 'input',
      body: () => `<input class="input" data-k="v" placeholder="${esc(placeholder)}" value="${esc(val)}" maxlength="40">`,
      foot: () => `<button class="btn grow" data-close>Cancel</button><button class="btn grow primary" data-act="ok">${esc(ok)}</button>`,
      onInput: (e) => { val = e.target.value; },
      onRender: (h) => { $('input', h.el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-act=ok]', h.el).click(); } }); },
      onAct: (act, el, e, h) => { if (act === 'ok' && val.trim()) { done = true; resolve(val.trim()); h.close(); } },
      onClose: () => { if (!done) resolve(null); },
    });
  });
}

// ---------------------------------------------------------------- drag & drop + paste
function filesFrom(list) { return [...(list || [])].filter(f => f.type && f.type.startsWith('image/')); }

function bindDrop(root, handler) {
  // handler(files, category|null)
  root.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); e.stopPropagation();
    $$('.dragover', root).forEach(x => x.classList.remove('dragover'));
    const z = e.target.closest('[data-drop]');
    if (z) z.classList.add('dragover');
  });
  root.addEventListener('dragleave', (e) => {
    const z = e.target.closest('[data-drop]');
    if (z && !z.contains(e.relatedTarget)) z.classList.remove('dragover');
  });
  root.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    $$('.dragover', root).forEach(x => x.classList.remove('dragover'));
    const files = filesFrom(e.dataTransfer.files);
    if (!files.length) { toast('Only image files can be dropped'); return; }
    const z = e.target.closest('[data-drop]');
    handler(files, z ? z.dataset.drop : null);
  });
}

// Stop the browser from opening a dropped file when it lands outside a drop zone.
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!sheets.length && S.view === 'wardrobe' && [...e.dataTransfer.types].includes('Files')) $('#dropveil').hidden = false;
});
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('#dropveil').hidden = true; });
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  $('#dropveil').hidden = true;
  if (sheets.length || S.view !== 'wardrobe') return;
  const files = filesFrom(e.dataTransfer.files);
  if (!files.length) return;
  const cat = S.wardCat === 'all' ? 'top' : S.wardCat;
  for (const f of files) await createPieceFromFile(f, cat);
  toast(`Added ${files.length} to ${CAT[cat].label}${S.wardCat === 'all' ? ' — tap to change category' : ''}`);
  render();
});

window.addEventListener('paste', async (e) => {
  const files = filesFrom([...(e.clipboardData?.items || [])].filter(i => i.kind === 'file').map(i => i.getAsFile()));
  if (!files.length) return;
  const top = sheets[sheets.length - 1];
  if (top && top.opts.paste) { e.preventDefault(); top.opts.paste(files); return; }
  if (!top && S.view === 'wardrobe') {
    e.preventDefault();
    openPieceSheet(null, { category: S.wardCat === 'all' ? 'top' : S.wardCat, file: files[0] });
  }
});

// ---------------------------------------------------------------- pieces
function defaultName(cat) {
  const n = S.pieces.filter(p => p.category === cat).length + 1;
  return `${CAT[cat].one} ${n}`;
}

async function createPieceFromFile(file, category, name) {
  let blob;
  try { blob = await shrink(file); } catch { toast('Could not read that image'); return null; }
  const piece = { id: uid(), name: name || defaultName(category), category, image: blob, original: null, createdAt: Date.now(),
    color: await extractColor(blob).catch(() => null), colorSource: 'auto' };
  await db.put('pieces', piece);
  S.pieces.push(piece);
  if (S.settings.autoBg) queueBg(piece.id);
  return piece;
}

async function createPieceFromName(name, category) {
  const c = colorFromName(name);
  const piece = { id: uid(), name, category, image: null, original: null, createdAt: Date.now(), color: c, colorSource: c ? 'name' : null };
  await db.put('pieces', piece);
  S.pieces.push(piece);
  return piece;
}

// Background removal runs one at a time, in the background, then swaps images in place.
let bgChain = Promise.resolve();
let bgWarned = false;
function queueBg(id) {
  S.bgBusy.add(id);
  refreshBusy(id);
  bgChain = bgChain.then(() => runBg(id)).catch(() => { });
}
async function runBg(id) {
  const p0 = pieceById(id);
  if (!p0 || !p0.image) { S.bgBusy.delete(id); refreshBusy(id); return; }
  let firstToast = null;
  try {
    if (!bgWarned && !(await offlineReady())) { firstToast = toast('Cutting out background… first time downloads the AI model', null, 6000); }
    bgWarned = true;
    const src = p0.original || p0.image;
    const out = await removeBackground(src, (pct, key) => setBusyText(id, key && key.startsWith('fetch') ? `downloading AI ${pct}%` : 'cutting out…'));
    // Re-read the piece: it may have been edited or reloaded while the AI was working.
    const p = (await db.get('pieces', id)) || null;
    if (!p) return;
    const cur = p.original || p.image;
    if (!cur || cur.size !== src.size) return; // the photo was replaced meanwhile — don't overwrite it
    p.original = p.original || src;
    p.image = out;
    delete p.bgPending;
    if (p.colorSource !== 'manual') { const c = await extractColor(out).catch(() => null); if (c) { p.color = c; p.colorSource = 'auto'; } }
    await db.put('pieces', p);
    replacePiece(p);
  } catch (err) {
    console.warn('Background removal failed', err);
    const p = await db.get('pieces', id);
    if (p && looksLikeNetworkError(err)) {
      p.bgPending = true; await db.put('pieces', p); replacePiece(p);
      toast('No internet — Fitty will cut out the background when you\'re back online', null, 4000);
    } else toast('Background removal failed — kept the original photo');
  } finally {
    firstToast && firstToast.remove();
    S.bgBusy.delete(id);
    refreshBusy(id);
    render(); // show the result (or the "waiting for internet" badge) on the current page
  }
}
// Swap in an updated piece everywhere: memory, the current page, and any open window showing it.
function replacePiece(p) {
  const i = S.pieces.findIndex(x => x.id === p.id);
  if (i >= 0) S.pieces[i] = p; else S.pieces.push(p);
  render();
  window.dispatchEvent(new CustomEvent('fitty:piece-updated', { detail: p }));
}
// Pieces added while offline get their cut-out as soon as the internet is back.
function retryPendingBg() {
  if (!navigator.onLine || !S.settings.autoBg) return;
  for (const p of S.pieces) if (p.bgPending && p.image && !S.bgBusy.has(p.id)) queueBg(p.id);
}
window.addEventListener('online', retryPendingBg);
function setBusyText(id, text) {
  $$(`[data-busy="${id}"]`).forEach(el => { el.textContent = '✂︎ ' + text; });
}
// Update images in place so typing in an open sheet isn't interrupted.
function refreshBusy(id) {
  const p = pieceById(id);
  const url = p ? imageURL(p) : null;
  $$(`img[data-piece="${id}"]`).forEach(img => { if (url) img.src = url; });
  $$(`[data-busy="${id}"]`).forEach(el => el.classList.toggle('hidden', !S.bgBusy.has(id)));
}

function itemTile(p, { remove = false, selectable = false, selected = false, act = null, sub = null } = {}) {
  const url = imageURL(p);
  const tag = act || selectable ? 'button' : 'div';
  const attrs = act ? `data-act="${act}" data-id="${p.id}"` : '';
  return `<${tag} class="item ${url ? '' : 'textonly'} ${selected ? 'selected' : ''}" ${attrs}>
    <div class="img">${url ? `<img data-piece="${p.id}" src="${url}" alt="${esc(p.name)}" loading="lazy">` : esc(p.name)}</div>
    <div class="label"><b>${esc(p.name)}</b><span>${p.color ? `<i class="cdot" style="background:${p.color}" title="${esc(colorInfo(p.color).name)}"></i>` : ''}${esc(sub ?? CAT[p.category].one)}</span></div>
    <span class="busy ${S.bgBusy.has(p.id) ? '' : 'hidden'}" data-busy="${p.id}">✂︎ cutting out…</span>
    ${p.bgPending && !S.bgBusy.has(p.id) ? '<span class="pending">⏳ cut-out when online</span>' : ''}
    ${remove ? `<button class="x" data-act="remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">${icon('x')}</button>` : ''}
    ${selectable ? `<span class="check">${icon('check')}</span>` : ''}
  </${tag}>`;
}

function collage(ids) {
  const ps = sortPieces(ids).filter(p => p.category !== 'accessory' || ids.length <= 4);
  const show = (ps.length ? ps : sortPieces(ids)).slice(0, 4);
  const n = Math.max(1, show.length);
  const cells = show.map(p => {
    const u = imageURL(p);
    return u ? `<div class="c"><img data-piece="${p.id}" src="${u}" alt="" loading="lazy"></div>` : `<div class="c t">${esc(p.name)}</div>`;
  }).join('') || '<div class="c t">Empty</div>';
  return `<div class="collage n${n}">${cells}</div>`;
}

function fitHarmony(ids) {
  return harmony(ids.map(pieceById).filter(Boolean).map(p => ({ hex: p.color, category: p.category })));
}
function colorDots(ids, max = 5) {
  const cols = [...new Set(sortPieces(ids).filter(p => p.color && p.category !== 'accessory').map(p => p.color))].slice(0, max);
  return cols.length ? `<span class="cdots">${cols.map(c => `<i style="background:${c}"></i>`).join('')}</span>` : '';
}
function harmonyBadge(h) {
  if (!h) return '';
  const cls = h.score >= 0.9 ? 'great' : h.score >= 0.75 ? 'good' : h.score >= 0.55 ? 'bold' : 'clash';
  return `<span class="hbadge ${cls}">${esc(h.label)}</span>`;
}

// Fill in colors for pieces saved before v2 (runs quietly in the background).
async function backfillColors() {
  for (const p of S.pieces) {
    if (p.color || p.colorSource === 'manual' || p.colorChecked) continue;
    let c = null;
    if (p.image) c = await extractColor(p.image).catch(() => null);
    if (!c) c = colorFromName(p.name);
    p.color = c; p.colorSource = c ? (p.image ? 'auto' : 'name') : null; p.colorChecked = true;
    await db.putRaw('pieces', p);
    await new Promise(r => setTimeout(r, 30));
  }
  if (!sheets.length) render();
}

function weightDots(w) {
  return `<span class="wdots ${w <= 2 ? 'light' : ''}" title="Weight ${w}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= w ? 'on' : ''}"></i>`).join('')}</span>`;
}
function groupTag(gid) {
  const g = groupById(gid);
  return g ? `<span class="grouptag"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}</span>` : '';
}

// Temperature range text for each weight, from the mapping.
function weightRange(w) {
  const rules = [...S.settings.mapping].sort((a, b) => b.min - a.min);
  const i = rules.findIndex(r => r.weight === w);
  if (i < 0) return '';
  const lo = rules[i].min, hi = i > 0 ? rules[i - 1].min - 1 : null;
  if (lo <= -100) return `below ${hi + 1}°`;
  if (hi == null) return `${lo}°+`;
  return `${lo}–${hi}°`;
}
const daysAgo = (n) => (n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);
function niceDate(iso) {
  const d = fromISO(iso);
  if (iso === todayISO()) return 'Today';
  if (iso === tomorrowISO()) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------- weather
async function loadWeather(force = false) {
  S.weatherLoading = true;
  try {
    if (force) await db.setMeta(`forecast7:${S.settings.location.lat.toFixed(3)},${S.settings.location.lon.toFixed(3)}`, null);
    S.forecast = await getForecast(S.settings.location);
    S.weatherErr = null;
  } catch (e) {
    S.weatherErr = 'Weather unavailable';
  }
  S.weatherLoading = false;
  if (S.view === 'today' && !sheets.length) render(); else renderTopbar();
}
function dayWeather(date) { return S.forecast && S.forecast.days ? S.forecast.days[date] : null; }
// What the day feels like *for you*: forecast "feels like" plus your learned bias.
function learning() {
  return S.settings.learn ? computeLearning(S.wears, { since: S.settings.learnSince || 0 }) : { n: 0, biasC: 0, perFit: new Map(), justRightPct: null };
}
function personalFeels(date) {
  const w = dayWeather(date);
  if (!w) return null;
  return w.feels + (learning().biasC || 0);
}
function autoWeight(date) { const f = personalFeels(date); return f == null ? null : weightForTemp(f, S.settings.mapping); }
const weightOfFit = (f) => effectiveWeight(f, learning());
function targetWeight(date) { return S.manual[date] ?? autoWeight(date); }

// ---------------------------------------------------------------- navigation
const NAV = [['today', 'Today'], ['fits', 'Fits'], ['wardrobe', 'Wardrobe'], ['history', 'History'], ['settings', 'Settings']];
function renderNav() {
  const html = NAV.map(([id, label]) =>
    `<button class="tab ${S.view === id ? 'active' : ''}" data-nav="${id}">${icon(id)}<span>${label}</span></button>`).join('');
  $('#tabbar').innerHTML = html;
  $('#sidenav').innerHTML = html;
}
function renderTopbar() {
  const w = dayWeather(todayISO());
  const el = $('#topbar-right');
  let weather = '';
  if (w) {
    const [txt, emo] = describeCode(w.code);
    weather = `<button class="chip" data-nav="today" title="${esc(txt)} in ${esc(S.settings.location.name)}">${emo} ${Math.round(w.feels)}° today</button>`;
  }
  el.innerHTML = weather;
}

// ---------------------------------------------------------------- theme (light / dark / system)
const themeMQ = matchMedia('(prefers-color-scheme: dark)');
// Storage keys keep the old 'fitbud' prefix so existing data and settings carry over.
function themePref() { try { return localStorage.getItem('fitbud:theme') || 'light'; } catch { return 'light'; } }
function currentTheme() { const p = themePref(); return p === 'system' ? (themeMQ.matches ? 'dark' : 'light') : p; }
function applyTheme() {
  const t = currentTheme();
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = t === 'dark' ? '#151311' : '#F7F4EF';
}
function setTheme(pref) {
  try { localStorage.setItem('fitbud:theme', pref); } catch { }
  applyTheme(); renderTopbar();
  if (S.view === 'settings') render();
}
themeMQ.addEventListener && themeMQ.addEventListener('change', () => { if (themePref() === 'system') { applyTheme(); renderTopbar(); } });

document.addEventListener('click', (e) => {
  const n = e.target.closest('[data-nav]');
  if (!n) return;
  if (n.dataset.nav === S.view) { refreshFromStorage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else location.hash = n.dataset.nav;
});
// Every time you switch pages (or tap the page you're on), reload from storage so nothing is stale.
async function refreshFromStorage() {
  await reloadData();
  render();
}
window.addEventListener('hashchange', async () => {
  const v = location.hash.slice(1);
  if (NAV.some(([id]) => id === v) && v !== S.view) {
    S.view = v;
    render(); window.scrollTo(0, 0);   // instant
    await refreshFromStorage();       // then fresh
  }
});

function render() {
  renderNav(); renderTopbar();
  const view = $('#view');
  const fn = { today: viewToday, fits: viewFits, wardrobe: viewWardrobe, history: viewHistory, settings: viewSettings }[S.view];
  view.innerHTML = fn();
  const after = { today: afterToday, fits: afterFits, wardrobe: afterWardrobe, history: afterHistory, settings: afterSettings }[S.view];
  after && after(view);
}

// ================================================================= TODAY
async function savePlan() { await db.setMeta('plan', S.plan); }
function weekDates() {
  const out = [], d = new Date();
  for (let i = 0; i < 7; i++) { out.push(toISO(d)); d.setDate(d.getDate() + 1); }
  return out;
}
// Planned fits for other days count as "worn" so today's pick doesn't clash with your plan.
function planWears(exceptDate) {
  const worn = new Set(S.wears.map(w => w.date));
  return Object.entries(S.plan)
    .filter(([d, id]) => d !== exceptDate && !worn.has(d) && fitById(id))
    .map(([d, id]) => ({ fitId: id, date: d, pieceIds: fitById(id).pieceIds }));
}

function currentPick(date, tw) {
  const d = daily();
  const skips = new Set(d.skips[date] || []);
  const scored = scoreFits({
    fits: S.fits, pieces: S.pieces, wears: S.wears.concat(planWears(date)), targetDate: date, targetWeight: tw,
    groupId: S.group, blockDays: S.settings.blockDays, fadeDays: S.settings.fadeDays, skipped: skips, weightOf: weightOfFit,
  });
  const ok = (s) => s && !s.blocked && !s.skipped;
  let pick = null, fromPlan = false;
  const planned = S.plan[date] && scored.find(s => s.fit.id === S.plan[date]);
  if (ok(planned)) { pick = planned; fromPlan = true; }
  if (!pick) {
    const key = `${date}|${S.group}|${tw}`;
    pick = scored.find(s => s.fit.id === d.picks[key] && ok(s));
    if (!pick) {
      pick = pickWeighted(scored);
      if (pick) { d.picks[key] = pick.fit.id; saveDaily(d); }
    }
    // Keep an active week plan in sync with what Today shows.
    if (pick && S.plan[date]) { S.plan[date] = pick.fit.id; savePlan(); }
  }
  const eligible = scored.filter(ok).length;
  return { pick, scored, skips, eligible, fromPlan };
}

// The most recent worn day (last 4 days) you haven't rated yet.
function pendingFeedback() {
  const today = todayISO();
  return S.wears
    .filter(w => w.date < today && daysBetween(w.date, today) <= 4 && w.feel == null && !w.feelSkipped)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}
function feedbackCard(w) {
  const fit = fitById(w.fitId);
  const when = daysBetween(w.date, todayISO()) === 1 ? 'yesterday' : `on ${fromISO(w.date).toLocaleDateString(undefined, { weekday: 'long' })}`;
  return `<div class="card feel-card fade-in">
    <div class="feel-q"><div class="small muted">Quick check</div>
      <b>How did “${esc(fit ? fit.name : w.fitName)}” feel ${when}?</b>
      ${w.feels != null ? `<div class="small muted">It felt like ${Math.round(w.feels)}° outside</div>` : ''}</div>
    <div class="feel-btns">
      <button class="btn" data-act="feel" data-id="${w.id}" data-v="-1"><span class="fe">🥶</span><span>Too cold</span></button>
      <button class="btn" data-act="feel" data-id="${w.id}" data-v="0"><span class="fe">👌</span><span>Just right</span></button>
      <button class="btn" data-act="feel" data-id="${w.id}" data-v="1"><span class="fe">🥵</span><span>Too hot</span></button>
    </div>
    <button class="btn icon ghost feel-x" data-act="feel-skip" data-id="${w.id}" aria-label="Not now">${icon('x')}</button>
  </div>`;
}
async function setFeel(id, v) {
  const w = S.wears.find(x => x.id === id);
  if (!w) return;
  if (v === null) { w.feelSkipped = true; delete w.feel; }
  else { w.feel = v; w.feltAt = Date.now(); delete w.feelSkipped; }
  await db.put('wears', w);
  if (v !== null) toast(v === 0 ? 'Nice — noted' : 'Thanks — Fitty will adjust');
}

function groupChips(extraClass = '') {
  return S.groups.length ? `<div class="chips ${extraClass}">
      <button class="chip ${S.group === 'all' ? 'active' : ''}" data-act="group" data-g="all">All fits</button>
      ${S.groups.map(g => `<button class="chip ${S.group === g.id ? 'active' : ''}" data-act="group" data-g="${g.id}"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}</button>`).join('')}
    </div>` : '';
}

function viewToday() {
  const seg = `<div class="seg" role="tablist">
        <button class="${S.mode === 'today' ? 'active' : ''}" data-act="mode" data-m="today">Today</button>
        <button class="${S.mode === 'tomorrow' ? 'active' : ''}" data-act="mode" data-m="tomorrow">Tomorrow</button>
        <button class="${S.mode === 'week' ? 'active' : ''}" data-act="mode" data-m="week">Week</button>
      </div>`;
  const fb = pendingFeedback();
  const fbHTML = fb && S.fits.length ? feedbackCard(fb) : '';
  if (S.mode === 'week') {
    return `<div class="view-head"><div><h1>What to wear</h1></div>${seg}</div>${fbHTML}${viewWeek()}`;
  }
  const date = targetDate();
  const w = dayWeather(date);
  const auto = autoWeight(date);
  const tw = targetWeight(date);
  const wear = S.wears.find(x => x.date === date);
  const L = learning();

  let weatherHTML;
  if (w) {
    const [txt, emo] = describeCode(w.code);
    const pf = personalFeels(date);
    weatherHTML = `
      <div class="small muted">${esc(niceDate(date))} · ${esc(S.settings.location.name.split(',')[0])}</div>
      <div class="big"><div class="emoji">${emo}</div><div class="temp">${Math.round(w.feels)}°<small> feels like</small></div></div>
      <div class="meta"><span>${esc(txt)}</span><span>↑ ${Math.round(w.max)}° ↓ ${Math.round(w.min)}°</span>${w.rain != null ? `<span>☂ ${w.rain}%</span>` : ''}</div>
      ${Math.abs(L.biasC) >= 0.5 ? `<div class="learned-note">${L.biasC < 0 ? '🥶' : '🥵'} For you it's more like <b>${Math.round(pf)}°</b> — you tend to feel ${L.biasC < 0 ? 'cold' : 'warm'}</div>` : ''}`;
  } else {
    weatherHTML = `<div class="small muted">${esc(niceDate(date))}</div>
      <div class="big"><div class="emoji">🌡️</div><div><h3>${S.weatherLoading ? 'Checking the weather…' : 'No forecast'}</h3>
      <div class="small muted">${S.weatherLoading ? '' : 'Pick the day\'s weight below, or retry.'}</div></div></div>
      ${S.weatherLoading ? '' : '<button class="btn sm" data-act="retry-weather">Retry</button>'}`;
  }
  const targetHTML = `
    <div class="target">
      <div class="small"><b>Fit weight for the day:</b> <span class="muted">${tw == null ? 'any' : `${tw} · ${WEIGHT_WORDS[tw]}`}</span></div>
      <div class="target-row">
        <button class="wbtn auto ${S.manual[date] == null ? 'active' : ''}" data-act="manual" data-w="auto">Auto${auto != null ? ` (${auto})` : ''}</button>
        ${[0, 1, 2, 3, 4, 5].map(i => `<button class="wbtn ${S.manual[date] === i ? 'active' : ''} ${auto === i ? 'suggested' : ''}" data-act="manual" data-w="${i}">${i}</button>`).join('')}
      </div>
    </div>`;

  let recHTML;
  if (!S.fits.length) {
    recHTML = `<div class="card empty fade-in"><div class="art">🧥</div><h2>No fits yet</h2>
      <p>Build your first outfit — add the pieces, set how warm it is, and Fitty takes it from there.</p>
      <button class="btn primary lg" data-act="new-fit">${icon('plus')} Create a fit</button></div>`;
  } else if (wear) {
    const fit = fitById(wear.fitId);
    const ps = sortPieces(wear.pieceIds);
    recHTML = `<div class="card rec fade-in">
      <div class="rec-head"><div><span class="wearing-badge">${icon('check').replace('<svg', '<svg width="15" height="15"')} Wearing ${esc(niceDate(date).toLowerCase())}</span>
        <h2 style="margin-top:10px">${esc(fit ? fit.name : wear.fitName)}</h2>
        <div class="small muted" style="margin-top:4px">${fit ? groupTag(fit.groupId) : '(fit deleted)'}</div></div></div>
      <div class="flatlay big">${ps.map(p => itemTile(p)).join('')}</div>
      <div class="rec-actions">
        <button class="btn" data-act="undo-wear" data-id="${wear.id}">${icon('undo')} Undo</button>
        ${fit ? `<button class="btn" data-act="edit-fit" data-id="${fit.id}">${icon('edit')} Edit fit</button>` : '<span></span>'}
      </div></div>`;
  } else {
    const { pick, scored, skips, eligible, fromPlan } = currentPick(date, tw);
    if (!pick) {
      const inGroup = scored.length;
      recHTML = `<div class="card empty fade-in"><div class="art">🧺</div>
        <h2>${inGroup ? 'Nothing left to suggest' : 'No fits in this group'}</h2>
        <p>${inGroup ? (skips.size ? 'You skipped the rest, and the others are resting after being worn recently.' : 'Every fit here was worn in the last couple of days. Add more fits or change the group.') : 'Add fits to this group from the Fits tab.'}</p>
        <div class="fab-row" style="justify-content:center">
          ${skips.size ? `<button class="btn" data-act="reset-skips">${icon('undo')} Bring back skipped</button>` : ''}
          <button class="btn primary" data-act="new-fit">${icon('plus')} New fit</button>
        </div></div>`;
    } else {
      const f = pick.fit;
      const ps = sortPieces(f.pieceIds);
      const eff = weightOfFit(f);
      const h = fitHarmony(f.pieceIds);
      const reasons = [];
      if (fromPlan) reasons.push('📅 From your week plan');
      if (tw != null) reasons.push(Math.abs(eff - tw) < 0.5 ? `Weight ${f.weight} — right for the day` : `Weight ${f.weight} · day is ${tw}`);
      if (Math.abs(eff - f.weight) >= 0.3) reasons.push(`Feels like a ${eff.toFixed(1)} for you`);
      reasons.push(pick.lastWorn ? `Last worn ${daysAgo(pick.daysSince)}` : 'Never worn yet');
      if (h) reasons.push(`🎨 ${h.label}`);
      if (pick.pieceF < 0.9) reasons.push('Shares pieces worn recently');
      reasons.push(`${eligible} option${eligible === 1 ? '' : 's'} for ${niceDate(date).toLowerCase()}`);
      recHTML = `<div class="card rec fade-in" data-fit="${f.id}">
        <div class="rec-head"><div>
          <div class="small muted">Fitty suggests</div>
          <h2 style="margin-top:2px">${esc(f.name)}</h2>
          <div class="small" style="margin-top:6px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">${groupTag(f.groupId)} ${weightDots(f.weight)} ${colorDots(f.pieceIds)}</div>
        </div><button class="btn icon ghost" data-act="edit-fit" data-id="${f.id}" aria-label="Edit fit">${icon('edit')}</button></div>
        <div class="flatlay big">${ps.map(p => itemTile(p)).join('')}</div>
        <div class="reasons">${reasons.map(r => `<span class="reason">${esc(r)}</span>`).join('')}</div>
        <div class="rec-actions">
          <button class="btn lg" data-act="skip" data-id="${f.id}">${icon('shuffle')} Skip</button>
          <button class="btn lg primary" data-act="accept" data-id="${f.id}">${icon('check')} Wear this</button>
        </div></div>`;
    }
  }

  return `
    <div class="view-head"><div><h1>What to wear</h1></div>${seg}</div>
    ${fbHTML}
    <div class="today-grid">
      <div><div class="card weather">${weatherHTML}${targetHTML}</div>${groupChips('mt')}</div>
      <div>${recHTML}</div>
    </div>`;
}

// ---------------------------------------------------------------- Week planner
function viewWeek() {
  const dates = weekDates();
  const today = todayISO(), tmr = tomorrowISO();
  const hasPlan = dates.some(d => S.plan[d] && fitById(S.plan[d]) && !S.wears.some(w => w.date === d));
  if (!S.fits.length) return `<div class="card empty"><div class="art">📅</div><h2>Nothing to plan yet</h2><p>Create a few fits first, then Fitty can plan your week.</p><button class="btn primary lg" data-act="new-fit">${icon('plus')} Create a fit</button></div>`;
  const rows = dates.map(date => {
    const w = dayWeather(date);
    const wear = S.wears.find(x => x.date === date);
    const fit = wear ? fitById(wear.fitId) : fitById(S.plan[date]);
    const tw = targetWeight(date);
    const d = fromISO(date);
    const [txt, emo] = w ? describeCode(w.code) : ['', '🌡️'];
    const label = date === today ? 'Today' : date === tmr ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long' });
    const ids = wear ? wear.pieceIds : fit ? fit.pieceIds : [];
    const h = ids.length ? fitHarmony(ids) : null;
    let act = '';
    if (wear) act = `<span class="wearing-badge">${icon('check').replace('<svg', '<svg width="14" height="14"')} ${date === today ? 'Wearing' : 'Logged'}</span>`;
    else if (fit) act = `<button class="btn sm" data-act="wk-swap" data-d="${date}" title="Pick another fit">${icon('shuffle')} Swap</button>
      ${date <= tmr ? `<button class="btn sm primary" data-act="wk-wear" data-d="${date}">${icon('check')} Wear</button>` : ''}`;
    else if (hasPlan) act = `<button class="btn sm" data-act="wk-swap" data-d="${date}">${icon('shuffle')} Pick</button>`;
    return `<div class="card wk-row ${date === today ? 'is-today' : ''}">
      <div class="wk-date"><b>${esc(label)}</b><span>${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
      <div class="wk-wx" title="${esc(txt)}">${emo}<span>${w ? Math.round(w.feels) + '°' : '—'}</span><small>${tw != null ? 'weight ' + tw : ''}</small></div>
      <div class="wk-fit">${ids.length ? `<div class="wk-thumb">${collage(ids)}</div><div class="wk-name"><b>${esc(fit ? fit.name : wear.fitName)}</b><span>${fit ? weightDots(fit.weight) : ''} ${harmonyBadge(h)}</span></div>`
        : `<div class="wk-name muted small">${hasPlan ? 'Nothing fits this day' : 'Not planned'}</div>`}</div>
      <div class="wk-act">${act}</div>
    </div>`;
  }).join('');
  return `<div class="wk-head">
      <div>${groupChips()}</div>
      <button class="btn ${hasPlan ? '' : 'primary'}" data-act="wk-plan">${icon('shuffle')} ${hasPlan ? 'Re-plan week' : 'Plan my week'}</button>
    </div>
    ${hasPlan ? '' : '<p class="muted small" style="margin:0 0 12px">Fitty picks a fit for each of the next 7 days using the forecast — no repeats too close together.</p>'}
    <div class="wk-list">${rows}</div>`;
}

function makePlan() {
  const dates = weekDates();
  S.plan = buildPlan({
    dates, fits: S.fits, pieces: S.pieces, wears: S.wears, targetWeightFor: (d) => targetWeight(d),
    groupId: S.group, blockDays: S.settings.blockDays, fadeDays: S.settings.fadeDays, weightOf: weightOfFit,
  });
  savePlan();
}

function afterToday(view) {
  view.onclick = async (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const date = targetDate();
    switch (a.dataset.act) {
      case 'mode': S.mode = a.dataset.m; render(); break;
      case 'group': S.group = a.dataset.g; render(); break;
      case 'manual': {
        const v = a.dataset.w;
        if (v === 'auto') delete S.manual[date]; else S.manual[date] = Number(v);
        render(); break;
      }
      case 'retry-weather': loadWeather(true); render(); break;
      case 'new-fit': openFitEditor(null); break;
      case 'edit-fit': openFitEditor(fitById(a.dataset.id)); break;
      case 'skip': {
        const d = daily();
        (d.skips[date] = d.skips[date] || []).push(a.dataset.id);
        saveDaily(d); render(); break;
      }
      case 'reset-skips': { const d = daily(); delete d.skips[date]; saveDaily(d); render(); break; }
      case 'accept': await acceptFit(fitById(a.dataset.id), date); break;
      case 'undo-wear': undoWear(a.dataset.id); break;
      case 'feel': await setFeel(a.dataset.id, Number(a.dataset.v)); render(); break;
      case 'feel-skip': await setFeel(a.dataset.id, null); render(); break;
      case 'wk-plan': makePlan(); render(); toast('Week planned'); break;
      case 'wk-swap': {
        const d = a.dataset.d;
        const id = repickDay({
          date: d, plan: S.plan, fits: S.fits, pieces: S.pieces, wears: S.wears, targetWeight: targetWeight(d),
          groupId: S.group, blockDays: S.settings.blockDays, fadeDays: S.settings.fadeDays, weightOf: weightOfFit,
        });
        if (id && id !== S.plan[d]) { S.plan[d] = id; savePlan(); render(); }
        else toast('No other fit works for that day');
        break;
      }
      case 'wk-wear': await acceptFit(fitById(S.plan[a.dataset.d]), a.dataset.d); break;
    }
  };
}

async function acceptFit(fit, date) {
  if (!fit) return;
  const w = dayWeather(date);
  const wear = {
    id: uid(), fitId: fit.id, fitName: fit.name, date, pieceIds: [...fit.pieceIds],
    feels: w ? w.feels : null, code: w ? w.code : null, targetWeight: targetWeight(date), createdAt: Date.now(),
  };
  await db.put('wears', wear);
  S.wears.push(wear);
  render();
  toast(`Logged for ${niceDate(date).toLowerCase()}`, { label: 'Undo', run: () => undoWear(wear.id) });
}

async function undoWear(id) {
  await db.del('wears', id);
  S.wears = S.wears.filter(w => w.id !== id);
  if (!sheets.length) render();
  toast('Removed from history');
}

// ================================================================= FITS
function viewFits() {
  const gid = S.fitsGroup;
  let fits = [...S.fits];
  if (gid === 'none') fits = fits.filter(f => !f.groupId || !groupById(f.groupId));
  else if (gid !== 'all') fits = fits.filter(f => f.groupId === gid);
  fits.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const lastMap = new Map();
  for (const w of S.wears) if (!lastMap.has(w.fitId) || lastMap.get(w.fitId) < w.date) lastMap.set(w.fitId, w.date);
  const hasUngrouped = S.fits.some(f => !f.groupId || !groupById(f.groupId));

  const cards = fits.map(f => {
    const last = lastMap.get(f.id);
    const lastTxt = last ? (last > todayISO() ? 'Planned tomorrow' : `Worn ${daysAgo(daysBetween(last, todayISO()))}`) : 'Not worn yet';
    return `<button class="fitcard" data-act="edit" data-id="${f.id}">
      ${collage(f.pieceIds)}
      <div class="body"><div class="name">${esc(f.name)}</div>
        <div class="sub"><span>${groupTag(f.groupId) || `${f.pieceIds.length} pieces`}</span>${weightDots(f.weight)}</div>
        <div class="sub"><span>${esc(lastTxt)}</span>${colorDots(f.pieceIds, 4)}</div></div>
    </button>`;
  }).join('');

  return `
    <div class="view-head"><div><h1>Your fits</h1><p class="muted">${S.fits.length} outfit${S.fits.length === 1 ? '' : 's'}</p></div>
      <div class="fab-row"><button class="btn" data-act="ideas">${icon('wand')} Ideas</button>
      <button class="btn primary" data-act="new">${icon('plus')} New fit</button></div></div>
    <div class="chips" style="margin-bottom:16px">
      <button class="chip ${gid === 'all' ? 'active' : ''}" data-act="filter" data-g="all">All</button>
      ${S.groups.map(g => `<button class="chip ${gid === g.id ? 'active' : ''}" data-act="filter" data-g="${g.id}"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}</button>`).join('')}
      ${S.groups.length && hasUngrouped ? `<button class="chip ${gid === 'none' ? 'active' : ''}" data-act="filter" data-g="none">No group</button>` : ''}
      <button class="chip" data-act="new-group">${icon('plus').replace('<svg', '<svg width="14" height="14"')} Group</button>
    </div>
    ${fits.length ? `<div class="fit-grid">${cards}</div>` : `<div class="card empty"><div class="art">👕</div><h2>${S.fits.length ? 'No fits in this group' : 'Start your rotation'}</h2>
      <p>${S.fits.length ? 'Create one here or move fits into this group from the editor.' : 'A fit is a full outfit: tops, bottoms, outerwear, shoes and accessories.'}</p>
      <button class="btn primary lg" data-act="new">${icon('plus')} Create a fit</button></div>`}`;
}
function afterFits(view) {
  view.onclick = async (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    switch (a.dataset.act) {
      case 'new': openFitEditor(null); break;
      case 'ideas': openIdeas(); break;
      case 'edit': openFitEditor(fitById(a.dataset.id)); break;
      case 'filter': S.fitsGroup = a.dataset.g; render(); break;
      case 'new-group': { const g = await newGroup(); if (g) { S.fitsGroup = g.id; render(); } break; }
    }
  };
}

async function newGroup() {
  const name = await promptText({ title: 'New group', placeholder: 'e.g. Work, Casual, Gym', ok: 'Create' });
  if (!name) return null;
  const g = { id: uid(), name, color: GROUP_COLORS[S.groups.length % GROUP_COLORS.length], createdAt: Date.now() };
  await db.put('groups', g);
  S.groups.push(g);
  return g;
}

// ---------------------------------------------------------------- Fit editor
function colorStrip(ids) {
  const ps = sortPieces(ids).filter(p => p.category !== 'accessory');
  if (!ps.length) return '';
  const h = fitHarmony(ids);
  return `<div class="color-strip">
    <div class="swatches">${ps.map(p => `<span class="sw" style="background:${p.color || 'transparent'}" title="${esc(p.name)}${p.color ? ' · ' + esc(colorInfo(p.color).name) : ' · no color yet'}">${p.color ? '' : '?'}</span>`).join('')}</div>
    <div class="ch-text">${h ? `${harmonyBadge(h)} <span class="small muted">${esc(h.reason)}</span>` : '<span class="small muted">Add a couple of pieces with colors to see how they match.</span>'}</div>
  </div>`;
}

// ---------------------------------------------------------------- Combo ideas
async function openIdeas() {
  if (openEditor && !openEditor.closed) { toast('Save or close the fit you\'re editing first'); return; }
  const tw = targetWeight(tomorrowISO());
  let ideas = [];
  const gen = () => { ideas = generateIdeas({ pieces: S.pieces, fits: S.fits, wears: S.wears, targetWeight: tw, dismissed: S.dismissedIdeas }); };
  gen();
  const h = openSheet({
    title: 'Combo ideas',
    body: () => {
      const tops = S.pieces.filter(p => p.category === 'top').length, bottoms = S.pieces.filter(p => p.category === 'bottom').length;
      if (!tops || !bottoms) return `<div class="empty" style="padding:24px 8px"><div class="art">✨</div><h3>Need a few more pieces</h3><p>Add at least one top and one bottom to your wardrobe and Fitty will start mixing them.</p></div>`;
      if (!ideas.length) return `<div class="empty" style="padding:24px 8px"><div class="art">🧩</div><h3>You've tried every mix</h3><p>Every top + bottom pair is already a fit (or you passed on it). Add new pieces for fresh ideas.</p>
        ${S.dismissedIdeas.size ? '<button class="btn" data-act="reset-dismissed">Show ideas I passed on</button>' : ''}</div>`;
      return `<p class="small muted" style="margin:0 0 14px">New pairings from pieces you own, ranked by color match${tw != null ? ` and tomorrow's weather (weight ${tw})` : ''}.</p>
        <div class="ideas">${ideas.map((idea, i) => `
          <div class="idea card">
            <div class="idea-collage">${collage(idea.pieceIds)}</div>
            <div class="idea-body">
              <div class="idea-top">${harmonyBadge(idea.harmony)} ${weightDots(idea.weight)}</div>
              <div class="idea-names">${sortPieces(idea.pieceIds).map(p => `<span>${p.color ? `<i class="cdot" style="background:${p.color}"></i>` : ''}${esc(p.name)}</span>`).join('')}</div>
              ${idea.harmony ? `<div class="small muted">${esc(idea.harmony.reason)}</div>` : ''}
              <div class="idea-actions">
                <button class="btn sm" data-act="pass" data-i="${i}">Not for me</button>
                <button class="btn sm primary" data-act="use" data-i="${i}">${icon('plus')} Save as fit</button>
              </div>
            </div>
          </div>`).join('')}</div>`;
    },
    foot: () => ideas.length ? `<button class="btn grow" data-act="more">${icon('shuffle')} Shuffle ideas</button>` : '',
    onAct: async (act, el, e, hh) => {
      if (act === 'pass') {
        const idea = ideas[Number(el.dataset.i)];
        S.dismissedIdeas.add(idea.key); await db.setMeta('dismissedIdeas', [...S.dismissedIdeas]);
        ideas.splice(Number(el.dataset.i), 1);
        if (ideas.length < 3) gen();
        hh.rerender();
      } else if (act === 'use') {
        const idea = ideas[Number(el.dataset.i)];
        hh.close();
        setTimeout(() => openFitEditor(null, { pieceIds: idea.pieceIds, weight: idea.weight }), 50);
      } else if (act === 'more') { gen(); hh.rerender(); hh.body.scrollTop = 0; }
      else if (act === 'reset-dismissed') { S.dismissedIdeas.clear(); await db.setMeta('dismissedIdeas', []); gen(); hh.rerender(); }
    },
  });
}

let openEditor = null; // only one fit editor at a time
function openFitEditor(fit, preset = {}) {
  if (openEditor && !openEditor.closed) {
    if (fit && openEditor.fitId === fit.id) { openEditor.el.style.zIndex = ++zTop; return; }
    toast('Save or close the fit you\'re editing first');
    openEditor.el.style.zIndex = ++zTop;
    const sh = $('.sheet', openEditor.el);
    if (sh.classList.contains('collapsed')) $('[data-peek]', openEditor.el)?.click();
    return;
  }
  const isNew = !fit;
  const tw = targetWeight(targetDate());
  const draft = fit
    ? { ...fit, pieceIds: [...fit.pieceIds] }
    : {
      id: uid(), name: '', pieceIds: preset.pieceIds ? [...preset.pieceIds] : [], weight: preset.weight ?? tw ?? 2,
      groupId: preset.groupId ?? (S.fitsGroup !== 'all' && S.fitsGroup !== 'none' ? S.fitsGroup : (S.group !== 'all' ? S.group : null)),
      createdAt: Date.now(),
    };
  let activeCat = 'top';
  let dirty = false;
  let picker = null;
  if (S.settings.autoBg) warmUpBackgroundRemoval();
  const scrollToSlot = () => {
    const s = $(`.slot[data-drop="${activeCat}"]`, h.el);
    if (s && picker && !picker.closed) s.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const addFiles = async (files, cat) => {
    cat = cat || activeCat;
    activeCat = cat;
    const t = files.length > 1 ? toast(`Adding ${files.length} photos…`) : null;
    for (const f of files) {
      const p = await createPieceFromFile(f, cat);
      if (p) draft.pieceIds.push(p.id);
    }
    t && t.remove();
    dirty = true;
    h.rerender();
  };

  const h = openSheet({
    cls: 'full', movable: 'editor',
    title: () => (isNew ? 'New fit' : 'Edit fit'),
    body: () => {
      const groupOpts = `<option value="">No group</option>${S.groups.map(g => `<option value="${g.id}" ${draft.groupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}<option value="__new">+ New group…</option>`;
      const slots = CATS.map(c => {
        const ps = draft.pieceIds.map(pieceById).filter(p => p && p.category === c.id);
        return `<div class="slot ${activeCat === c.id ? 'active-slot' : ''}" data-drop="${c.id}">
          <div class="slot-head"><h3>${c.label} <span class="count">${ps.length || ''}</span></h3></div>
          <div class="flatlay">
            ${ps.map(p => itemTile(p, { remove: true })).join('')}
            <button class="add-tile" data-act="pick" data-cat="${c.id}">${icon('plus')}<span>Add ${c.one.toLowerCase()}</span></button>
          </div>
          ${isDesktop() && !ps.length ? '<div class="slot-hint">Drag photos here, or paste with Ctrl+V</div>' : ''}
        </div>`;
      }).join('');
      return `
        <label class="field"><span>Name</span><input class="input" data-k="name" placeholder="Fit #${S.fits.length + (isNew ? 1 : 0)}" value="${esc(draft.name)}" maxlength="40"></label>
        <label class="field"><span>Group</span><select class="input" data-k="group">${groupOpts}</select></label>
        <div class="weight-box">
          <div class="weight-top"><div><div class="small muted">Fit weight</div><div class="weight-val" data-wv>${draft.weight} <span class="small muted" style="font-family:var(--sans)">${WEIGHT_WORDS[draft.weight]}</span></div></div>
          <div class="small muted" data-wr>Best when it feels ${esc(weightRange(draft.weight))}</div></div>
          <input type="range" class="range" min="0" max="5" step="1" value="${draft.weight}" data-k="weight" aria-label="Fit weight">
          <div class="range-labels"><span>☀️ 0 · light</span><span>heavy · 5 ❄️</span></div>
          ${(() => { const L = learning(), adj = L.perFit.get(draft.id); return adj ? `<div class="learned-note">From your feedback this fit feels like a <b>${effectiveWeight(draft, L).toFixed(1)}</b> — Fitty uses that when picking.</div>` : ''; })()}
        </div>
        ${colorStrip(draft.pieceIds)}
        ${slots}`;
    },
    foot: () => `${isNew ? '' : `<button class="btn danger" data-act="delete">${icon('trash')}</button>`}
      <button class="btn grow" data-close>Cancel</button>
      <button class="btn grow primary" data-act="save">Save fit</button>`,
    onInput: (e) => {
      const k = e.target.dataset.k;
      if (k === 'name') { draft.name = e.target.value; dirty = true; }
      if (k === 'weight') {
        draft.weight = Number(e.target.value); dirty = true;
        $('[data-wv]', h.el).innerHTML = `${draft.weight} <span class="small muted" style="font-family:var(--sans)">${WEIGHT_WORDS[draft.weight]}</span>`;
        $('[data-wr]', h.el).textContent = `Best when it feels ${weightRange(draft.weight)}`;
      }
    },
    onChange: async (e) => {
      if (e.target.dataset.k !== 'group') return;
      if (e.target.value === '__new') {
        const g = await newGroup();
        draft.groupId = g ? g.id : draft.groupId;
        h.rerender();
      } else { draft.groupId = e.target.value || null; }
      dirty = true;
    },
    onAct: async (act, el) => {
      if (act === 'pick') {
        if (picker && !picker.closed) picker.close();
        activeCat = el.dataset.cat;
        picker = openPicker(activeCat, draft, () => { dirty = true; h.rerender(); scrollToSlot(); });
      } else if (act === 'remove') {
        draft.pieceIds = draft.pieceIds.filter(id => id !== el.dataset.id);
        dirty = true; h.rerender();
        if (picker && !picker.closed) picker.rerender();
      } else if (act === 'save') {
        if (!draft.pieceIds.length) { toast('Add at least one piece first'); return; }
        draft.name = draft.name.trim() || `Fit #${S.fits.length + (isNew ? 1 : 0)}`;
        await db.put('fits', draft);
        const i = S.fits.findIndex(f => f.id === draft.id);
        if (i >= 0) S.fits[i] = draft; else S.fits.push(draft);
        dirty = false;
        h.close(); render();
        toast(isNew ? 'Fit saved' : 'Fit updated');
      } else if (act === 'delete') {
        if (!(await ask({ title: 'Delete this fit?', text: 'Its pieces stay in your wardrobe and past history is kept.', ok: 'Delete', danger: true }))) return;
        await db.del('fits', draft.id);
        S.fits = S.fits.filter(f => f.id !== draft.id);
        h.close(); render(); toast('Fit deleted');
      }
    },
    drop: (files, cat) => addFiles(files, cat),
    paste: (files) => addFiles(files, activeCat),
    onClose: () => { if (picker && !picker.closed) picker._close(); },
  });
  h.fitId = draft.id;
  openEditor = h;
  // Track which slot was touched last so paste goes there.
  h.el.addEventListener('pointerdown', (e) => {
    const s = e.target.closest('[data-drop]');
    if (s && s.dataset.drop !== activeCat) {
      activeCat = s.dataset.drop;
      $$('.slot', h.el).forEach(x => x.classList.toggle('active-slot', x.dataset.drop === activeCat));
    }
  });
}

// ---------------------------------------------------------------- Piece picker (add to a fit)
function openPicker(cat, draft, onChange) {
  let q = '';
  const addFiles = async (files) => {
    for (const f of files) {
      const p = await createPieceFromFile(f, cat);
      if (p) draft.pieceIds.push(p.id);
    }
    onChange(); h.rerender();
    toast(`Added ${files.length} photo${files.length > 1 ? 's' : ''}`);
  };
  const h = openSheet({
    movable: 'picker', cls: 'picker',
    title: `Add ${CAT[cat].label.toLowerCase()}`,
    autofocus: '[data-k=newname]',
    body: () => {
      const lib = S.pieces.filter(p => p.category === cat && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const total = S.pieces.filter(p => p.category === cat).length;
      return `
        <div class="row" style="margin-bottom:12px">
          <input class="input" data-k="newname" placeholder="Add by name, e.g. ${cat === 'bottom' ? 'Black jeans' : cat === 'shoes' ? 'White sneakers' : cat === 'accessory' ? 'Silver watch' : cat === 'outerwear' ? 'Denim jacket' : 'White tee'}" maxlength="40">
          <button class="btn primary" data-act="add-name">Add</button>
        </div>
        <div class="dropzone" data-drop="${cat}">
          <div>${isDesktop() ? 'Drop or paste photos here' : 'Add with a photo'}</div>
          <div class="btns">
            <button class="btn sm" data-act="gallery">${icon('image')} Photos</button>
            <button class="btn sm" data-act="camera">${icon('camera')} Camera</button>
          </div>
          <input type="file" accept="image/*" multiple hidden data-file="gallery">
          <input type="file" accept="image/*" capture="environment" hidden data-file="camera">
        </div>
        <div class="section-title">From your wardrobe${total ? ` · ${total}` : ''}</div>
        ${total > 8 ? `<input class="input" data-k="q" placeholder="Search ${CAT[cat].label.toLowerCase()}" value="${esc(q)}" style="margin-bottom:10px">` : ''}
        ${lib.length ? `<div class="flatlay">${lib.map(p => itemTile(p, { act: 'toggle', selectable: true, selected: draft.pieceIds.includes(p.id) })).join('')}</div>`
          : `<p class="muted small">${total ? 'No matches.' : `No ${CAT[cat].label.toLowerCase()} yet — add one above.`}</p>`}`;
    },
    foot: () => `<button class="btn grow primary" data-close>Done</button>`,
    onRender: (hh) => {
      const ni = $('[data-k=newname]', hh.el);
      ni && ni.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-act=add-name]', hh.el).click(); } });
      $$('input[type=file]', hh.el).forEach(inp => inp.addEventListener('change', () => {
        const files = filesFrom(inp.files);
        inp.value = '';
        if (files.length) addFiles(files);
      }));
    },
    onInput: (e) => {
      if (e.target.dataset.k === 'q') {
        q = e.target.value;
        const pos = e.target.selectionStart;
        h.rerender();
        const i = $('[data-k=q]', h.el); i.focus(); i.setSelectionRange(pos, pos);
      }
    },
    onAct: async (act, el) => {
      if (act === 'toggle') {
        const id = el.dataset.id;
        if (draft.pieceIds.includes(id)) draft.pieceIds = draft.pieceIds.filter(x => x !== id);
        else draft.pieceIds.push(id);
        el.classList.toggle('selected');
        onChange();
      } else if (act === 'add-name') {
        const inp = $('[data-k=newname]', h.el);
        const name = inp.value.trim();
        if (!name) { inp.focus(); return; }
        const p = await createPieceFromName(name, cat);
        draft.pieceIds.push(p.id);
        onChange(); h.rerender();
        const ni = $('[data-k=newname]', h.el); if (isDesktop()) ni.focus();
        toast(`Added “${name}”`);
      } else if (act === 'gallery' || act === 'camera') {
        $(`input[data-file=${act}]`, h.el).click();
      }
    },
    drop: (files) => addFiles(files),
    paste: (files) => addFiles(files),
  });
  return h;
}

// ================================================================= WARDROBE
function viewWardrobe() {
  const counts = Object.fromEntries(CATS.map(c => [c.id, S.pieces.filter(p => p.category === c.id).length]));
  const list = S.pieces.filter(p => S.wardCat === 'all' || p.category === S.wardCat)
    .sort((a, b) => CAT[a.category].i - CAT[b.category].i || (b.createdAt || 0) - (a.createdAt || 0));
  const usage = (id) => S.fits.filter(f => f.pieceIds.includes(id)).length;
  return `
    <div class="view-head"><div><h1>Wardrobe</h1><p class="muted">${S.pieces.length} piece${S.pieces.length === 1 ? '' : 's'}${isDesktop() ? ' · drop or paste photos anywhere here' : ''}</p></div>
      <button class="btn primary" data-act="add">${icon('plus')} Add piece</button></div>
    <div class="chips" style="margin-bottom:16px">
      <button class="chip ${S.wardCat === 'all' ? 'active' : ''}" data-act="cat" data-c="all">All</button>
      ${CATS.map(c => `<button class="chip ${S.wardCat === c.id ? 'active' : ''}" data-act="cat" data-c="${c.id}">${c.label}${counts[c.id] ? ` · ${counts[c.id]}` : ''}</button>`).join('')}
    </div>
    ${list.length ? `<div class="flatlay">${list.map(p => {
      const u = usage(p.id);
      return itemTile(p, { act: 'edit', sub: `${CAT[p.category].one} · ${u ? `in ${u} fit${u > 1 ? 's' : ''}` : 'unused'}` });
    }).join('')}</div>`
      : `<div class="card empty"><div class="art">🪡</div><h2>Nothing here yet</h2><p>Pieces you add to fits show up here, so you can reuse them across outfits.</p>
        <button class="btn primary lg" data-act="add">${icon('plus')} Add a piece</button></div>`}`;
}
function afterWardrobe(view) {
  view.onclick = (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'cat') { S.wardCat = a.dataset.c; render(); }
    if (a.dataset.act === 'add') openPieceSheet(null, { category: S.wardCat === 'all' ? 'top' : S.wardCat });
    if (a.dataset.act === 'edit') openPieceSheet(pieceById(a.dataset.id));
  };
}

// ---------------------------------------------------------------- Piece sheet (new / edit)
let openPiece = null; // only one piece window at a time
function openPieceSheet(piece, { category = 'top', file = null } = {}) {
  if (openPiece && !openPiece.closed) {
    if (piece && openPiece.pieceId === piece.id) { openPiece.el.style.zIndex = ++zTop; return; }
    toast('Save or close the piece you\'re editing first');
    openPiece.el.style.zIndex = ++zTop;
    if ($('.sheet', openPiece.el).classList.contains('collapsed')) $('[data-peek]', openPiece.el)?.click();
    return;
  }
  const isNew = !piece;
  const d = piece ? { ...piece } : { id: uid(), name: '', category, image: null, original: null, createdAt: Date.now() };
  let previewURL = null, busy = false, imageChanged = false;
  const autoColor = async () => {
    if (d.colorSource === 'manual') return;
    let c = d.image ? await extractColor(d.image).catch(() => null) : null;
    if (c) { d.color = c; d.colorSource = 'auto'; return; }
    c = colorFromName(d.name);
    d.color = c; d.colorSource = c ? 'name' : null;
  };
  const setImage = async (f) => {
    try { d.image = await shrink(f); d.original = null; imageChanged = true; await autoColor(); } catch { toast('Could not read that image'); }
    h.rerender();
  };
  const url = () => {
    if (!d.image) return null;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(d.image);
    return previewURL;
  };
  const fitsUsing = () => S.fits.filter(f => f.pieceIds.includes(d.id));
  if (S.settings.autoBg) warmUpBackgroundRemoval();

  const h = openSheet({
    movable: 'piece',
    title: () => (isNew ? 'New piece' : 'Edit piece'),
    autofocus: isNew ? '[data-k=name]' : null,
    body: () => {
      const u = url();
      const using = fitsUsing();
      return `
        <div class="preview ${u ? '' : 'noimg'}" data-drop="x">
          ${u ? `<img src="${u}" alt="">` : `<div class="ph">${esc(d.name || 'Drop, paste or add a photo')}</div>`}
          ${busy ? '<div class="busy">✂︎ Cutting out background…</div>' : ''}
        </div>
        <div class="row" style="flex-wrap:wrap;margin-bottom:16px">
          <button class="btn sm" data-act="gallery">${icon('image')} ${d.image ? 'Replace' : 'Photo'}</button>
          <button class="btn sm" data-act="camera">${icon('camera')} Camera</button>
          ${d.image && !d.original ? `<button class="btn sm" data-act="bg" ${busy ? 'disabled' : ''}>${icon('wand')} Remove background</button>` : ''}
          ${d.original ? `<button class="btn sm" data-act="restore">${icon('undo')} Original photo</button>` : ''}
          ${d.image ? `<button class="btn sm ghost danger" data-act="noimg">Remove photo</button>` : ''}
          <input type="file" accept="image/*" hidden data-file="gallery">
          <input type="file" accept="image/*" capture="environment" hidden data-file="camera">
        </div>
        <label class="field"><span>Name</span><input class="input" data-k="name" value="${esc(d.name)}" placeholder="${esc(defaultName(d.category))}" maxlength="40"></label>
        <div class="field"><span class="small" style="display:block;color:var(--ink-2);font-weight:500;margin-bottom:6px">Category</span>
          <div class="chips">${CATS.map(c => `<button class="chip ${d.category === c.id ? 'active' : ''}" data-act="cat" data-c="${c.id}">${c.one}</button>`).join('')}</div></div>
        <div class="field">
          <span class="small" style="display:flex;justify-content:space-between;color:var(--ink-2);font-weight:500;margin-bottom:8px">
            <span>Color: ${d.color ? `<b>${esc(colorInfo(d.color).name)}</b> <span class="muted">· ${d.colorSource === 'manual' ? 'picked by you' : d.colorSource === 'name' ? 'from the name' : 'detected'}</span>` : '<span class="muted">not set</span>'}</span>
            ${d.colorSource === 'manual' ? '<button class="linkbtn" data-act="color-auto">Detect automatically</button>' : ''}
          </span>
          <div class="palette">${PALETTE.map(c => `<button class="psw ${d.color && colorInfo(d.color).family === c.id ? 'on' : ''}" style="background:${c.hex}" data-act="color" data-hex="${c.hex}" title="${c.name}" aria-label="${c.name}"></button>`).join('')}</div>
        </div>
        ${using.length ? `<div class="section-title">Used in</div><div class="chips">${using.map(f => `<span class="chip">${esc(f.name)}</span>`).join('')}</div>` : ''}`;
    },
    foot: () => `${isNew ? '' : `<button class="btn danger" data-act="delete">${icon('trash')}</button>`}
      <button class="btn grow" data-close>Cancel</button><button class="btn grow primary" data-act="save">Save</button>`,
    onRender: (hh) => {
      $$('input[type=file]', hh.el).forEach(inp => inp.addEventListener('change', () => {
        const f = filesFrom(inp.files)[0]; inp.value = '';
        if (f) setImage(f);
      }));
    },
    onInput: (e) => {
      if (e.target.dataset.k === 'name') d.name = e.target.value;
    },
    onAct: async (act, el) => {
      if (act === 'gallery' || act === 'camera') $(`input[data-file=${act}]`, h.el).click();
      else if (act === 'cat') { d.category = el.dataset.c; h.rerender(); }
      else if (act === 'noimg') { d.image = null; d.original = null; imageChanged = true; await autoColor(); h.rerender(); }
      else if (act === 'restore') { d.image = d.original; d.original = null; imageChanged = true; await autoColor(); h.rerender(); }
      else if (act === 'color') { d.color = el.dataset.hex; d.colorSource = 'manual'; h.rerender(); }
      else if (act === 'color-auto') { d.colorSource = null; await autoColor(); h.rerender(); }
      else if (act === 'bg') {
        busy = true; h.rerender();
        try {
          const out = await removeBackground(d.image);
          d.original = d.image; d.image = out; imageChanged = false; await autoColor();
          if (!isNew) {
            // Apply it straight away — no need to press Save for the Wardrobe to update.
            const stored = await db.get('pieces', d.id);
            if (stored) {
              Object.assign(stored, { image: d.image, original: d.original, color: d.color, colorSource: d.colorSource });
              delete stored.bgPending;
              await db.put('pieces', stored); replacePiece(stored);
              d.updatedAt = stored.updatedAt;
            }
            toast('Background removed');
          }
        } catch (err) {
          console.warn(err);
          toast(looksLikeNetworkError(err) ? 'Needs internet until the AI is downloaded (Settings → Background removal)' : 'Background removal failed');
        }
        busy = false; if (!h.closed) h.rerender();
      } else if (act === 'save') {
        d.name = d.name.trim() || defaultName(d.category);
        if (!d.image && d.colorSource !== 'manual') { const c = colorFromName(d.name); if (c) { d.color = c; d.colorSource = 'name'; } }
        await db.put('pieces', d);
        const i = S.pieces.findIndex(p => p.id === d.id);
        if (i >= 0) S.pieces[i] = d; else S.pieces.push(d);
        if (imageChanged && d.image && !d.original && S.settings.autoBg) queueBg(d.id);
        h.close(); render();
        toast(isNew ? 'Piece added' : 'Saved');
      } else if (act === 'delete') {
        const using = fitsUsing();
        const ok = await ask({
          title: 'Delete this piece?',
          text: using.length ? `It will be removed from ${using.length} fit${using.length > 1 ? 's' : ''}: ${using.map(f => f.name).join(', ')}.` : 'This can\'t be undone.',
          ok: 'Delete', danger: true,
        });
        if (!ok) return;
        for (const f of using) { f.pieceIds = f.pieceIds.filter(x => x !== d.id); await db.put('fits', f); }
        await db.del('pieces', d.id);
        S.pieces = S.pieces.filter(p => p.id !== d.id);
        h.close(); render(); toast('Piece deleted');
      }
    },
    onClose: () => { if (previewURL) URL.revokeObjectURL(previewURL); },
    drop: (files) => setImage(files[0]),
    paste: (files) => setImage(files[0]),
  });
  h.pieceId = d.id;
  openPiece = h;
  // If the background finishes cutting this piece while the window is open, show it (unless you changed the photo).
  const onUpd = (e) => {
    if (h.closed) { window.removeEventListener('fitty:piece-updated', onUpd); return; }
    const p = e.detail;
    if (p.id !== d.id || imageChanged) return;
    Object.assign(d, { image: p.image, original: p.original, color: d.colorSource === 'manual' ? d.color : p.color, colorSource: d.colorSource === 'manual' ? 'manual' : p.colorSource, updatedAt: p.updatedAt, bgPending: p.bgPending });
    h.rerender();
  };
  window.addEventListener('fitty:piece-updated', onUpd);
  if (file) setImage(file);
}

// ================================================================= HISTORY
function historyHead() {
  return `<div class="view-head"><div><h1>History</h1><p class="muted">${S.histTab === 'stats' ? 'How your wardrobe is really used' : 'Tap a day to see or log what you wore'}</p></div>
    <div class="seg"><button class="${S.histTab === 'calendar' ? 'active' : ''}" data-act="htab" data-t="calendar">Calendar</button>
    <button class="${S.histTab === 'stats' ? 'active' : ''}" data-act="htab" data-t="stats">Stats</button></div></div>`;
}
function viewHistory() {
  if (S.histTab === 'stats') return historyHead() + viewStats();
  if (!S.histMonth) { const n = new Date(); S.histMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
  const m = S.histMonth;
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay()); // Sunday-first grid
  const today = todayISO(), tmr = tomorrowISO();
  const byDate = new Map(S.wears.map(w => [w.date, w]));
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = toISO(d);
    const w = byDate.get(iso);
    let th = '';
    if (w) {
      const ps = sortPieces(w.pieceIds);
      const withImg = ps.find(p => p.image);
      th = withImg ? `<img src="${imageURL(withImg)}" alt="">` : `<span class="t">${esc((fitById(w.fitId) || {}).name || w.fitName)}</span>`;
    }
    const cls = [d.getMonth() !== m.getMonth() ? 'out' : '', iso === today ? 'today' : '', w ? 'worn' : '', iso > tmr ? 'future' : ''].join(' ');
    cells.push(`<button class="day ${cls}" data-act="day" data-d="${iso}" ${iso > tmr ? 'disabled' : ''}><span class="n">${d.getDate()}</span><span class="th">${th}</span></button>`);
  }
  const monthWears = S.wears.filter(w => fromISO(w.date).getMonth() === m.getMonth() && fromISO(w.date).getFullYear() === m.getFullYear() && w.date <= today);
  const counts = {};
  monthWears.forEach(w => { counts[w.fitId] = (counts[w.fitId] || 0) + 1; });
  const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const never = S.fits.filter(f => !S.wears.some(w => w.fitId === f.id)).length;
  return `
    ${historyHead()}
    <div class="card pad">
      <div class="cal-head">
        <button class="btn icon ghost" data-act="prev" aria-label="Previous month">${icon('left')}</button>
        <h3>${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <button class="btn icon ghost" data-act="next" aria-label="Next month">${icon('right')}</button>
      </div>
      <div class="cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div>
    </div>
    <div class="stats">
      <div class="card stat"><b>${monthWears.length}</b><span>day${monthWears.length === 1 ? '' : 's'} logged this month</span></div>
      <div class="card stat"><b style="font-size:17px;line-height:1.3;padding:4px 0">${topId ? esc((fitById(topId) || {}).name || '—') : '—'}</b><span>most worn this month</span></div>
      <div class="card stat"><b>${never}</b><span>fit${never === 1 ? '' : 's'} never worn</span></div>
    </div>`;
}
// ---------------------------------------------------------------- Stats
function barList(rows, unit) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<div class="bars">${rows.map(r => `<div class="bar-row" title="${esc(r.label)}: ${r.value} ${unit}">
      <span class="bar-label">${esc(r.label)}</span>
      <span class="bar-track"><span class="bar" style="width:${Math.max(3, (r.value / max) * 100)}%"></span></span>
      <span class="bar-val">${r.value}</span></div>`).join('')}</div>`;
}
function viewStats() {
  const today = todayISO();
  const past = S.wears.filter(w => w.date <= today);
  if (!S.pieces.length) return `<div class="card empty"><div class="art">📊</div><h2>No stats yet</h2><p>Add pieces and log a few fits — your stats grow from there.</p></div>`;
  const fitCount = new Map(), pieceCount = new Map(), pieceLast = new Map();
  for (const w of past) {
    fitCount.set(w.fitId, (fitCount.get(w.fitId) || 0) + 1);
    for (const id of w.pieceIds || []) {
      pieceCount.set(id, (pieceCount.get(id) || 0) + 1);
      if (!pieceLast.has(id) || pieceLast.get(id) < w.date) pieceLast.set(id, w.date);
    }
  }
  const d30 = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return toISO(d); })();
  const used30 = S.pieces.filter(p => (pieceLast.get(p.id) || '') >= d30).length;
  const L = learning();
  const rated = past.filter(w => typeof w.feel === 'number');

  const topFits = [...fitCount].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, n]) => ({ label: (fitById(id) || {}).name || (past.find(w => w.fitId === id) || {}).fitName || 'Deleted fit', value: n }));
  const topPieces = [...pieceCount].filter(([id]) => pieceById(id)).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const dusty = S.pieces.map(p => ({ p, last: pieceLast.get(p.id) || null }))
    .filter(x => !x.last || x.last < d30)
    .sort((a, b) => (a.last || '') < (b.last || '') ? -1 : 1).slice(0, 8);

  const catRows = CATS.map(c => {
    const ps = S.pieces.filter(p => p.category === c.id);
    const used = ps.filter(p => (pieceLast.get(p.id) || '') >= d30).length;
    return { c, n: ps.length, used };
  }).filter(r => r.n);

  // colors by family
  const fam = new Map();
  for (const p of S.pieces) if (p.color) { const ci = colorInfo(p.color); const k = ci.family; const e = fam.get(k) || { name: ci.name, hex: PALETTE.find(x => x.id === k).hex, n: 0 }; e.n++; fam.set(k, e); }
  const famRows = [...fam.values()].sort((a, b) => b.n - a.n);
  const colored = famRows.reduce((s, r) => s + r.n, 0);


  const tile = (p, sub) => itemTile(p, { act: 'piece', sub });
  return `
    <div class="kpis">
      <div class="card stat"><b>${past.length}</b><span>days logged</span></div>
      <div class="card stat"><b>${S.fits.length}<small> / ${S.pieces.length}</small></b><span>fits / pieces</span></div>
      <div class="card stat"><b>${S.pieces.length ? Math.round(100 * used30 / S.pieces.length) : 0}%</b><span>of pieces worn in 30 days</span></div>
      <div class="card stat"><b>${rated.length ? L.justRightPct ?? Math.round(100 * rated.filter(w => w.feel === 0).length / rated.length) : '—'}${rated.length ? '%' : ''}</b><span>“just right” days</span></div>
    </div>
    <div class="stats-grid">
      <div class="card pad"><h3>Most worn fits</h3>
        ${topFits.length ? barList(topFits, 'wears') : '<p class="small muted">Accept a few suggestions to see your favorites.</p>'}</div>

      <div class="card pad"><h3>Most worn pieces</h3>
        ${topPieces.length ? `<div class="flatlay mini">${topPieces.map(([id, n]) => tile(pieceById(id), `worn ${n}×`)).join('')}</div>` : '<p class="small muted">Nothing logged yet.</p>'}</div>

      <div class="card pad"><h3>Collecting dust</h3><p class="small muted" style="margin:2px 0 12px">Not worn in the last 30 days — give them a turn, or let them go.</p>
        ${dusty.length ? `<div class="flatlay mini">${dusty.map(x => tile(x.p, x.last ? `${daysBetween(x.last, today)} days ago` : 'never worn')).join('')}</div>` : '<p class="small muted">Everything got worn this month 🎉</p>'}</div>

      <div class="card pad"><h3>By category</h3><p class="small muted" style="margin:2px 0 12px">Pieces you own, and how many were worn in the last 30 days.</p>
        <div class="bars">${catRows.map(r => `<div class="bar-row" title="${r.used} of ${r.n} worn in 30 days">
          <span class="bar-label">${r.c.label}</span>
          <span class="bar-track"><span class="bar" style="width:${Math.max(3, 100 * r.used / r.n)}%"></span></span>
          <span class="bar-val">${r.used}/${r.n}</span></div>`).join('')}</div></div>

      <div class="card pad"><h3>Your colors</h3>
        ${colored ? `<div class="colorbar">${famRows.map(r => `<span style="flex:${r.n};background:${r.hex}" title="${esc(r.name)}: ${r.n}"></span>`).join('')}</div>
          <div class="legend">${famRows.map(r => `<span><i style="background:${r.hex}"></i>${esc(r.name)} <b>${r.n}</b></span>`).join('')}</div>` : '<p class="small muted">Add photos or color names to pieces to see your palette.</p>'}</div>

      <div class="card pad"><h3>Comfort</h3>
        ${rated.length ? `<div class="comfort">
            <div><b>${rated.filter(w => w.feel === -1).length}</b><span>🥶 too cold</span></div>
            <div><b>${rated.filter(w => w.feel === 0).length}</b><span>👌 just right</span></div>
            <div><b>${rated.filter(w => w.feel === 1).length}</b><span>🥵 too hot</span></div></div>
          <p class="small muted" style="margin:12px 0 0">${Math.abs(L.biasC) >= 0.5 ? `You tend to feel ${L.biasC < 0 ? 'cold' : 'warm'}, so Fitty treats days as ${Math.abs(L.biasC).toFixed(1)}° ${L.biasC < 0 ? 'colder' : 'warmer'}.` : 'Fitty’s weather picks are matching you well.'}</p>`
          : '<p class="small muted">Answer “How did it feel?” on the Today screen and Fitty learns how warm you run.</p>'}</div>
    </div>`;
}

function afterHistory(view) {
  view.onclick = (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'prev') { S.histMonth = new Date(S.histMonth.getFullYear(), S.histMonth.getMonth() - 1, 1); render(); }
    if (a.dataset.act === 'next') { S.histMonth = new Date(S.histMonth.getFullYear(), S.histMonth.getMonth() + 1, 1); render(); }
    if (a.dataset.act === 'day') openDaySheet(a.dataset.d);
    if (a.dataset.act === 'htab') { S.histTab = a.dataset.t; render(); }
    if (a.dataset.act === 'piece') openPieceSheet(pieceById(a.dataset.id));
  };
}

function openDaySheet(date) {
  const h = openSheet({
    cls: 'narrow',
    title: () => fromISO(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    body: () => {
      const w = S.wears.find(x => x.date === date);
      if (w) {
        const fit = fitById(w.fitId);
        const [txt, emo] = w.code != null ? describeCode(w.code) : ['', ''];
        return `<h3 style="margin-bottom:4px">${esc(fit ? fit.name : w.fitName)}</h3>
          <div class="small muted" style="margin-bottom:12px">${w.feels != null ? `${emo} ${esc(txt)} · felt like ${Math.round(w.feels)}°` : ''}${fit ? '' : ' · fit since deleted'}</div>
          <div class="flatlay">${sortPieces(w.pieceIds).map(p => itemTile(p)).join('')}</div>
          ${w.date <= todayISO() ? `<div class="feel-row"><span class="small">How did it feel?</span>
            ${[[-1, '🥶 Too cold'], [0, '👌 Just right'], [1, '🥵 Too hot']].map(([v, t]) => `<button class="chip ${w.feel === v ? 'active' : ''}" data-act="feel" data-v="${v}">${t}</button>`).join('')}</div>` : ''}`;
      }
      const fits = [...S.fits].filter(f => f.pieceIds.length).sort((a, b) => a.name.localeCompare(b.name));
      return `<p class="muted" style="margin-top:0">Nothing logged. Forgot to log? Pick the fit you wore:</p>
        ${fits.length ? `<div class="fit-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${fits.map(f => `<button class="fitcard" data-act="log" data-id="${f.id}">${collage(f.pieceIds)}<div class="body"><div class="name" style="font-size:14px">${esc(f.name)}</div></div></button>`).join('')}</div>` : '<p class="small muted">Create a fit first.</p>'}`;
    },
    foot: () => {
      const w = S.wears.find(x => x.date === date);
      return w ? `<button class="btn grow danger" data-act="remove" data-id="${w.id}">${icon('trash')} Remove from history</button>` : '';
    },
    onAct: async (act, el) => {
      if (act === 'feel') {
        const w = S.wears.find(x => x.date === date);
        await setFeel(w.id, Number(el.dataset.v)); h.rerender(); render();
      } else if (act === 'remove') {
        await db.del('wears', el.dataset.id);
        S.wears = S.wears.filter(w => w.id !== el.dataset.id);
        h.close(); render(); toast('Removed from history');
      } else if (act === 'log') {
        const fit = fitById(el.dataset.id);
        const wd = dayWeather(date);
        const wear = { id: uid(), fitId: fit.id, fitName: fit.name, date, pieceIds: [...fit.pieceIds], feels: wd ? wd.feels : null, code: wd ? wd.code : null, targetWeight: null, createdAt: Date.now() };
        await db.put('wears', wear); S.wears.push(wear);
        h.close(); render(); toast(`Logged ${fit.name}`);
      }
    },
  });
}

// ================================================================= SETTINGS
let citySearch = { q: '', results: [], loading: false, err: null };
function viewSettings() {
  const st = S.settings;
  const rules = [...st.mapping].sort((a, b) => a.weight - b.weight);
  return `
    <div class="view-head"><div><h1>Settings</h1></div></div>
    <div class="settings">
      ${S.installPrompt ? `<div class="card pad toggle"><div><h3>Install Fitty</h3><p class="small muted" style="margin:4px 0 0">Open it like a normal app, works offline.</p></div><button class="btn primary" data-act="install">Install</button></div>` : ''}

      <div class="card pad toggle">
        <div><h3>Appearance</h3><p class="small muted" style="margin:4px 0 0">Light, dark, or match your device.</p></div>
        <div class="seg">${['light', 'dark', 'system'].map(t => `<button class="${themePref() === t ? 'active' : ''}" data-act="theme" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      </div>

      <div class="card pad">
        <h3>Location</h3>
        <p>${icon('pin').replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px"')} ${esc(st.location.name)}</p>
        <div class="row"><input class="input" data-k="city" placeholder="Search a city" value="${esc(citySearch.q)}"><button class="btn" data-act="city-search">${citySearch.loading ? 'Searching…' : 'Search'}</button></div>
        ${citySearch.err ? `<p class="small" style="color:var(--danger)">${esc(citySearch.err)}</p>` : ''}
        ${citySearch.results.length ? `<div class="result-list">${citySearch.results.map((r, i) => `<button data-act="city-pick" data-i="${i}">${esc(r.name)}</button>`).join('')}</div>` : ''}
      </div>

      <div class="card pad">
        <h3>Weather → fit weight</h3>
        <p>Fitty averages the day's high and low “feels like” temperature, then targets this weight. Fits near the target get recommended more.</p>
        <table class="map-table">
          ${rules.map(r => `<tr><td><b>${r.weight}</b> <span class="muted small">${WEIGHT_WORDS[r.weight]}</span></td>
            <td>${r.weight === 5 ? `<span class="muted small">anything colder</span>` : `<span class="small muted">from</span> <input class="input" type="number" data-k="map" data-w="${r.weight}" value="${r.min}"> °C`}</td>
            <td class="small muted">${esc(weightRange(r.weight))}</td></tr>`).join('')}
        </table>
        <div style="margin-top:12px"><button class="btn sm" data-act="map-reset">Reset to default</button></div>
      </div>

      <div class="card pad">
        <h3>Cooldown</h3>
        <p>After you wear a fit it's blocked for a few days, then its chance comes back gradually.</p>
        <div class="two-col">
          <label class="field"><span>Blocked for (days)</span><input class="input" type="number" min="0" max="14" data-k="block" value="${st.blockDays}"></label>
          <label class="field"><span>Fades back over (days)</span><input class="input" type="number" min="1" max="60" data-k="fade" value="${st.fadeDays}"></label>
        </div>
        <p class="small muted" style="margin:0">Wearing a piece in one fit also lowers other fits that share it (tops, bottoms, outerwear fully, shoes half, accessories not at all).</p>
      </div>

      <div class="card pad">
        <div class="toggle"><div><h3>Learn from “How did it feel?”</h3><p class="small muted" style="margin:4px 0 0">Your answers fine-tune the weather target and each fit's weight.</p></div>
          <label class="switch"><input type="checkbox" data-k="learn" ${st.learn ? 'checked' : ''}><span></span></label></div>
        ${(() => {
          const L = learning();
          if (!st.learn) return '';
          if (!L.n) return '<p class="small muted" style="margin:12px 0 0">No answers yet.</p>';
          const adjusted = [...L.perFit].map(([id, a]) => fitById(id) ? `${esc(fitById(id).name)} ${a > 0 ? '+' : ''}${a}` : '').filter(Boolean);
          return `<p class="small" style="margin:12px 0 0">Based on ${L.n} answer${L.n === 1 ? '' : 's'}: ${Math.abs(L.biasC) >= 0.3 ? `you run <b>${L.biasC < 0 ? 'cold' : 'warm'}</b> (days treated ${Math.abs(L.biasC)}° ${L.biasC < 0 ? 'colder' : 'warmer'})` : 'your sense of temperature matches the forecast'}.
            ${adjusted.length ? `<br><span class="muted">Fit weight corrections: ${adjusted.join(' · ')}</span>` : ''}</p>
            <button class="btn sm" style="margin-top:10px" data-act="learn-reset">Start learning over</button>`;
        })()}
      </div>

      <div class="card pad">
        <div class="toggle"><div><h3>Auto background removal</h3><p class="small muted" style="margin:4px 0 0">Cuts clothes out of photos on your device.</p></div>
          <label class="switch"><input type="checkbox" data-k="autobg" ${st.autoBg ? 'checked' : ''}><span></span></label></div>
        <div class="offline-row" data-offline>
          <span class="small muted">Checking offline status…</span>
        </div>
      </div>

      <div class="card pad">
        <h3>Groups</h3>
        <p>Tap a color to change it.</p>
        ${S.groups.map(g => `<div class="group-row">
          <button class="swatch" style="background:${g.color}" data-act="g-color" data-id="${g.id}" aria-label="Change color"></button>
          <input class="input" data-k="gname" data-id="${g.id}" value="${esc(g.name)}" maxlength="30">
          <button class="btn icon ghost danger" data-act="g-del" data-id="${g.id}" aria-label="Delete group">${icon('trash')}</button></div>`).join('') || '<p class="small muted">No groups yet.</p>'}
        <div style="margin-top:12px"><button class="btn sm" data-act="g-add">${icon('plus')} New group</button></div>
      </div>

      <div class="card pad">
        <h3>Backup & sync</h3>
        <p>Your data lives only on this device. To move it to another device, export here and import there — matching items are merged and the newer version wins.</p>
        <div class="row" style="flex-wrap:wrap">
          <button class="btn" data-act="export">${icon('download')} Export backup</button>
          <button class="btn" data-act="import">${icon('upload')} Import backup</button>
          <input type="file" accept="application/json,.json" hidden data-file="import">
        </div>
        <label class="toggle small" style="margin-top:12px;justify-content:flex-start;gap:10px"><input type="checkbox" data-k="imp-settings"> Also import settings (location, weather mapping, cooldown)</label>
        <p class="small muted" data-storage style="margin:10px 0 0"></p>
      </div>

      <div class="card pad">
        <h3>Danger zone</h3>
        <p>Erase every fit, piece, group and history entry on this device.</p>
        <button class="btn danger" data-act="wipe">${icon('trash')} Erase all data</button>
      </div>
      <p class="small muted" style="text-align:center">fitty · v${APP_VERSION} · weather by Open-Meteo</p>
    </div>`;
}

async function fillOfflineStatus(view) {
  const el = $('[data-offline]', view);
  if (!el) return;
  const ready = await offlineReady();
  el.innerHTML = ready
    ? `<span class="small"><span class="ok-dot"></span>Ready offline — works without internet</span>`
    : `<span class="small muted">Needs a one-time ~40 MB download to work offline.</span>
       <button class="btn sm" data-act="bg-download">${icon('download')} Download now</button>`;
}
function afterSettings(view) {
  fillOfflineStatus(view);
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(e => {
      const el = $('[data-storage]', view);
      if (el && e.usage != null) el.textContent = `Using ${(e.usage / 1048576).toFixed(1)} MB on this device.`;
    });
  }
  const fileInp = $('input[data-file=import]', view);
  fileInp.onchange = async () => {
    const f = fileInp.files[0]; fileInp.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const stats = await importAll(data, { includeSettings: $('[data-k=imp-settings]', view).checked });
      await reloadData();
      render();
      toast(`Imported · ${stats.added} new, ${stats.updated} updated`);
      if ($('[data-k=imp-settings]', view)?.checked) loadWeather(true);
    } catch (err) { toast(err.message || 'Import failed'); }
  };
  const cityInp = $('[data-k=city]', view);
  cityInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-act=city-search]', view).click(); } });

  view.oninput = (e) => {
    const k = e.target.dataset.k;
    if (k === 'city') citySearch.q = e.target.value;
  };
  view.onchange = async (e) => {
    const t = e.target, k = t.dataset.k, st = S.settings;
    if (k === 'map') {
      const r = st.mapping.find(x => x.weight === Number(t.dataset.w));
      const v = Number(t.value);
      if (!Number.isFinite(v)) return;
      r.min = Math.round(v);
      // Keep thresholds strictly descending as weight goes up.
      const sorted = [...st.mapping].filter(x => x.weight !== 5).sort((a, b) => a.weight - b.weight);
      for (let i = 1; i < sorted.length; i++) if (sorted[i].min >= sorted[i - 1].min) sorted[i].min = sorted[i - 1].min - 1;
      await saveSettings(); render();
    } else if (k === 'block') { st.blockDays = Math.max(0, Math.min(14, Number(t.value) || 0)); await saveSettings(); }
    else if (k === 'fade') { st.fadeDays = Math.max(1, Math.min(60, Number(t.value) || 1)); await saveSettings(); }
    else if (k === 'autobg') { st.autoBg = t.checked; await saveSettings(); }
    else if (k === 'learn') { st.learn = t.checked; await saveSettings(); render(); }
    else if (k === 'gname') {
      const g = groupById(t.dataset.id);
      if (g && t.value.trim()) { g.name = t.value.trim(); await db.put('groups', g); toast('Group renamed'); }
    }
  };
  view.onclick = async (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const st = S.settings;
    switch (a.dataset.act) {
      case 'install': S.installPrompt.prompt(); S.installPrompt = null; render(); break;
      case 'theme': setTheme(a.dataset.t); break;
      case 'bg-download': {
        if (!navigator.onLine) { toast('Connect to the internet first'); return; }
        a.disabled = true; a.textContent = 'Downloading… 0%';
        try {
          await prepareOffline((pct) => { a.textContent = `Downloading… ${pct}%`; });
          toast('Background removal now works offline');
        } catch (err) { console.warn(err); toast('Download failed — try again'); }
        fillOfflineStatus(view);
        break;
      }
      case 'learn-reset': {
        if (!(await ask({ title: 'Start learning over?', text: 'Fitty forgets what it learned from your answers so far. Your history stays.', ok: 'Start over' }))) return;
        st.learnSince = Date.now(); await saveSettings(); render(); break;
      }
      case 'city-search': {
        if (!citySearch.q.trim()) return;
        citySearch.loading = true; citySearch.err = null; render();
        try { citySearch.results = await searchCity(citySearch.q.trim()); if (!citySearch.results.length) citySearch.err = 'No matches'; }
        catch { citySearch.err = 'Search needs an internet connection'; }
        citySearch.loading = false; render(); break;
      }
      case 'city-pick': {
        st.location = citySearch.results[Number(a.dataset.i)];
        citySearch = { q: '', results: [], loading: false, err: null };
        await saveSettings(); S.forecast = null; render(); loadWeather(); toast('Location updated'); break;
      }
      case 'map-reset': st.mapping = DEFAULT_MAPPING.map(x => ({ ...x })); await saveSettings(); render(); break;
      case 'g-color': {
        const g = groupById(a.dataset.id);
        g.color = GROUP_COLORS[(GROUP_COLORS.indexOf(g.color) + 1) % GROUP_COLORS.length];
        await db.put('groups', g); render(); break;
      }
      case 'g-add': { if (await newGroup()) render(); break; }
      case 'g-del': {
        const g = groupById(a.dataset.id);
        const n = S.fits.filter(f => f.groupId === g.id).length;
        if (!(await ask({ title: `Delete “${g.name}”?`, text: n ? `${n} fit${n > 1 ? 's' : ''} will move to “No group”. The fits themselves stay.` : 'No fits use this group.', ok: 'Delete', danger: true }))) return;
        for (const f of S.fits.filter(f => f.groupId === g.id)) { f.groupId = null; await db.put('fits', f); }
        await db.del('groups', g.id);
        S.groups = S.groups.filter(x => x.id !== g.id);
        if (S.group === g.id) S.group = 'all';
        if (S.fitsGroup === g.id) S.fitsGroup = 'all';
        render(); break;
      }
      case 'export': {
        const t = toast('Preparing backup…');
        const data = await exportAll();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const name = `fitty-backup-${todayISO()}.json`;
        const file = new File([blob], name, { type: 'application/json' });
        t.remove();
        if (!isDesktop() && navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'Fitty backup' }); break; } catch (err) { if (err.name === 'AbortError') break; }
        }
        const u = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = u; link.download = name; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
        toast('Backup saved');
        break;
      }
      case 'import': $('input[data-file=import]', view).click(); break;
      case 'wipe': {
        if (!(await ask({ title: 'Erase everything?', text: 'All fits, pieces, groups and history on this device will be deleted. Export a backup first if you might want them back.', ok: 'Erase all', danger: true }))) return;
        for (const s of ['pieces', 'fits', 'groups', 'wears']) await db.clear(s);
        localStorage.removeItem('fitbud:daily');
        await reloadData(); render(); toast('All data erased');
        break;
      }
    }
  };
}

// ================================================================= what's new
async function maybeShowWhatsNew() {
  const seen = await db.getMeta('seenVersion', null);
  await db.setMeta('seenVersion', APP_VERSION);
  if (seen === APP_VERSION || (!seen && !S.fits.length && !S.pieces.length)) return; // brand-new users skip it
  if (seen && seen >= '2.0') return; // only users coming from v1 see the v2 tour
  const items = [
    ['🥶👌🥵', 'How did it feel?', 'After you wear a fit, tap how it felt. Fitty learns if you run warm or cold and fixes fit weights.'],
    ['✨', 'Combo ideas', 'Fits → Ideas mixes pieces you own into new outfits that match.'],
    ['🎨', 'Color matching', 'Colors are detected from photos (or names) and Fitty tells you if a fit is a great match or might clash.'],
    ['📅', 'Week planner', 'Today → Week plans the next 7 days from the forecast, with no repeats too close together.'],
    ['📊', 'Wardrobe stats', 'History → Stats: most worn, collecting dust, your colors and cost per wear.'],
  ];
  openSheet({
    cls: 'narrow', title: 'What\'s new in v2',
    body: () => `<div class="whatsnew">${items.map(([e, t, d]) => `<div><span class="wn-e">${e}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>`,
    foot: () => '<button class="btn grow primary" data-close>Let\'s go</button>',
  });
}

// ================================================================= boot
async function reloadData() {
  [S.pieces, S.fits, S.groups, S.wears] = await Promise.all(['pieces', 'fits', 'groups', 'wears'].map(s => db.all(s)));
  const plan = await db.getMeta('plan', {}) || {};
  const today = todayISO();
  S.plan = Object.fromEntries(Object.entries(plan).filter(([d]) => d >= today));
  S.dismissedIdeas = new Set(await db.getMeta('dismissedIdeas', []) || []);
  const saved = await db.getMeta('settings', null);
  S.settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  S.settings.mapping = (S.settings.mapping || DEFAULT_MAPPING).map(x => ({ ...x }));
}

async function boot() {
  applyTheme();
  await reloadData();
  // Afternoon/evening → planning tomorrow; morning → today.
  S.mode = new Date().getHours() >= 14 ? 'tomorrow' : 'today';
  const v = location.hash.slice(1);
  if (NAV.some(([id]) => id === v)) S.view = v;
  render();
  persistStorage();
  loadWeather();
  setTimeout(backfillColors, 800);
  setTimeout(retryPendingBg, 1500);
  maybeShowWhatsNew();
  // Refresh weather + date when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    loadWeather();
    refreshFromStorage();   // e.g. the date changed, or you edited on another tab
    retryPendingBg();
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { });
    // When a new version takes over, reload once so the new files are used right away.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded && !sheets.length) { reloaded = true; location.reload(); }
    });
  }
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installPrompt = e; if (S.view === 'settings') render(); });

boot();
