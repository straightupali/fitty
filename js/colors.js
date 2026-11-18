// Fitty — clothing colors: detect a piece's main color, name it, and judge how colors work together.

// Common clothing colors (used for manual picking and for naming detected colors).
export const PALETTE = [
  { id: 'black', name: 'Black', hex: '#1E1E1E' },
  { id: 'charcoal', name: 'Charcoal', hex: '#3F3F42' },
  { id: 'grey', name: 'Grey', hex: '#9B9B9B' },
  { id: 'white', name: 'White', hex: '#F4F3EF' },
  { id: 'cream', name: 'Cream', hex: '#EDE3CC' },
  { id: 'beige', name: 'Beige', hex: '#D4BE9C' },
  { id: 'khaki', name: 'Khaki', hex: '#B5A475' },
  { id: 'brown', name: 'Brown', hex: '#6B4A32' },
  { id: 'olive', name: 'Olive', hex: '#5E6533' },
  { id: 'navy', name: 'Navy', hex: '#1F2A44' },
  { id: 'denim', name: 'Denim', hex: '#4A6A92' },
  { id: 'lightblue', name: 'Light blue', hex: '#9DC2E3' },
  { id: 'blue', name: 'Blue', hex: '#2F5FB3' },
  { id: 'teal', name: 'Teal', hex: '#2F7F7F' },
  { id: 'green', name: 'Green', hex: '#3E7D4E' },
  { id: 'yellow', name: 'Yellow', hex: '#E5C24A' },
  { id: 'orange', name: 'Orange', hex: '#D9772B' },
  { id: 'red', name: 'Red', hex: '#B8322F' },
  { id: 'burgundy', name: 'Burgundy', hex: '#6D1F2A' },
  { id: 'pink', name: 'Pink', hex: '#E7A6B9' },
  { id: 'purple', name: 'Purple', hex: '#6C4A8F' },
];
const BY_ID = Object.fromEntries(PALETTE.map(c => [c.id, c]));

// Colors that pair with almost anything.
const NEUTRALS = new Set(['black', 'charcoal', 'grey', 'white', 'cream', 'beige', 'khaki', 'brown', 'olive', 'navy', 'denim']);

// ---------- conversions ----------
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

// Name a color by clothing family (rule-based on hue/saturation/lightness).
export function familyOf(hex) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  if (l < 0.15) return 'black';
  if (l > 0.9 && s < 0.35) return 'white';
  if (s < 0.12) return l < 0.32 ? 'charcoal' : l > 0.78 ? 'white' : 'grey';
  if (l > 0.82 && h >= 20 && h < 70) return 'cream';
  if (h < 12 || h >= 345) return l < 0.3 ? 'burgundy' : l > 0.72 ? 'pink' : 'red';
  if (h < 40) {
    if (s < 0.6 && l < 0.42) return 'brown';
    if (s < 0.6) return 'beige';
    return l < 0.38 ? 'brown' : 'orange';
  }
  if (h < 68) {
    if (s < 0.5 && l < 0.4) return 'olive';
    if (s < 0.5) return 'khaki';
    return 'yellow';
  }
  if (h < 165) return h < 100 && s < 0.45 && l < 0.45 ? 'olive' : 'green';
  if (h < 195) return 'teal';
  if (h < 255) {
    if (l < 0.3) return 'navy';
    if (l > 0.68) return 'lightblue';
    return s < 0.5 ? 'denim' : 'blue';
  }
  if (h < 295) return 'purple';
  return l < 0.35 ? 'burgundy' : 'pink';
}

export function colorInfo(hex) {
  const id = familyOf(hex);
  return { hex, family: id, name: BY_ID[id].name, neutral: NEUTRALS.has(id), ...rgbToHsl(hexToRgb(hex)) };
}

// ---------- guess from the name (for name-only pieces) ----------
// Checked in order, so "light blue" wins over "blue" and "off white" over "white". English + Arabic.
const WORDS = [
  ['lightblue', ['light blue', 'sky blue', 'baby blue', 'سماوي']],
  ['cream', ['cream', 'ivory', 'off white', 'offwhite', 'كريمي']],
  ['charcoal', ['charcoal', 'فحمي']],
  ['black', ['black', 'أسود', 'اسود']],
  ['grey', ['grey', 'gray', 'رمادي', 'سكني']],
  ['white', ['white', 'أبيض', 'ابيض']],
  ['beige', ['beige', 'sand', 'بيج']],
  ['khaki', ['khaki', 'tan', 'chino', 'chinos', 'خاكي']],
  ['brown', ['brown', 'chocolate', 'camel', 'بني', 'جوزي']],
  ['olive', ['olive', 'army', 'زيتي']],
  ['navy', ['navy', 'كحلي']],
  ['denim', ['denim', 'jean', 'jeans', 'جينز']],
  ['teal', ['teal', 'turquoise', 'فيروزي']],
  ['blue', ['blue', 'cobalt', 'أزرق', 'ازرق']],
  ['green', ['green', 'mint', 'أخضر', 'اخضر']],
  ['yellow', ['yellow', 'mustard', 'أصفر', 'اصفر']],
  ['orange', ['orange', 'rust', 'برتقالي']],
  ['burgundy', ['burgundy', 'maroon', 'wine', 'خمري', 'نبيتي']],
  ['red', ['red', 'أحمر', 'احمر']],
  ['pink', ['pink', 'rose', 'وردي']],
  ['purple', ['purple', 'violet', 'lilac', 'بنفسجي']],
];
export function colorFromName(name) {
  const t = ' ' + String(name || '').toLowerCase().replace(/[^\p{L}]+/gu, ' ') + ' ';
  for (const [id, words] of WORDS) if (words.some(w => t.includes(' ' + w + ' '))) return BY_ID[id].hex;
  return null;
}

