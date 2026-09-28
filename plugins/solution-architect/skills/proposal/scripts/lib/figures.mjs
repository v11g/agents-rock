// Client-facing figures derived from estimation.json — the proposal never
// invents a number. The range is the estimate's own presented range, so the
// proposal and the workbook always quote the same figures. Milestone splits
// follow the roadmap's effort shares; there are no durations, because the
// estimate produces none.
export const round100 = (n) => Math.round(n / 100) * 100;
export const formatMoney = (n) => `$${n.toLocaleString('en-US')}`;

const split = (cost, share) => ({ low: round100(cost.low * share), high: round100(cost.high * share) });

// The rows sit above a bold Total line the client reads against them, so
// they must add up to it exactly: every milestone but the last is its share
// rounded to $100, and the last takes whatever remains (R59).
function splitCosts(cost, roadmap) {
  if (roadmap.length === 0) return [];
  const heads = roadmap.slice(0, -1).map((b) => split(cost, b.share));
  const taken = (bound) => heads.reduce((sum, c) => sum + c[bound], 0);
  return [...heads, { low: cost.low - taken('low'), high: cost.high - taken('high') }];
}

export function deriveFigures(estimation) {
  const { price, roadmap } = estimation.computed;
  if (!price || price.p50 === 0) {
    throw new Error('estimate is not priced (no scored features) — a proposal cannot quote it');
  }
  const cost = { low: price.presentLow, high: price.presentHigh };
  const bands = roadmap ?? [];
  const costs = splitCosts(cost, bands);
  return {
    cost,
    singleNumber: price.singleNumber,
    milestones: bands.map((b, i) => ({ name: b.milestone, cost: costs[i], share: b.share })),
  };
}
