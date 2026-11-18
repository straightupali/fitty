// Fitty — draws a fit as a shareable image card (canvas → PNG). Works in both languages and themes.

const SIZES = { post: [1080, 1350], story: [1080, 1920] };

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Break text into at most `max` lines that fit `width`; the last line gets an ellipsis if needed.
function wrap(ctx, text, width, max) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (ctx.measureText(next).width <= width || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    lines.length = max;
    let last = lines[max - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    lines[max - 1] = last + '…';
  }
  return lines.map(l => {
    if (ctx.measureText(l).width <= width) return l;
    while (l.length > 1 && ctx.measureText(l + '…').width > width) l = l.slice(0, -1);
    return l + '…';
  });
}

async function loadImg(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  try { await img.decode(); return img; } catch { return null; }
}

/**
 * pieces: [{ name, url, cutout, color }], already sorted
 * meta:   { name, sub, brandNote, colors: [hex], rtl }
 */
export async function drawFitCard({ pieces, meta, size = 'post' }) {
  const [W, H] = SIZES[size] || SIZES.post;
  const rtl = !!meta.rtl;
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const headFont = getComputedStyle(document.querySelector('h1, h2') || document.body).fontFamily;
  const brandFont = "'Fraunces', Georgia, serif";
  const sample = [meta.name, meta.sub, meta.brandNote, ...pieces.map(p => p.name)].join(' ');
  try {
    await Promise.all([
      document.fonts.load(`600 80px ${headFont}`, sample), document.fonts.load(`400 30px ${bodyFont}`, sample),
      document.fonts.load(`500 30px ${bodyFont}`, sample),
      document.fonts.load(`600 64px ${brandFont}`, 'fit'), document.fonts.load(`italic 600 64px ${brandFont}`, 'ty'),
    ]);
  } catch { /* fall back to system fonts */ }

  const C = {
    bg: cssVar('--bg') || '#F7F4EF', tile: cssVar('--tile') || '#F1ECE5', ink: cssVar('--ink') || '#23201C',
    ink2: cssVar('--ink-2') || '#5D574F', muted: cssVar('--muted') || '#958E84', accent: cssVar('--accent') || '#B26B53',
    line: cssVar('--line') || '#E7E1D8',
  };
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.direction = rtl ? 'rtl' : 'ltr';
  const P = 72;                                 // page padding
  const X = (x, w = 0) => (rtl ? W - x - w : x); // mirror for right-to-left
  const startAlign = rtl ? 'right' : 'left', endAlign = rtl ? 'left' : 'right';

  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // Brand (always "fitty" in Latin, left-to-right)
  ctx.save(); ctx.direction = 'ltr'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `600 56px ${brandFont}`;
  const fitW = ctx.measureText('fit').width;
  ctx.font = `italic 600 56px ${brandFont}`;
  const tyW = ctx.measureText('ty').width;
  const bx = rtl ? W - P - fitW - tyW : P;
  ctx.fillStyle = C.ink; ctx.font = `600 56px ${brandFont}`; ctx.fillText('fit', bx, P + 44);
  ctx.fillStyle = C.accent; ctx.font = `italic 600 56px ${brandFont}`; ctx.fillText('ty', bx + fitW, P + 44);
  ctx.restore();

  // Little note at the other end of the brand row (e.g. "Weight 3 · Medium")
  if (meta.brandNote) {
    ctx.font = `500 28px ${bodyFont}`; ctx.fillStyle = C.ink2; ctx.textAlign = endAlign; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(meta.brandNote).width + 44;
    roundRect(ctx, X(W - P - tw, tw), P + 4, tw, 54, 27); ctx.fillStyle = C.tile; ctx.fill();
    ctx.fillStyle = C.ink2; ctx.fillText(meta.brandNote, rtl ? P + 22 : W - P - 22, P + 31);
  }

  // Title + subtitle
  let y = P + 150;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = startAlign;
  ctx.font = `600 78px ${headFont}`; ctx.fillStyle = C.ink;
  const tLines = wrap(ctx, meta.name, W - 2 * P, 2);
  for (const l of tLines) { ctx.fillText(l, rtl ? W - P : P, y); y += 92; }
  if (meta.sub) {
    ctx.font = `400 32px ${bodyFont}`; ctx.fillStyle = C.muted;
    ctx.fillText(wrap(ctx, meta.sub, W - 2 * P, 1)[0], rtl ? W - P : P, y - 30);
    y += 26;
  }

  // Footer: the fit's colors + "made with fitty"
  const footY = H - P - 10;
  const colors = (meta.colors || []).slice(0, 6);
  colors.forEach((c, i) => {
    const cx = X(P + 22 + i * 40);
    ctx.beginPath(); ctx.arc(cx, footY - 12, 18, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.bg; ctx.stroke();
  });
  ctx.font = `400 26px ${bodyFont}`; ctx.fillStyle = C.muted; ctx.textAlign = endAlign; ctx.textBaseline = 'middle';
  ctx.fillText(meta.footer || 'made with fitty', rtl ? P : W - P, footY - 12);

  // Pieces grid
  const items = pieces.slice(0, 9);
  const n = Math.max(1, items.length);
  const cols = n === 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = 28, labelH = 58;
  const top = y + 24, bottom = footY - 70;
  const areaW = W - 2 * P, areaH = bottom - top;
  let tileW = (areaW - gap * (cols - 1)) / cols;
  let tileH = Math.min(tileW * (n === 1 ? 1.05 : 1.12), (areaH - rows * labelH - gap * (rows - 1)) / rows);
  if (n === 1) tileW = Math.min(tileW, tileH / 1.05 * 1.25);
  const gridH = rows * (tileH + labelH) + gap * (rows - 1);
  let gy = top + Math.max(0, (areaH - gridH) / 2);
  const imgs = await Promise.all(items.map(p => loadImg(p.url)));

  for (let r = 0; r < rows; r++) {
    const rowItems = items.slice(r * cols, r * cols + cols);
    const rowW = rowItems.length * tileW + (rowItems.length - 1) * gap;
    let gx = P + (areaW - rowW) / 2;
    rowItems.forEach((p, k) => {
      const idx = r * cols + k;
      const x = X(gx, tileW);
      ctx.save();
      roundRect(ctx, x, gy, tileW, tileH, 36); ctx.fillStyle = C.tile; ctx.fill();
      ctx.clip();
      const img = imgs[idx];
      if (img) {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        if (p.cutout) {                          // transparent cut-out: fit inside with breathing room
          const pad = 0.1;
          const s = Math.min(tileW * (1 - 2 * pad) / iw, tileH * (1 - 2 * pad) / ih);
          ctx.drawImage(img, x + (tileW - iw * s) / 2, gy + (tileH - ih * s) / 2, iw * s, ih * s);
        } else {                                 // regular photo: fill the tile, unless that would crop too much
          let s = Math.max(tileW / iw, tileH / ih);
          if ((tileW * tileH) / (iw * ih * s * s) < 0.72) s = Math.min(tileW / iw, tileH / ih);
          ctx.drawImage(img, x + (tileW - iw * s) / 2, gy + (tileH - ih * s) / 2, iw * s, ih * s);
        }
      } else {
        ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `600 ${Math.round(Math.min(64, tileW / 6))}px ${headFont}`;
        const ls = wrap(ctx, p.name, tileW - 48, 3);
        const lh = Math.min(64, tileW / 6) * 1.25;
        ls.forEach((l, i) => ctx.fillText(l, x + tileW / 2, gy + tileH / 2 + (i - (ls.length - 1) / 2) * lh));
      }
      ctx.restore();
      // label under the tile
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = startAlign;
      ctx.font = `500 ${cols === 3 ? 26 : 30}px ${bodyFont}`;
      let lx = rtl ? x + tileW - 6 : x + 6;
      if (p.color) {
        const dx = rtl ? x + tileW - 16 : x + 16;
        ctx.beginPath(); ctx.arc(dx, gy + tileH + 34, 10, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
        lx = rtl ? x + tileW - 36 : x + 36;
      }
      ctx.fillStyle = C.ink;
      ctx.fillText(wrap(ctx, p.name, tileW - 40, 1)[0], lx, gy + tileH + 44);
      gx += tileW + gap;
    });
    gy += tileH + labelH + gap;
  }

  return new Promise((res) => cv.toBlob(b => res(b), 'image/png'));
}
