// Fitty — clean up the AI cut-out.
// The AI sometimes keeps bits of a busy background (speckled floors, patterned rugs) and leaves the
// garment half see-through. This keeps only the shape(s) that look like the clothing — solid and
// fairly central — removes the scattered leftovers, and makes the garment fully opaque again.
// Works on RGBA pixel data in place. Pure JS: runs in the worker (and on the main thread as fallback).

const LOW = 30;    // alpha above this = probably part of something
const FULL = 70;   // alpha above this inside the kept garment = make fully opaque

export function cleanCutout(data, w, h) {
  // 0) Learn the background colors from what the AI clearly removed, then drop *unsure* pixels
  //    that match them (e.g. a dark floor the AI half-kept). Confident pixels are never touched.
  dropBackgroundColored(data, w, h);

  // 1) Work on a coarse grid (~300 px on the long side) — fast and smooths out noise.
  const cell = Math.max(1, Math.ceil(Math.max(w, h) / 300));
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const avg = new Float32Array(gw * gh);
  const cnt = new Uint16Array(gw * gh);
  for (let y = 0; y < h; y++) {
    const gy = (y / cell) | 0;
    for (let x = 0; x < w; x++) {
      const gi = gy * gw + ((x / cell) | 0);
      avg[gi] += data[(y * w + x) * 4 + 3];
      cnt[gi]++;
    }
  }
  const solid = new Uint8Array(gw * gh);
  let solidCount = 0;
  // The AI is often only half-sure about the garment (alpha 40–150), so a low threshold counts it in.
  for (let i = 0; i < solid.length; i++) { avg[i] /= cnt[i] || 1; if (avg[i] > LOW) { solid[i] = 1; solidCount++; } }
  if (solidCount < 20) return { changed: false, reason: 'empty' };

  // 2) Erode to cut the thin bridges that join speckles to each other (and to the garment).
  const eroded = morph(solid, gw, gh, 2, false);

  // 3) Find separate shapes.
  const { labels, comps } = components(eroded, gw, gh);
  if (comps.length <= 1) { solidifyOnly(data, w, h); return { changed: true, reason: 'single' }; }

  // 4) Score each shape. Clothing is solid (few holes, fills its box) and usually central.
  //    Leftover background is scattered, or wraps around the garment like a frame (a big hole).
  const cx = gw / 2, cy = gh / 2, maxD = Math.hypot(cx, cy);
  for (const c of comps) {
    const boxArea = (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1);
    c.density = c.area / boxArea;
    c.filled = filledArea(labels, c, gw, gh);
    c.hollow = c.area / c.filled;                 // 1 = solid, low = ring/frame/holey
    const d = Math.hypot(c.sx / c.area - cx, c.sy / c.area - cy) / maxD;
    c.central = 1 - 0.6 * d;
    c.score = c.area * c.hollow * c.hollow * c.density * c.central;
  }
  comps.sort((a, b) => b.score - a.score);
  const best = comps[0];
  // Keep the best shape plus any other solid, sizeable ones (e.g. the second shoe).
  const keep = new Set([best.id]);
  for (const c of comps.slice(1)) {
    if (c.area >= best.area * 0.2 && c.hollow >= 0.75 && c.density >= 0.4 && c.density >= best.density * 0.6) keep.add(c.id);
  }
  // Safety: if the "best" shape is tiny or not solid at all, don't touch the AI result.
  if (best.filled < gw * gh * 0.03 || best.hollow < 0.5) return { changed: false, reason: 'unsure' };

  // 5) Build the keep-mask. Start from the kept shapes' core and grow outward through any cell the
  //    AI marked even faintly — background-colored pixels were already dropped in step 0, so this
  //    recovers low-confidence parts of the garment without pulling the background back in.
  const core = new Uint8Array(gw * gh);
  let bx0 = gw, by0 = gh, bx1 = 0, by1 = 0;
  for (const c of comps) if (keep.has(c.id)) { bx0 = Math.min(bx0, c.x0); by0 = Math.min(by0, c.y0); bx1 = Math.max(bx1, c.x1); by1 = Math.max(by1, c.y1); }
  for (let i = 0; i < core.length; i++) if (labels[i] && keep.has(labels[i])) core[i] = 1;
  const M = 4; bx0 -= M; by0 -= M; bx1 += M; by1 += M;
  const region = core.slice();
  const st = [];
  for (let i = 0; i < region.length; i++) if (region[i]) st.push(i);
  while (st.length) {
    const j = st.pop(), x = j % gw, y = (j / gw) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < bx0 || yy < by0 || xx > bx1 || yy > by1 || xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
      const k = yy * gw + xx;
      if (!region[k] && avg[k] > 12) { region[k] = 1; st.push(k); }
    }
  }
  fillHoles(region, gw, gh);
  const mask = morph(region, gw, gh, 1, true);    // soft-edge margin
  const inner = morph(region, gw, gh, 1, false);  // well inside the garment → fully opaque

  // 6) Apply at full resolution: drop pixels outside the mask, make confident garment pixels opaque.
  let removed = 0;
  for (let y = 0; y < h; y++) {
    const gy = (y / cell) | 0;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4 + 3;
      const a = data[p];
      const gi = gy * gw + ((x / cell) | 0);
      if (!mask[gi]) { if (a) { data[p] = 0; removed++; } }
      else if (inner[gi]) data[p] = 255;    // solid garment, even where the AI was unsure
      else data[p] = a <= 20 ? 0 : a >= FULL ? 255 : Math.round(((a - 20) / (FULL - 20)) * 255); // soft edge
    }
  }
  return { changed: true, reason: 'cleaned', kept: keep.size, removedShapes: comps.length - keep.size, removed };
}

