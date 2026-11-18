// Fitty — new combo ideas from pieces you already own.
// Mixes tops and bottoms that have never been in the same fit, then adds shoes (and outerwear
// on colder days) that match. Ranked by color harmony, weather fit and how under-used the pieces are.
import { harmony } from './colors.js';

export const comboKey = (ids) => [...ids].sort().join('|');

export function generateIdeas({ pieces, fits, wears, targetWeight = null, dismissed = new Set(), limit = 8, rand = Math.random }) {
  const by = (cat) => pieces.filter(p => p.category === cat);
  const tops = by('top'), bottoms = by('bottom'), outers = by('outerwear'), shoes = by('shoes');
  if (!tops.length || !bottoms.length) return [];

  // Pairs that already exist in a fit — we want new ones.
  const existing = new Set();
  for (const f of fits) {
    const t = f.pieceIds.filter(id => tops.some(p => p.id === id));
    const b = f.pieceIds.filter(id => bottoms.some(p => p.id === id));
    for (const x of t) for (const y of b) existing.add(x + '|' + y);
  }
  const fitKeys = new Set(fits.map(f => comboKey(f.pieceIds)));

  // How warm a piece is = average weight of the fits it's in (unknown if in none).
  const warmth = new Map();
  for (const p of pieces) {
    const ws = fits.filter(f => f.pieceIds.includes(p.id)).map(f => f.weight ?? 2);
    if (ws.length) warmth.set(p.id, ws.reduce((a, b) => a + b, 0) / ws.length);
  }
  // How often a piece gets worn → favor the forgotten ones.
  const wearCount = new Map();
  for (const w of wears) for (const id of w.pieceIds || []) wearCount.set(id, (wearCount.get(id) || 0) + 1);
  const maxWear = Math.max(1, ...wearCount.values());
  const novelty = (ids) => 1 - ids.reduce((s, id) => s + (wearCount.get(id) || 0), 0) / (ids.length * maxWear);

  const col = (p) => ({ hex: p.color, category: p.category });
  const best = (list, base) => {
    let top = null, ts = -1;
    for (const p of list) {
      const h = harmony([...base, p].map(col));
      const sc = h ? h.score : 0.6;
      if (sc > ts) { ts = sc; top = p; }
    }
    return top;
  };

  const ideas = [];
  for (const t of tops) for (const b of bottoms) {
    if (existing.has(t.id + '|' + b.id)) continue;
    const known = [warmth.get(t.id), warmth.get(b.id)].filter(v => v != null);
    let w = known.length ? known.reduce((a, c) => a + c, 0) / known.length : (targetWeight ?? 2);
    const set = [t, b];
    if (targetWeight != null && targetWeight >= 4 && outers.length && w < targetWeight) {
      const o = best(outers, set);
      if (o) { set.push(o); w = Math.max(w + 1, warmth.get(o.id) ?? 0); }
    }
    if (shoes.length) { const s = best(shoes, set); if (s) set.push(s); }
    const ids = set.map(p => p.id);
    const key = comboKey(ids);
    if (dismissed.has(key) || fitKeys.has(key)) continue;
    const h = harmony(set.map(col));
    const weight = Math.max(0, Math.min(5, Math.round(w)));
    const weatherFit = targetWeight == null ? 0.7 : Math.max(0, 1 - Math.abs(weight - targetWeight) / 3);
    const score = (h ? h.score : 0.65) * 0.55 + weatherFit * 0.25 + novelty(ids) * 0.2 + rand() * 0.06;
    ideas.push({ key, pieceIds: ids, weight, harmony: h, score });
  }
  ideas.sort((a, b) => b.score - a.score);

  // Keep it varied: each top/bottom appears at most twice.
  const used = new Map(), out = [];
  for (const idea of ideas) {
    const [t, b] = idea.pieceIds;
    if ((used.get(t) || 0) >= 2 || (used.get(b) || 0) >= 2) continue;
    used.set(t, (used.get(t) || 0) + 1); used.set(b, (used.get(b) || 0) + 1);
    out.push(idea);
    if (out.length >= limit) break;
  }
  return out;
}
