// Every formula the estimate ships — imported by compute.mjs at build time.
// render.mjs inlines pert() alone into the team page (task expected hours in
// the breakdown); every month and cost the page shows is a committed number.

export const AI_CATEGORIES = {
  boilerplate: { min: 0.5, max: 0.8 },
  logic: { min: 0.2, max: 0.4 },
  novel: { min: 0.0, max: 0.1 },
};
export const SENIORITY_FACTOR = { junior: 1.15, mid: 1.0, senior: 0.85 };
export const HOURS_PER_MONTH = 140;
export const COORDINATION_TAX = 0.10;
// The team workbook's tier scale (its sheet-1 formula and Tier Reference tab):
// one scale for the interview, the validator, the page and the xlsx export.
export const TIER_BREAKS = [
  { max: 11, tier: 'S' }, { max: 17, tier: 'M' }, { max: 22, tier: 'L' }, { max: Infinity, tier: 'XL' },
];

export function pert({ o, m, p }) {
  return { e: (o + 4 * m + p) / 6, sigma: (p - o) / 6 };
}

export function projectBuffer(sigmas) {
  return Math.sqrt(sigmas.reduce((sum, s) => sum + s * s, 0));
}

export function tierFor(scores) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { total, tier: TIER_BREAKS.find((b) => total <= b.max).tier };
}

const clampRed = (r) => Math.min(Math.max(r, 0), 0.9);

export function aiAdjust({ e, category, verificationPct, scale = 1 }) {
  const { min, max } = AI_CATEGORIES[category];
  const red = clampRed(((min + max) / 2) * scale);
  const redMax = clampRed(max * scale);
  const [tr, ar, ao] = [e, e * (1 - red), e * (1 - redMax)];
  return ((ao + 2 * ar + tr) / 4) * (1 + verificationPct);
}

// Seniority scales the base effort on every path; the AI reduction is a
// property of the task category alone. Scaling the reduction by seniority
// instead made juniors come out faster than seniors on AI plans.
export function taskHours({ e, seniority, aiAssisted, category, verificationPct, scale = 1 }) {
  const base = e * SENIORITY_FACTOR[seniority];
  return aiAssisted ? aiAdjust({ e: base, category, verificationPct, scale }) : base;
}

// One seniority drives effort for a whole team: the most common level wins,
// ties go to the more senior. Rank comes from the factor values themselves
// (more senior = lower factor), never from key order. Lives here (not
// rollup.mjs) so the inlined bundle hands the page the same function the
// committed rollup uses.
export const dominantSeniority = (team) => Object.keys(SENIORITY_FACTOR)
  .sort((a, b) => SENIORITY_FACTOR[a] - SENIORITY_FACTOR[b])
  .map((level) => [level, team.filter((m) => m.seniority === level).length])
  .reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];

export function riskBufferHours(risks) {
  return risks.reduce((sum, r) => sum + r.probability * r.impactHours, 0);
}

export function effectiveCapacity(engineers) {
  return Math.max(1, engineers * (1 - COORDINATION_TAX * (engineers - 1)));
}

// Tooling is priced per seat per month, vendor-neutral. A null seat cost is
// a recorded gap (the schema demands an assumption for it) and prices as 0.
export function scenarioRollup({ hours, team, toolingCostPerSeat }) {
  const months = hours / (effectiveCapacity(team.length) * HOURS_PER_MONTH);
  const laborCost = months * team.reduce((sum, t) => sum + t.rate * HOURS_PER_MONTH, 0);
  const toolingCost = months * (toolingCostPerSeat ?? 0) * team.length;
  return { months, laborCost, toolingCost, totalCost: laborCost + toolingCost };
}

// Sequential roadmap: each milestone's band width is its share of total task
// hours × scenario months, so bands tile [0, months] and buffers/overhead
// spread proportionally instead of piling up at the end.
export function roadmapBands({ milestones, months }) {
  const total = milestones.reduce((sum, m) => sum + m.hours, 0);
  let at = 0;
  return milestones.map((m) => {
    const startMonths = at;
    at += total > 0 ? (m.hours / total) * months : 0;
    return { name: m.name, startMonths, endMonths: at };
  });
}