function dropBackgroundColored(data, w, h) {
  const n = w * h;
  const step = Math.max(1, Math.floor(n / 6000));
  const samples = [];
  for (let i = 0; i < n; i += step) if (data[i * 4 + 3] <= 12) samples.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  if (samples.length < 200) return;
  // k-means with k=3 (speckled backgrounds have a couple of colors)
  const k = 3;
  const sorted = samples.slice().sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  let cent = Array.from({ length: k }, (_, j) => sorted[Math.floor((j + 0.5) * sorted.length / k)].slice());
  const assign = new Uint8Array(samples.length);
  for (let it = 0; it < 8; it++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) { const d = dist2(samples[i], cent[j]); if (d < bd) { bd = d; best = j; } }
      assign[i] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) { const s = sum[assign[i]]; s[0] += samples[i][0]; s[1] += samples[i][1]; s[2] += samples[i][2]; s[3]++; }
    cent = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cent[j]));
  }
  const counts = new Array(k).fill(0);
  for (const a of assign) counts[a]++;
  const palette = cent.filter((_, j) => counts[j] >= samples.length * 0.05);
  const T2 = 28 * 28;
  for (let i = 0; i < n; i++) {
    const p = i * 4, a = data[p + 3];
    if (a === 0 || a >= 160) continue;
    const c = [data[p], data[p + 1], data[p + 2]];
    for (const q of palette) if (dist2(c, q) < T2) { data[p + 3] = 0; break; }
  }
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function solidifyOnly(data, w, h) {
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    data[i] = a <= 20 ? 0 : a >= FULL ? 255 : Math.round(((a - 20) / (FULL - 20)) * 255);
  }
}

// Area of a shape with its holes filled in (flood the bounding box from its edges).
function filledArea(labels, c, gw, gh) {
  const bw = c.x1 - c.x0 + 3, bh = c.y1 - c.y0 + 3;   // 1-cell border around the box
  const out = new Uint8Array(bw * bh);
  const isMe = (bx, by) => {
    const x = bx + c.x0 - 1, y = by + c.y0 - 1;
    return x >= 0 && y >= 0 && x < gw && y < gh && labels[y * gw + x] === c.id;
  };
  const stack = [0];
  out[0] = 1;
  while (stack.length) {
    const j = stack.pop();
    const x = j % bw, y = (j / bw) | 0;
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
      const k = ny * bw + nx;
      if (out[k] || isMe(nx, ny)) continue;
      out[k] = 1; stack.push(k);
    }
  }
  let outside = 0;
  for (let i = 0; i < out.length; i++) outside += out[i];
  return bw * bh - outside;
}

// Binary erosion (grow=false) or dilation (grow=true) with a square of the given radius.
function morph(src, w, h, r, grow) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let dy = -r; dy <= r && (grow ? !v : v); dy++) {
      const yy = y + dy;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        const inside = xx >= 0 && yy >= 0 && xx < w && yy < h;
        const s = inside ? src[yy * w + xx] : 0;
        if (grow && s) { v = 1; break; }
        if (!grow && !s) { v = 0; break; }
      }
    }
    out[y * w + x] = v;
  }
  return out;
}

// 8-connected components with area, bounding box and centroid sums.
function components(bin, w, h) {
  const labels = new Int32Array(w * h);
  const comps = [];
  const stack = new Int32Array(w * h);
  let next = 0;
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || labels[i]) continue;
    const id = ++next;
    const c = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0 };
    let sp = 0; stack[sp++] = i; labels[i] = id;
    while (sp) {
      const j = stack[--sp];
      const x = j % w, y = (j / w) | 0;
      c.area++; c.sx += x; c.sy += y;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx;
        if (bin[k] && !labels[k]) { labels[k] = id; stack[sp++] = k; }
      }
    }
    comps.push(c);
  }
  return { labels, comps };
}

// Fill enclosed holes (background areas not connected to the image border).
function fillHoles(mask, w, h) {
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const j = stack.pop();
    if (outside[j] || mask[j]) continue;
    outside[j] = 1;
    const x = j % w, y = (j / w) | 0;
    if (x > 0) stack.push(j - 1); if (x < w - 1) stack.push(j + 1);
    if (y > 0) stack.push(j - w); if (y < h - 1) stack.push(j + w);
  }
  for (let i = 0; i < mask.length; i++) if (!mask[i] && !outside[i]) mask[i] = 1;
}
