// Fitty — week planner.
// Plans day by day: each planned fit is treated as "worn" when planning the next days,
// so the usual cooldown and shared-piece rules keep the week varied.
import { scoreFits, pickWeighted } from './recommend.js';

// dates: ['YYYY-MM-DD', ...] in order. keep: plan entries to leave untouched.
// Returns { [date]: fitId } for every date that got a fit (days with a logged wear are skipped).
export function buildPlan({ dates, fits, pieces, wears, targetWeightFor, keep = {}, groupId = 'all',
  blockDays = 2, fadeDays = 7, weightOf, rand = Math.random }) {
  const fitById = new Map(fits.map(f => [f.id, f]));
  const worn = new Set(wears.map(w => w.date));
  const plan = {};
  const simulated = (excludeDate) => {
    const extra = [];
    for (const [date, fitId] of Object.entries({ ...keep, ...plan })) {
      if (date === excludeDate || worn.has(date)) continue;
      const f = fitById.get(fitId);
      if (f) extra.push({ fitId, date, pieceIds: f.pieceIds });
    }
    return wears.concat(extra);
  };
  for (const date of dates) {
    if (worn.has(date)) continue;
    if (keep[date] && fitById.has(keep[date])) { plan[date] = keep[date]; continue; }
    const scored = scoreFits({
      fits, pieces, wears: simulated(date), targetDate: date, targetWeight: targetWeightFor(date),
      groupId, blockDays, fadeDays, weightOf,
    });
    const pick = pickWeighted(scored, rand);
    if (pick) plan[date] = pick.fit.id;
  }
  return plan;
}

// Re-pick a single day, avoiding the current choice when possible.
export function repickDay({ date, plan, fits, pieces, wears, targetWeight, groupId = 'all',
  blockDays = 2, fadeDays = 7, weightOf, rand = Math.random }) {
  const fitById = new Map(fits.map(f => [f.id, f]));
  const extra = Object.entries(plan)
    .filter(([d]) => d !== date && !wears.some(w => w.date === d))
    .map(([d, fitId]) => ({ fitId, date: d, pieceIds: (fitById.get(fitId) || {}).pieceIds || [] }));
  const scored = scoreFits({
    fits, pieces, wears: wears.concat(extra), targetDate: date, targetWeight, groupId, blockDays, fadeDays,
    weightOf, skipped: new Set(plan[date] ? [plan[date]] : []),
  });
  const pick = pickWeighted(scored, rand);
  return pick ? pick.fit.id : plan[date] || null;
}
