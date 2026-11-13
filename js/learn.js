// Fitty — learn from "How did it feel?" feedback.
//
// Each piece of feedback is -1 (too cold), 0 (just right) or +1 (too hot).
//  • Personal bias: if you're often cold in general, every day is treated as a bit colder
//    (so heavier fits get picked). ~3 °C per "always cold", capped at ±5 °C.
//  • Per-fit correction: if one fit makes you cold more often than your average, it's treated
//    as lighter than the weight you gave it (and vice versa). Up to ±1.5 weight steps.
// Confidence grows with the amount of feedback, so one tap never swings things much.

const DEG_PER_UNIT = 3;
const MAX_BIAS = 5;
const MAX_ADJ = 1.5;

export function computeLearning(wears, { since = 0 } = {}) {
  const rated = wears
    .filter(w => typeof w.feel === 'number' && (w.feltAt || w.createdAt || 0) >= since)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-30);
  const n = rated.length;
  const empty = { n: 0, biasC: 0, perFit: new Map(), justRightPct: null };
  if (!n) return empty;

  const mean = rated.reduce((s, w) => s + w.feel, 0) / n;
  const conf = n / (n + 3);                      // 1 → 0.25, 3 → 0.5, 9 → 0.75
  const biasC = clamp(mean * DEG_PER_UNIT * conf, -MAX_BIAS, MAX_BIAS);

  const byFit = new Map();
  for (const w of rated) {
    if (!byFit.has(w.fitId)) byFit.set(w.fitId, []);
    byFit.get(w.fitId).push(w.feel);
  }
  const perFit = new Map();
  for (const [fitId, vals] of byFit) {
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    const rel = m - mean;                         // how this fit differs from your usual
    const c = vals.length / (vals.length + 1);    // 1 → 0.5, 2 → 0.67, 4 → 0.8
    const adj = clamp(rel * c * MAX_ADJ, -MAX_ADJ, MAX_ADJ);
    // too cold in this fit (rel < 0) → it's lighter than labeled → negative adjustment
    if (Math.abs(adj) >= 0.1) perFit.set(fitId, Math.round(adj * 10) / 10);
  }
  const justRightPct = Math.round(100 * rated.filter(w => w.feel === 0).length / n);
  return { n, biasC: Math.round(biasC * 10) / 10, perFit, justRightPct };
}

export function effectiveWeight(fit, learning) {
  const adj = learning && learning.perFit.get(fit.id) || 0;
  return clamp((fit.weight ?? 2) + adj, 0, 5);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