// ---------- detect from a photo ----------
// Small k-means on a 48×48 thumbnail. Ignores transparent pixels (cut-outs) and,
// for photos without a cut-out, pixels that match the background around the edges.
export async function extractColor(blob) {
  let bmp;
  try { bmp = await createImageBitmap(blob, { resizeWidth: 48, resizeHeight: 48, resizeQuality: 'medium' }); }
  catch { return null; }
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(48, 48) : Object.assign(document.createElement('canvas'), { width: 48, height: 48 });
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, 48, 48);
  bmp.close && bmp.close();
  const d = ctx.getImageData(0, 0, 48, 48).data;

  // Estimate background from the border (only matters for photos without transparency).
  let br = 0, bg = 0, bb = 0, bn = 0, transparent = 0;
  for (let i = 0; i < 48 * 48; i++) {
    const x = i % 48, y = (i / 48) | 0;
    if (d[i * 4 + 3] < 128) { transparent++; continue; }
    if (x < 2 || y < 2 || x > 45 || y > 45) { br += d[i * 4]; bg += d[i * 4 + 1]; bb += d[i * 4 + 2]; bn++; }
  }
  const hasCutout = transparent > 48 * 48 * 0.08;
  const back = bn ? [br / bn, bg / bn, bb / bn] : null;
  const px = [];
  for (let i = 0; i < 48 * 48; i++) {
    if (d[i * 4 + 3] < 128) continue;
    const p = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    if (!hasCutout && back) {
      const dist = Math.hypot(p[0] - back[0], p[1] - back[1], p[2] - back[2]);
      if (dist < 38) continue;
    }
    px.push(p);
  }
  if (px.length < 20) return null;
  return rgbToHex(dominant(px));
}

function dominant(px, k = 3) {
  // deterministic seeds: spread through the sorted-by-lightness list
  const sorted = [...px].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  let cent = Array.from({ length: k }, (_, i) => sorted[Math.floor((i + 0.5) * sorted.length / k)].slice());
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < px.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const dd = (px[i][0] - cent[j][0]) ** 2 + (px[i][1] - cent[j][1]) ** 2 + (px[i][2] - cent[j][2]) ** 2;
        if (dd < bd) { bd = dd; best = j; }
      }
      assign[i] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) { const s = sum[assign[i]]; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++; }
    cent = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cent[j]));
  }
  const counts = new Array(k).fill(0);
  assign.forEach(a => counts[a]++);
  return cent[counts.indexOf(Math.max(...counts))];
}

// ---------- harmony ----------
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// items: [{ hex, category }]. Accessories count lightly (ignored for clash), shoes count.
// Returns { score 0..1, label, reason } or null when fewer than two colors are known.
// `reason` is { key, vars } so it can be translated: vars hold English color names (or lists of them).
export function harmony(items) {
  const cols = items.filter(x => x && x.hex && x.category !== 'accessory').map(x => ({ ...colorInfo(x.hex), category: x.category }));
  if (cols.length < 2) return null;
  const accents = [];
  for (const c of cols) if (!c.neutral && !accents.some(a => hueDist(a.h, c.h) < 18)) accents.push(c);
  const names = [...new Set(cols.map(c => c.name))];
  let score, reason;

  if (accents.length === 0) {
    score = 0.86;
    reason = names.length === 1 ? { key: 'All {a} — clean monochrome', vars: { a: names[0] } } : { key: '{list} — easy neutrals', vars: { list: names } };
  } else if (accents.length === 1) {
    score = 0.95;
    const others = names.filter(n => n !== accents[0].name);
    reason = others.length ? { key: '{a} pops against {others}', vars: { a: accents[0].name, others } } : { key: '{a} on its own', vars: { a: accents[0].name } };
  } else if (accents.length === 2) {
    const d = hueDist(accents[0].h, accents[1].h);
    const vars = { a: accents[0].name, b: accents[1].name };
    if (d <= 40) { score = 0.88; reason = { key: '{a} & {b} sit close on the color wheel', vars }; }
    else if (d >= 150) { score = 0.78; reason = { key: '{a} & {b} are opposites — bold but works', vars }; }
    else if (d >= 100) { score = 0.6; reason = { key: '{a} & {b} — a bold mix', vars }; }
    else { score = 0.42; reason = { key: '{a} & {b} may fight each other', vars }; }
  } else {
    const maxD = Math.max(...accents.flatMap(a => accents.map(b => hueDist(a.h, b.h))));
    if (maxD <= 50) { score = 0.8; reason = { key: 'Several shades of one color family', vars: {} }; }
    else { score = 0.4; reason = { key: '{n} strong colors — busy', vars: { n: accents.length } }; }
  }

  // Top vs bottom contrast: two different accent colors with the same lightness look muddy.
  const top = cols.find(c => c.category === 'top'), bottom = cols.find(c => c.category === 'bottom');
  if (top && bottom) {
    const dl = Math.abs(top.l - bottom.l);
    if (dl > 0.25) score += 0.04;
    else if (!top.neutral && !bottom.neutral && dl < 0.08 && hueDist(top.h, bottom.h) > 25) score -= 0.08;
  }
  score = Math.max(0, Math.min(1, score));
  const label = score >= 0.9 ? 'Great match' : score >= 0.75 ? 'Good match' : score >= 0.55 ? 'Bold' : 'Might clash';
  return { score, label, reason };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
