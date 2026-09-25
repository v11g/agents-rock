// Per-feature pricing, transcribed from Estimator v2's Ballpark Estimator
// sheet. Size is deliberately the lightest weight and uncertainty the
// heaviest: in agent-assisted delivery, volume of code is cheap and unclear
// requirements are not. Bands are continuous — each band's price high is the
// next band's price low — which is what removes the tier cliff v1 had.

export const WEIGHTS = { tech: 0.20, size: 0.10, deps: 0.20, unc: 0.30, risk: 0.20 };

export const BANDS = [
  { tier: 'S', start: 5, end: 11.5, priceLow: 500, priceHigh: 1500 },
  { tier: 'M', start: 11.5, end: 17.5, priceLow: 1500, priceHigh: 4000 },
  { tier: 'L', start: 17.5, end: 22.5, priceLow: 4000, priceHigh: 10000 },
  { tier: 'XL', start: 22.5, end: 25, priceLow: 10000, priceHigh: 25000 },
];

export const MODEL_PARAMS = {
  baseSpread: 0.15,
  perUncertaintyPoint: 0.07,
  perRiskPoint: 0.03,
  deepEstimateAbove: 6000,
  deepEstimateSpread: 0.4,
};

export function weightedScore(scores) {
  return Object.keys(WEIGHTS).reduce((sum, k) => sum + scores[k] * WEIGHTS[k], 0) * 5;
}

// v2 uses MATCH(score, band starts, 1): the last band whose start is at or
// below the score. A score exactly on a boundary therefore takes the upper
// band, and anything at or above the final start stays XL.
export function bandFor(score) {
  return BANDS.reduce((best, b) => (score >= b.start ? b : best), BANDS[0]);
}

export function pointEstimate(score) {
  const b = bandFor(Math.min(score, BANDS[BANDS.length - 1].end));
  const through = (Math.min(score, b.end) - b.start) / (b.end - b.start);
  return b.priceLow + through * (b.priceHigh - b.priceLow);
}

export function spreadFor({ unc, risk }, params = MODEL_PARAMS) {
  return params.baseSpread
    + Math.max(0, unc - 1) * params.perUncertaintyPoint
    + Math.max(0, risk - 1) * params.perRiskPoint;
}

function flagFor({ score, point, spread, size }, params) {
  const xl = BANDS[BANDS.length - 1].start;
  if (score >= xl && size === 5) return 'SPLIT into sub-features';
  if (score >= xl) return 'Deep estimate required';
  if (spread >= params.deepEstimateSpread) return 'Deep estimate recommended';
  if (point >= params.deepEstimateAbove) return 'Deep estimate recommended';
  return '';
}

export function featurePrice(scores, params = MODEL_PARAMS) {
  const score = weightedScore(scores);
  const point = pointEstimate(score);
  const spread = spreadFor(scores, params);
  return {
    score,
    tier: bandFor(score).tier,
    point,
    spread,
    low: point * (1 - spread),
    high: point * (1 + spread),
    flag: flagFor({ score, point, spread, size: scores.size }, params),
  };
}
