// Fitty — recommendation engine (pure functions, no DOM).
//
// score = weatherFactor × fitRecency × sharedPieceFactor
//  • weatherFactor: how close the fit's weight (0–5) is to the day's target weight.
//  • fitRecency:    0 during the block window (default 2 days after wearing),
//                   then climbs gradually back to 1 over the fade window (default 7 days).
//  • sharedPieceFactor: pieces you wore recently in OTHER fits pull this fit down too.
//                   Accessories don't count (you can wear the same watch daily), shoes count half.
// The final pick is weighted-random among candidates so you get variety, not the same #1 forever.

export const DAY_MS = 86400000;

export const toISO = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / DAY_MS); // b - a

const WEATHER_CURVE = [1, 0.55, 0.2, 0.06, 0.02, 0.01];
export const PIECE_WEIGHT = { top: 1, bottom: 1, outerwear: 1, shoes: 0.5, accessory: 0 };

export function weatherFactor(fitWeight, target) {
  if (target == null) return 1;
  const d = Math.min(5, Math.abs((fitWeight ?? 2) - target));   // may be fractional (learned weights)
  const i = Math.floor(d), f = d - i;
  return i >= 5 ? WEATHER_CURVE[5] : WEATHER_CURVE[i] * (1 - f) + WEATHER_CURVE[i + 1] * f;
}

export function recencyFactor(daysSince, blockDays, fadeDays) {
  if (daysSince == null) return 1;                 // never worn
  if (daysSince <= blockDays) return 0;            // blocked
  const t = (daysSince - blockDays) / Math.max(1, fadeDays);
  return Math.min(1, Math.max(0.12, t));
}

// Last date (before targetDate) each fit and each piece was worn.
export function lastWornMaps(wears, targetDate) {
  const fitLast = new Map(), pieceLast = new Map(), fitNext = new Map();
  for (const w of wears) {
    if (w.date > targetDate) {           // already planned for a later day
      if (!fitNext.has(w.fitId) || fitNext.get(w.fitId) > w.date) fitNext.set(w.fitId, w.date);
      continue;
    }
    if (w.date === targetDate) continue;
    if (!fitLast.has(w.fitId) || fitLast.get(w.fitId) < w.date) fitLast.set(w.fitId, w.date);
    for (const pid of w.pieceIds || []) {
      if (!pieceLast.has(pid) || pieceLast.get(pid) < w.date) pieceLast.set(pid, w.date);
    }
  }
  return { fitLast, pieceLast, fitNext };
}

export function scoreFits({ fits, pieces, wears, targetDate, targetWeight, groupId = 'all',
  blockDays = 2, fadeDays = 7, skipped = new Set(), weightOf = (f) => f.weight }) {
  const pieceById = new Map(pieces.map(p => [p.id, p]));
  const { fitLast, pieceLast, fitNext } = lastWornMaps(wears, targetDate);
  const results = [];
  for (const fit of fits) {
    if (groupId !== 'all' && fit.groupId !== groupId) continue;
    if (!fit.pieceIds || fit.pieceIds.length === 0) continue;
    const last = fitLast.get(fit.id) || null;
    const since = last ? daysBetween(last, targetDate) : null;
    const next = fitNext.get(fit.id);
    const plannedSoon = next && daysBetween(targetDate, next) <= blockDays;
    const rec = plannedSoon ? 0 : recencyFactor(since, blockDays, fadeDays);
    const wf = weatherFactor(weightOf(fit), targetWeight);

    // Shared-piece penalty (only from wears of OTHER fits — own wears are covered by `rec`).
    let wSum = 0, fSum = 0;
    for (const pid of fit.pieceIds) {
      const p = pieceById.get(pid);
      if (!p) continue;
      const w = PIECE_WEIGHT[p.category] ?? 1;
      if (!w) continue;
      const pl = pieceLast.get(pid);
      let f = 1;
      if (pl && pl !== last) {
        const ds = daysBetween(pl, targetDate);
        f = ds <= blockDays ? 0.15 : Math.min(1, 0.15 + 0.85 * (ds - blockDays) / Math.max(1, fadeDays));
      }
      wSum += w; fSum += w * f;
    }
    const pf = wSum ? fSum / wSum : 1;

    const blocked = rec === 0;
    const score = blocked ? 0 : wf * rec * pf;
    results.push({ fit, score, weatherF: wf, recencyF: rec, pieceF: pf, lastWorn: last, daysSince: since,
      blocked, skipped: skipped.has(fit.id) });
  }
  return results.sort((a, b) => b.score - a.score);
}

export function pickWeighted(scored, rand = Math.random) {
  const pool = scored.filter(s => !s.blocked && !s.skipped && s.score > 0);
  if (!pool.length) return null;
  const total = pool.reduce((a, s) => a + s.score, 0);
  let r = rand() * total;
  for (const s of pool) { r -= s.score; if (r <= 0) return s; }
  return pool[pool.length - 1];
}
