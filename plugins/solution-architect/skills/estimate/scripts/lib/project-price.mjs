// Estimator v2's Project Roll-up sheet. Feature build effort is roughly half
// of a project; everything here is the other half. Context factors combine
// additively (1 + the sum of the deviations) because multiplying five
// factors together produces numbers nobody can defend.

export const CONTEXT_FACTORS = {
  codebaseMaturity: [1.0, 1.1, 1.2, 1.45],
  stackFamiliarity: [1.0, 1.15, 1.35, 1.35],
  specQuality: [0.95, 1.0, 1.2, 1.45],
  compliance: [1.0, 1.15, 1.4, 1.4],
  clientDecisions: [1.0, 1.1, 1.25, 1.4],
};
export const CONTEXT_CAP = 2.5;

export const OVERHEADS = {
  foundation: 0.12, discovery: 0.06, ux: 0.08, qa: 0.08,
  devops: 0.05, docs: 0.03, pm: 0.10,
};
export const INTEGRATION = { perFeature: 0.02, cap: 0.25 };
export const CONTINGENCY = { base: 0.05, perUncertaintyPoint: 0.02, perRiskPoint: 0.02 };
export const ROUNDING = 500;
const Z = { p20: -0.84, p80: 0.84, p95: 1.645 };

// A level outside 1-4, or absent, prices as 1.0 — v2's IFERROR(INDEX(..),1).
const multiplierFor = (mults, level) => mults[level - 1] ?? 1;

export function contextMultiplier(levels, factors = CONTEXT_FACTORS, cap = CONTEXT_CAP) {
  const deviations = Object.entries(factors)
    .reduce((sum, [k, mults]) => sum + (multiplierFor(mults, levels[k]) - 1), 0);
  return Math.min(cap, 1 + deviations);
}

export function overheadFor(featureCount, lines = OVERHEADS, integration = INTEGRATION) {
  const all = { ...lines, integration: Math.min(integration.cap, integration.perFeature * featureCount) };
  return { lines: all, totalPct: Object.values(all).reduce((a, b) => a + b, 0) };
}

export function contingencyRate({ avgUnc, avgRisk }, params = CONTINGENCY) {
  return params.base + avgUnc * params.perUncertaintyPoint + avgRisk * params.perRiskPoint;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ceilTo = (n, step) => Math.ceil(n / step) * step;

// The percentile spread and its rounded, client-facing presentation. All seven
// fields derive from p50, sigma and the rounding step alone — nothing else
// projectPrice computes feeds them — which is what makes this a clean seam.
function percentileBlock(p50, sigma, rounding) {
  return {
    p20: p50 + Z.p20 * sigma,
    p80: p50 + Z.p80 * sigma,
    p95: p50 + Z.p95 * sigma,
    presentLow: ceilTo(p50, rounding),
    presentHigh: ceilTo(p50 + Z.p95 * sigma, rounding),
    singleNumber: ceilTo(p50 + Z.p80 * sigma, rounding),
    impliedAccuracy: p50 === 0 ? 0 : sigma / p50,
  };
}

export function projectPrice({ features, levels, rounding = ROUNDING }) {
  const featurePoints = features.reduce((sum, f) => sum + f.point, 0);
  const multiplier = contextMultiplier(levels);
  const adjustedBase = featurePoints * multiplier;
  const { lines, totalPct } = overheadFor(features.length);
  const overheadAmount = adjustedBase * totalPct;
  const rate = contingencyRate({
    avgUnc: mean(features.map((f) => f.unc)), avgRisk: mean(features.map((f) => f.risk)),
  });
  const contingencyAmount = (adjustedBase + overheadAmount) * rate;
  const p50 = adjustedBase + overheadAmount + contingencyAmount;
  const buildSigma = Math.sqrt(features.reduce((sum, f) => sum + (f.point * f.spread) ** 2, 0));
  const sigma = featurePoints === 0 ? 0 : buildSigma * p50 / featurePoints;
  return {
    featurePoints,
    contextMultiplier: multiplier,
    adjustedBase,
    overheads: { lines, totalPct, amount: overheadAmount },
    contingencyRate: rate,
    contingencyAmount,
    p50,
    sigma,
    ...percentileBlock(p50, sigma, rounding),
  };
}
