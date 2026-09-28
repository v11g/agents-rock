// Client-facing figures derived from estimation.json — the proposal never
// invents a number. The range is the estimate's own presented range, so the
// proposal and the workbook always quote the same figures. Milestone splits
// follow the roadmap's effort shares; there are no durations, because the
// estimate produces none.
export const round100 = (n) => Math.round(n / 100) * 100;
export const formatMoney = (n) => `$${n.toLocaleString('en-US')}`;

const split = (cost, share) => ({ low: round100(cost.low * share), high: round100(cost.high * share) });

export function deriveFigures(estimation) {
  const { price, roadmap } = estimation.computed;
  if (!price || price.p50 === 0) {
    throw new Error('estimate is not priced (no scored features) — a proposal cannot quote it');
  }
  const cost = { low: price.presentLow, high: price.presentHigh };
  return {
    cost,
    singleNumber: price.singleNumber,
    milestones: (roadmap ?? []).map((b) => ({
      name: b.milestone, cost: split(cost, b.share), share: b.share,
    })),
  };
}
