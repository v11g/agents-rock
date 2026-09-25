# Estimator v2 Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the estimate skill's hours×rates pricing with Estimator v2's score-driven model, and adapt the proposal skill to the outputs that remain.

**Architecture:** Feature price comes from five weighted scores interpolated inside continuous tier bands. A project roll-up scales that by five context factors, adds eight overhead lines and contingency, and produces a percentile range. PERT and the task register survive as delivery planning only — they no longer feed price, and nothing produces a duration.

**Tech Stack:** Node ≥ 20, zero runtime dependencies, `node --test` with `node:assert/strict`. ES modules throughout.

**Spec:** `docs/superpowers/specs/2026-09-23-estimate-v2-adoption-design.md`

## Global Constraints

- Node ≥ 20 for skill scripts; the repo root `engines` floor of `>=18.3` is for the installer only and does not change.
- Scripts stay dependency-free. No `npm install` to run them.
- Ten functions per module maximum — this is why `schema.mjs`, `scenario-schema.mjs` and `scoring-schema.mjs` are already split. Split again rather than exceed it.
- Every map written into `estimation.json` is assembled with sorted keys so repeat runs are byte-identical.
- Money is rounded to 2 decimals via the existing `round2` in `rollup.mjs`; presented figures round up to the nearest 500.
- Run the full suite with `node --test plugins/*/skills/*/scripts/test/*.test.mjs` from the repo root.
- Dimension weights, tier bands, model parameters, context multipliers, overhead percentages and contingency rates are all **editable inputs**, never hardcoded constants without an override path. This is v2's own instruction ("the defaults are starting points, not truths").
- **Git is currently blocked in this session.** The rtk hook rewrites `git` to `rtk git` and the worktree guard refuses the result. The commit step in each task is written as normal; if it fails, complete the task's code and tests and batch the commits once git works. Do not skip the tests to work around it.

## Review Focus

Five conditions the spec implies that no task's happy-path tests would exercise. Each has its test added to the task that owns the code.

1. **A feature scored all 1s** lands on exactly 5.0, the bottom edge of the first band — interpolation must not divide by zero or fall outside the band table. (Task 1)
2. **A feature scored all 5s** lands on exactly 25.0, the top edge of the last band — it must resolve to XL, not fall past the end of the table. (Task 1)
3. **A score landing exactly on a band boundary** (11.5, 17.5, 22.5) must pick the upper band, matching v2's `MATCH(score, starts, 1)`. Off-by-one here silently reprices every borderline feature. (Task 1)
4. **Zero priced features** — QUICK depth persists no scores, and the roll-up divides by the sum of point estimates to scale sigma. It must return zeros, not `NaN` or `Infinity`. (Task 2)
5. **A context factor level that is missing or outside 1–4** must fall back to a multiplier of 1.0, matching v2's `IFERROR(INDEX($H11:$K11,$C11),1)`, rather than throwing or producing `undefined`. (Task 2)

---

### Task 1: Feature pricing module

Weighted score, continuous band lookup, interpolated point estimate, spread, and the flag column — all the per-feature arithmetic from v2's Ballpark Estimator sheet.

**Files:**
- Create: `plugins/solution-architect/skills/estimate/scripts/lib/pricing.mjs`
- Test: `plugins/solution-architect/skills/estimate/scripts/test/pricing.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `WEIGHTS`, `BANDS`, `MODEL_PARAMS`, `weightedScore(scores) -> number`, `bandFor(score) -> band`, `pointEstimate(score) -> number`, `spreadFor({ unc, risk }) -> number`, `featurePrice(scores) -> { score, tier, point, spread, low, high, flag }`. `scores` is `{ tech, size, deps, unc, risk }` with integer values 1–5.

- [ ] **Step 1: Write the failing tests**

```javascript
// plugins/solution-architect/skills/estimate/scripts/test/pricing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEIGHTS, BANDS, weightedScore, bandFor, pointEstimate, spreadFor, featurePrice,
} from '../lib/pricing.mjs';

const close = (got, want) => assert.ok(Math.abs(got - want) < 1e-6, `${got} !~ ${want}`);
const s = (tech, size, deps, unc, risk) => ({ tech, size, deps, unc, risk });

test('weights sum to 1 and follow v2: size lightest, uncertainty heaviest', () => {
  close(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 1);
  assert.equal(WEIGHTS.size, 0.10);
  assert.equal(WEIGHTS.unc, 0.30);
});

test('weightedScore: SUMPRODUCT(scores, weights) x 5', () => {
  close(weightedScore(s(1, 3, 3, 3, 3)), 13);
  close(weightedScore(s(3, 3, 4, 2, 4)), 15.5);
  close(weightedScore(s(4, 4, 4, 4, 4)), 20);
});

test('bands are continuous: each price high equals the next price low', () => {
  for (let i = 0; i < BANDS.length - 1; i += 1) {
    assert.equal(BANDS[i].end, BANDS[i + 1].start);
    assert.equal(BANDS[i].priceHigh, BANDS[i + 1].priceLow);
  }
});

test('pointEstimate interpolates inside the band', () => {
  close(pointEstimate(13), 2125);          // 1500 + (13-11.5)/6 * 2500
  close(pointEstimate(20), 7000);          // 4000 + (20-17.5)/5 * 6000
  close(pointEstimate(15.5), 3166.666667);
  close(pointEstimate(8), 961.538462);     // 500 + (8-5)/6.5 * 1000
});

test('a band boundary picks the upper band', () => {
  assert.equal(bandFor(11.5).tier, 'M');
  assert.equal(bandFor(17.5).tier, 'L');
  assert.equal(bandFor(22.5).tier, 'XL');
});

test('all ones lands on the bottom edge without dividing by zero', () => {
  close(weightedScore(s(1, 1, 1, 1, 1)), 5);
  assert.equal(bandFor(5).tier, 'S');
  close(pointEstimate(5), 500);
});

test('all fives lands on the top edge and stays XL', () => {
  close(weightedScore(s(5, 5, 5, 5, 5)), 25);
  assert.equal(bandFor(25).tier, 'XL');
  close(pointEstimate(25), 25000);
});

test('spread widens faster with uncertainty than with risk', () => {
  close(spreadFor({ unc: 1, risk: 1 }), 0.15);
  close(spreadFor({ unc: 3, risk: 3 }), 0.35);
  close(spreadFor({ unc: 4, risk: 4 }), 0.45);
  close(spreadFor({ unc: 2, risk: 4 }), 0.31);
});

test('featurePrice matches the workbook row for user authentication', () => {
  const f = featurePrice(s(1, 3, 3, 3, 3));
  close(f.score, 13);
  assert.equal(f.tier, 'M');
  close(f.point, 2125);
  close(f.spread, 0.35);
  close(f.low, 1381.25);
  close(f.high, 2868.75);
  assert.equal(f.flag, '');
});

test('a spread at or above 0.4 recommends a deep estimate', () => {
  assert.equal(featurePrice(s(4, 4, 4, 4, 4)).flag, 'Deep estimate recommended');
});

test('an XL feature that is also epic-sized must be split', () => {
  assert.equal(featurePrice(s(5, 5, 5, 5, 5)).flag, 'SPLIT into sub-features');
});

test('an XL feature that is not epic-sized requires a deep estimate', () => {
  assert.equal(featurePrice(s(5, 3, 5, 5, 5)).flag, 'Deep estimate required');
});

test('a point estimate above the threshold recommends a deep estimate', () => {
  const f = featurePrice(s(4, 4, 4, 2, 3));
  assert.ok(f.point >= 6000, `expected >= 6000, got ${f.point}`);
  assert.equal(f.flag, 'Deep estimate recommended');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/pricing.test.mjs`
Expected: FAIL — `Cannot find module '../lib/pricing.mjs'`

- [ ] **Step 3: Write the implementation**

```javascript
// plugins/solution-architect/skills/estimate/scripts/lib/pricing.mjs
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/pricing.test.mjs`
Expected: PASS — 13 tests

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/lib/pricing.mjs \
        plugins/solution-architect/skills/estimate/scripts/test/pricing.test.mjs
git commit -m "feat(estimate): add v2 weighted-score feature pricing"
```

---

### Task 2: Project roll-up pricing module

Context factors, overhead lines, contingency and the percentile range — v2's Project Roll-up sheet.

**Files:**
- Create: `plugins/solution-architect/skills/estimate/scripts/lib/project-price.mjs`
- Test: `plugins/solution-architect/skills/estimate/scripts/test/project-price.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime; it receives already-priced features as `{ point, spread, unc, risk }[]`.
- Produces: `CONTEXT_FACTORS`, `CONTEXT_CAP`, `OVERHEADS`, `CONTINGENCY`, `contextMultiplier(levels) -> number`, `overheadFor(featureCount) -> { lines, totalPct }`, `contingencyRate({ avgUnc, avgRisk }) -> number`, `projectPrice({ features, levels, featureCount }) -> priceBlock`. The returned `priceBlock` has `featurePoints`, `contextMultiplier`, `adjustedBase`, `overheads`, `contingencyRate`, `contingencyAmount`, `p50`, `sigma`, `p20`, `p80`, `p95`, `presentLow`, `presentHigh`, `singleNumber`, `impliedAccuracy`.

- [ ] **Step 1: Write the failing tests**

```javascript
// plugins/solution-architect/skills/estimate/scripts/test/project-price.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_FACTORS, contextMultiplier, overheadFor, contingencyRate, projectPrice,
} from '../lib/project-price.mjs';

const close = (got, want, eps = 1e-4) => assert.ok(Math.abs(got - want) < eps, `${got} !~ ${want}`);

// The workbook's own five sample features, already priced by Task 1.
const SAMPLE = [
  { point: 2125, spread: 0.35, unc: 3, risk: 3 },
  { point: 7000, spread: 0.45, unc: 4, risk: 4 },
  { point: 3166.666667, spread: 0.31, unc: 2, risk: 4 },
  { point: 961.538462, spread: 0.15, unc: 1, risk: 1 },
  { point: 2958.333333, spread: 0.32, unc: 3, risk: 2 },
];
const LEVELS = {
  codebaseMaturity: 2, stackFamiliarity: 1, specQuality: 3, compliance: 1, clientDecisions: 2,
};

test('context factors cover the five v2 dimensions with four levels each', () => {
  assert.deepEqual(Object.keys(CONTEXT_FACTORS).sort(), [
    'clientDecisions', 'codebaseMaturity', 'compliance', 'specQuality', 'stackFamiliarity',
  ]);
  for (const mults of Object.values(CONTEXT_FACTORS)) assert.equal(mults.length, 4);
});

test('context factors combine additively, not multiplicatively', () => {
  close(contextMultiplier(LEVELS), 1.40);
});

test('a missing or out-of-range level falls back to a multiplier of 1', () => {
  close(contextMultiplier({ ...LEVELS, compliance: 9 }), 1.40);
  close(contextMultiplier({ ...LEVELS, compliance: undefined }), 1.40);
  close(contextMultiplier({}), 1.0);
});

test('the composite multiplier is capped', () => {
  const worst = {
    codebaseMaturity: 4, stackFamiliarity: 4, specQuality: 4, compliance: 4, clientDecisions: 4,
  };
  close(contextMultiplier(worst), 2.5);
});

test('overheads total 62% at five features', () => {
  const { totalPct, lines } = overheadFor(5);
  close(totalPct, 0.62);
  close(lines.integration, 0.10);
});

test('integration overhead grows per feature and caps at 25%', () => {
  close(overheadFor(1).lines.integration, 0.02);
  close(overheadFor(20).lines.integration, 0.25);
});

test('contingency rises with average uncertainty and risk', () => {
  close(contingencyRate({ avgUnc: 2.6, avgRisk: 2.8 }), 0.158);
  close(contingencyRate({ avgUnc: 0, avgRisk: 0 }), 0.05);
});

test('projectPrice reproduces the workbook total', () => {
  const p = projectPrice({ features: SAMPLE, levels: LEVELS });
  close(p.featurePoints, 16211.538462);
  close(p.contextMultiplier, 1.40);
  close(p.adjustedBase, 22696.153846, 1e-3);
  close(p.overheads.amount, 14071.615385, 1e-3);
  close(p.contingencyRate, 0.158);
  close(p.p50, 42577.076769, 1e-2);
  close(p.sigma, 9232.005917, 1e-2);
  close(p.p20, 34822.1918, 1e-2);
  close(p.p80, 50331.96174, 1e-2);
  close(p.p95, 57763.7265, 1e-2);
  assert.equal(p.presentLow, 43000);
  assert.equal(p.presentHigh, 58000);
  assert.equal(p.singleNumber, 50500);
  close(p.impliedAccuracy, 0.216830, 1e-5);
});

test('sigma combines by root-sum-of-squares, not a plain sum', () => {
  const naive = SAMPLE.reduce((sum, f) => sum + f.point * f.spread, 0);
  const p = projectPrice({ features: SAMPLE, levels: LEVELS });
  const buildSigma = p.sigma * p.featurePoints / p.p50;
  assert.ok(buildSigma < naive, `${buildSigma} should be below the naive sum ${naive}`);
});

test('no priced features returns zeros, never NaN or Infinity', () => {
  const p = projectPrice({ features: [], levels: LEVELS });
  for (const k of ['featurePoints', 'p50', 'sigma', 'p80', 'impliedAccuracy']) {
    assert.ok(Number.isFinite(p[k]), `${k} is ${p[k]}`);
  }
  assert.equal(p.p50, 0);
  assert.equal(p.impliedAccuracy, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/project-price.test.mjs`
Expected: FAIL — `Cannot find module '../lib/project-price.mjs'`

- [ ] **Step 3: Write the implementation**

```javascript
// plugins/solution-architect/skills/estimate/scripts/lib/project-price.mjs
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
    p20: p50 + Z.p20 * sigma,
    p80: p50 + Z.p80 * sigma,
    p95: p50 + Z.p95 * sigma,
    presentLow: ceilTo(p50, rounding),
    presentHigh: ceilTo(p50 + Z.p95 * sigma, rounding),
    singleNumber: ceilTo(p50 + Z.p80 * sigma, rounding),
    impliedAccuracy: p50 === 0 ? 0 : sigma / p50,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/project-price.test.mjs`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/lib/project-price.mjs \
        plugins/solution-architect/skills/estimate/scripts/test/project-price.test.mjs
git commit -m "feat(estimate): add v2 project roll-up pricing"
```

---

### Task 3: Strip the hours-to-money machinery from estimate-math.mjs

Remove everything that existed only to turn hours into money or months, and repoint `tierFor` at the new band table.

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/estimate-math.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/scoring.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/estimate-math.test.mjs`

**Interfaces:**
- Consumes: `weightedScore`, `bandFor` from Task 1.
- Produces: `estimate-math.mjs` exporting only `AI_CATEGORIES`, `pert`, `roadmapBands`. `scoring.mjs` exporting `scoreSummary(feature) -> { scoreTotal, tier }` computed from the weighted score.

- [ ] **Step 1: Write the failing test**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/estimate-math.test.mjs
test('the hours-to-money machinery is gone', async () => {
  const mod = await import('../lib/estimate-math.mjs');
  for (const gone of ['SENIORITY_FACTOR', 'HOURS_PER_MONTH', 'COORDINATION_TAX',
    'taskHours', 'aiAdjust', 'dominantSeniority', 'effectiveCapacity',
    'scenarioRollup', 'riskBufferHours', 'projectBuffer', 'TIER_BREAKS', 'tierFor']) {
    assert.equal(mod[gone], undefined, `${gone} should no longer be exported`);
  }
  assert.ok(mod.pert && mod.roadmapBands && mod.AI_CATEGORIES);
});

test('roadmapBands returns shares that sum to 1, with no months', () => {
  const bands = roadmapBands({ milestones: [{ name: 'M1', hours: 75 }, { name: 'M2', hours: 25 }] });
  assert.deepEqual(bands.map((b) => b.name), ['M1', 'M2']);
  close(bands[0].share, 0.75);
  close(bands[1].share, 0.25);
  assert.equal(bands[0].startMonths, undefined);
});

test('roadmapBands with no hours does not divide by zero', () => {
  const bands = roadmapBands({ milestones: [{ name: 'M1', hours: 0 }] });
  assert.ok(Number.isFinite(bands[0].share));
  close(bands[0].share, 0);
});

test('scoreSummary uses the weighted score, not the raw sum', async () => {
  const { scoreSummary } = await import('../lib/scoring.mjs');
  const scores = Object.fromEntries(['tech', 'size', 'deps', 'unc', 'risk']
    .map((k, i) => [k, { n: [1, 3, 3, 3, 3][i], anchor: '', cite: 'x' }]));
  const got = scoreSummary({ scores });
  close(got.scoreTotal, 13);
  assert.equal(got.tier, 'M');
});
```

Delete from that file the existing tests for `aiAdjust`, `taskHours`, `effectiveCapacity`, `scenarioRollup`, `riskBufferHours`, `projectBuffer`, `dominantSeniority` and the `tierFor` boundary tests — Task 1 owns tiering now. Update the import list at the top to `{ pert, roadmapBands, AI_CATEGORIES }`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/estimate-math.test.mjs`
Expected: FAIL — the removal test reports `SENIORITY_FACTOR should no longer be exported`

- [ ] **Step 3: Rewrite estimate-math.mjs and scoring.mjs**

```javascript
// plugins/solution-architect/skills/estimate/scripts/lib/estimate-math.mjs
// What survives of the hours model after pricing moved to scores: PERT for
// task sizing, and the milestone shares the roadmap is drawn from. Nothing
// here converts hours to money or to months — price comes from pricing.mjs
// and project-price.mjs, and duration is deliberately not produced at all.

// Kept as a vocabulary, not as math: schema.mjs validates task.category
// against it and the Task Breakdown tab shows it. It no longer discounts
// anything, because nothing converts hours to money.
export const AI_CATEGORIES = {
  boilerplate: { min: 0.5, max: 0.8 },
  logic: { min: 0.2, max: 0.4 },
  novel: { min: 0.0, max: 0.1 },
};

export function pert({ o, m, p }) {
  return { e: (o + 4 * m + p) / 6, sigma: (p - o) / 6 };
}

// Milestone widths as shares of total task hours. Seniority and the
// verification percentage were uniform multipliers and cancelled out of
// these ratios exactly, which is why dropping them moves no boundary.
export function roadmapBands({ milestones }) {
  const total = milestones.reduce((sum, m) => sum + m.hours, 0);
  return milestones.map((m) => ({ name: m.name, share: total > 0 ? m.hours / total : 0 }));
}
```

In `scoring.mjs`, replace the `tierFor` import and the body of `scoreSummary`:

```javascript
import { weightedScore, bandFor } from './pricing.mjs';

// ...

export function scoreSummary(feature) {
  if (!feature.scores) return {};
  const scoreTotal = weightedScore(scoreNumbers(feature.scores));
  return { scoreTotal, tier: bandFor(scoreTotal).tier };
}
```

- [ ] **Step 4: Run the full estimate suite**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/*.test.mjs`
Expected: the four new tests PASS. `rollup.test.mjs`-adjacent suites (`compute.test.mjs`, `render.test.mjs`, `e2e.test.mjs`, `browser.test.mjs`, `xlsx-export.test.mjs`) now FAIL on missing exports — that is expected and is fixed by Tasks 4–8. Record which fail so Task 5 can confirm they come back.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/lib/estimate-math.mjs \
        plugins/solution-architect/skills/estimate/scripts/lib/scoring.mjs \
        plugins/solution-architect/skills/estimate/scripts/test/estimate-math.test.mjs
git commit -m "refactor(estimate): drop hours-to-money math, tier from weighted score"
```

---

### Task 3b: Re-tier the score review path

The score review page inlines the tier functions so an edited score re-tiers in the browser. It reads `TIER_BREAKS`/`tierFor`, which Task 3 removed. Runs after Task 3 and before Task 4; nothing downstream depends on it, but the suite is red until it lands.

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/pricing.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/score-html.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/score-csv.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/inline.mjs`
- Modify: `plugins/solution-architect/skills/estimate/assets/scores-review-template.html`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/score-review.test.mjs`

**Interfaces:**
- Consumes: `weightedScore`, `bandFor` from Task 1.
- Produces: `tierFor(scores) -> { total, tier }` exported from `pricing.mjs`, where `total` is the weighted score rounded to two decimals. Keeping this shape means the review template's three call sites need no restructuring.

- [ ] **Step 1: Write the failing tests**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/score-review.test.mjs
import { tierFor } from '../lib/pricing.mjs';

const nums = (tech, size, deps, unc, risk) => ({ tech, size, deps, unc, risk });

test('tierFor returns the weighted total, rounded, with its tier', () => {
  assert.deepEqual(tierFor(nums(1, 3, 3, 3, 3)), { total: 13, tier: 'M' });
  assert.deepEqual(tierFor(nums(3, 3, 4, 2, 4)), { total: 15.5, tier: 'M' });
  assert.deepEqual(tierFor(nums(2, 3, 2, 1, 1)), { total: 8, tier: 'S' });
});

test('two features with the same scores group on an identical total', () => {
  assert.equal(tierFor(nums(4, 2, 3, 3, 2)).total, tierFor(nums(4, 2, 3, 3, 2)).total);
});

test('the review page inlines the weighted scale, not the old breaks', () => {
  const html = buildScoreHtml(draftFixture());
  assert.ok(html.includes('BANDS'), 'BANDS must be inlined');
  assert.ok(!html.includes('TIER_BREAKS'), 'TIER_BREAKS must be gone');
  assert.ok(html.includes('weightedScore'), 'weightedScore must be inlined');
});

test('the csv carries the weighted total', () => {
  const csv = buildScoreCsv(draftFixture());
  assert.ok(/,13(,|$)/m.test(csv) || /,13\./.test(csv), csv.split('\n').slice(0, 3).join('\n'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/score-review.test.mjs`
Expected: FAIL — `tierFor` is not exported from `pricing.mjs`

- [ ] **Step 3: Add the shim and repoint the three consumers**

Append to `pricing.mjs`:

```javascript
// The score review page re-tiers an edited row in the browser and groups
// rows by identical total, so the total is rounded here rather than at each
// call site — float noise would split two identically scored features into
// separate groups.
export function tierFor(scores) {
  const total = Math.round(weightedScore(scores) * 100) / 100;
  return { total, tier: bandFor(total).tier };
}
```

In `score-html.mjs`, change the extraction list:

```javascript
MATH: inlineModule(extractExports(pricingSrc, ['WEIGHTS', 'BANDS', 'weightedScore', 'bandFor', 'tierFor'])),
```

and point `pricingSrc` at `../lib/pricing.mjs` instead of `estimate-math.mjs`.

In `score-csv.mjs`, change the import from `./estimate-math.mjs` to `./pricing.mjs`. The `tierFor(scoreNumbers(f.scores))` call is unchanged.

In `scores-review-template.html`, the three `tierFor(...)` call sites are unchanged. Update the column header that reads `Σ` to `Score` and add a line to the page's legend stating the score is weighted 20/10/20/30/20, so a reviewer seeing 13 instead of 13 understands why a 4-4-4-4-4 row now reads 20.0 rather than 20.

In `inline.mjs`, update the comment naming the extracted exports.

- [ ] **Step 4: Run the tests and open the review page**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/score-review.test.mjs`
Expected: PASS — 4 new tests.
Then run `node scripts/score-review.mjs` against the booking fixture, open the page, change a score, and confirm the tier and total update in the browser.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/lib/pricing.mjs \
        plugins/solution-architect/skills/estimate/scripts/lib/score-html.mjs \
        plugins/solution-architect/skills/estimate/scripts/lib/score-csv.mjs \
        plugins/solution-architect/skills/estimate/scripts/lib/inline.mjs \
        plugins/solution-architect/skills/estimate/assets/scores-review-template.html \
        plugins/solution-architect/skills/estimate/scripts/test/score-review.test.mjs
git commit -m "refactor(estimate): re-tier the score review path on the weighted scale"
```

---

### Task 4: Inputs schema — context factors in, scenarios out

**Files:**
- Create: `plugins/solution-architect/skills/estimate/scripts/lib/context-schema.mjs`
- Delete: `plugins/solution-architect/skills/estimate/scripts/lib/scenario-schema.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/schema.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/fixtures/booking-inputs.json`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/schema.test.mjs`

**Interfaces:**
- Consumes: `CONTEXT_FACTORS` from Task 2.
- Produces: `checkContext(inputs, out)` in `context-schema.mjs`. `checkInputs` no longer requires `scenarios` or `recommendedScenario`; it requires `contextLevels` at STANDARD/DEEP depth.

- [ ] **Step 1: Write the failing tests**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/schema.test.mjs
import { checkContext } from '../lib/context-schema.mjs';

const base = () => ({
  project: 'x', technique: 't', depth: 'STANDARD', features: [], risks: [],
  assumptions: [], overheadPct: 0, verificationPct: 0.12,
  contextLevels: {
    codebaseMaturity: 2, stackFamiliarity: 1, specQuality: 3, compliance: 1, clientDecisions: 2,
  },
  contextProvenance: {
    codebaseMaturity: { level: 2, anchor: 'young and clean', cite: 'ARCHITECTURE.md §3', source: 'derived' },
    stackFamiliarity: { level: 1, anchor: 'core stack, done before', cite: 'interview', source: 'stated' },
    specQuality: { level: 3, anchor: 'outline or slide deck', cite: 'requirements.json readiness 62', source: 'derived' },
    compliance: { level: 1, anchor: 'none', cite: 'ARCHITECTURE.md §8 no PII', source: 'derived' },
    clientDecisions: { level: 2, anchor: 'two or three', cite: 'requirements.md Part 1', source: 'derived' },
  },
});

test('scenarios are no longer a required top-level key', () => {
  const out = checkInputs(base());
  assert.ok(!out.some((f) => /scenarios|recommendedScenario/.test(f)), out.join('\n'));
});

test('a leftover scenarios key is refused, not ignored', () => {
  const out = checkInputs({ ...base(), scenarios: [{ id: 'a' }] });
  assert.ok(out.some((f) => /scenarios.*removed/i.test(f)), out.join('\n'));
});

test('every context factor is required at STANDARD depth', () => {
  const inputs = base();
  delete inputs.contextLevels.compliance;
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /compliance/.test(f)), out.join('\n'));
});

test('a context level outside 1-4 is refused', () => {
  const inputs = base();
  inputs.contextLevels.compliance = 5;
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /compliance.*1-4/.test(f)), out.join('\n'));
});

test('every context factor carries an anchor, a cite and a source', () => {
  const inputs = base();
  delete inputs.contextProvenance.specQuality.cite;
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /specQuality.*cite/.test(f)), out.join('\n'));
});

test('context source must be derived or stated', () => {
  const inputs = base();
  inputs.contextProvenance.compliance.source = 'guessed';
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /compliance.*derived\|stated/.test(f)), out.join('\n'));
});

test('QUICK depth needs no context factors', () => {
  const inputs = { ...base(), depth: 'QUICK' };
  delete inputs.contextLevels;
  delete inputs.contextProvenance;
  const out = [];
  checkContext(inputs, out);
  assert.deepEqual(out, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/schema.test.mjs`
Expected: FAIL — `Cannot find module '../lib/context-schema.mjs'`

- [ ] **Step 3: Write context-schema.mjs and rewire schema.mjs**

```javascript
// plugins/solution-architect/skills/estimate/scripts/lib/context-schema.mjs
// The five project-wide context factors from Estimator v2's roll-up. Each
// carries its level plus the provenance the score factors already carry, so
// a derived level arrives as a proposal with its evidence attached and can
// be overridden in review — never as a silent default.
import { CONTEXT_FACTORS } from './project-price.mjs';

const SOURCES = ['derived', 'stated'];
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
const FACTORS = Object.keys(CONTEXT_FACTORS);

function checkOne(key, level, prov, out) {
  if (!(Number.isInteger(level) && level >= 1 && level <= 4)) {
    out.push(`contextLevels.${key}: must be an integer 1-4`);
    return;
  }
  if (typeof prov !== 'object' || prov === null) { out.push(`contextProvenance.${key}: required`); return; }
  if (prov.level !== level) out.push(`contextProvenance.${key}: level disagrees with contextLevels`);
  if (!nonEmpty(prov.anchor)) out.push(`contextProvenance.${key}: anchor is required`);
  if (!nonEmpty(prov.cite)) out.push(`contextProvenance.${key}: cite is required`);
  if (!SOURCES.includes(prov.source)) out.push(`contextProvenance.${key}: source must be derived|stated`);
}

export function checkContext(inputs, out) {
  if (inputs.depth === 'QUICK') return;
  const levels = inputs.contextLevels ?? {};
  const prov = inputs.contextProvenance ?? {};
  for (const key of FACTORS) checkOne(key, levels[key], prov[key], out);
}
```

In `schema.mjs`: drop the `checkScenarios` import and call, import `checkContext` instead, remove `'scenarios'` from the required-keys loop, and add the removal guard.

```javascript
import { checkContext } from './context-schema.mjs';
// ... in checkInputs, replacing the checkScenarios call:
  if ('scenarios' in inputs) out.push('"scenarios" was removed — pricing no longer depends on team or rates');
  if ('recommendedScenario' in inputs) out.push('"recommendedScenario" was removed with scenarios');
  checkContext(inputs, out);
```

Change the required-keys loop to `['project', 'technique', 'features', 'risks', 'assumptions']`. Delete `scenario-schema.mjs` and its import.

Update `booking-inputs.json`: delete `scenarios`, `recommendedScenario`, `exposeRatesToClient` and `overheadPct`; add `contextLevels` and `contextProvenance` using the values from the test above.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/schema.test.mjs`
Expected: PASS — 7 new tests, existing schema tests still green except any asserting scenario shape, which get deleted with `scenario-schema.mjs`.

- [ ] **Step 5: Commit**

```bash
git rm plugins/solution-architect/skills/estimate/scripts/lib/scenario-schema.mjs
git add plugins/solution-architect/skills/estimate/scripts/lib/context-schema.mjs \
        plugins/solution-architect/skills/estimate/scripts/lib/schema.mjs \
        plugins/solution-architect/skills/estimate/scripts/test/schema.test.mjs \
        plugins/solution-architect/skills/estimate/scripts/test/fixtures/booking-inputs.json
git commit -m "feat(estimate): replace scenarios with v2 context factors in inputs"
```

---

### Task 5: Rewire the roll-up to produce a price block

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/rollup.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/roadmap.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/compute.test.mjs`

**Interfaces:**
- Consumes: `featurePrice` (Task 1), `projectPrice` (Task 2), `pert`/`roadmapBands` (Task 3), `checkInputs` (Task 4).
- Produces: `computeEstimation(inputs, measurements)` returning `{ inputs, computed }` where `computed` has `tasks`, `features` (each with `hours`, `low`, `high`, `scoreTotal`, `tier`, `point`, `spread`, `priceLow`, `priceHigh`, `flag`), `components`, `roadmap` (top level, `{ milestone, features, share }[]`), `price` (the Task 2 block), `projectConfidence`. No `scenarios`, `devHours`, `overheadHours`, `spreadBufferHours` or `riskBufferHours`.

- [ ] **Step 1: Write the failing test**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/compute.test.mjs
test('computed carries a price block and no scenarios', () => {
  const inputs = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const { computed } = computeEstimation(inputs);
  assert.equal(computed.scenarios, undefined);
  assert.equal(computed.devHours, undefined);
  assert.ok(computed.price.p50 > 0);
  assert.ok(computed.price.presentHigh >= computed.price.presentLow);
  assert.equal(computed.price.presentLow % 500, 0);
});

test('every scored feature carries its price and flag', () => {
  const inputs = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const { computed } = computeEstimation(inputs);
  for (const f of Object.values(computed.features)) {
    assert.ok(Number.isFinite(f.point), 'point');
    assert.ok(Number.isFinite(f.spread), 'spread');
    assert.equal(typeof f.flag, 'string');
    assert.ok(f.priceLow <= f.point && f.point <= f.priceHigh);
  }
});

test('the roadmap is top level and its shares sum to 1', () => {
  const inputs = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const { computed } = computeEstimation(inputs);
  const total = computed.roadmap.reduce((sum, b) => sum + b.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `shares sum to ${total}`);
  assert.equal(computed.roadmap[0].startMonths, undefined);
});

test('repeat runs are byte-identical', () => {
  const inputs = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.equal(
    JSON.stringify(computeEstimation(inputs)),
    JSON.stringify(computeEstimation(JSON.parse(readFileSync(FIXTURE, 'utf8')))),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/compute.test.mjs`
Expected: FAIL — `computed.scenarios` is defined, `computed.price` is undefined

- [ ] **Step 3: Rewrite rollup.mjs**

Delete `taskHoursFor` and `scenarioBlock` entirely. Replace the imports and add a price assembler:

```javascript
import { pert, roadmapBands } from './estimate-math.mjs';
import { featurePrice } from './pricing.mjs';
import { projectPrice } from './project-price.mjs';
import { roadmapFor } from './roadmap.mjs';
import { componentHoursFor } from './components.mjs';
import { agenticTask } from './baselines.mjs';
import { scoreNumbers } from './scoring.mjs';

// Feature rows carry both halves now: hours for planning, price for the
// quote. They come from different inputs and never convert into each other.
function buildFeatures(inputs, tasks) {
  const features = {};
  const summaries = [];
  const priced = [];
  for (const feature of inputs.features) {
    const taskIds = feature.tasks.map((t) => t.id);
    const hours = taskIds.reduce((sum, id) => sum + tasks[id].e, 0);
    const low = taskIds.reduce((sum, id) => sum + tasks[id].o, 0);
    const high = taskIds.reduce((sum, id) => sum + tasks[id].p, 0);
    const row = { hours: round2(hours), low: round2(low), high: round2(high) };
    if (feature.scores) {
      const n = scoreNumbers(feature.scores);
      const p = featurePrice(n);
      Object.assign(row, {
        scoreTotal: round2(p.score), tier: p.tier, point: round2(p.point),
        spread: round2(p.spread), priceLow: round2(p.low), priceHigh: round2(p.high), flag: p.flag,
      });
      priced.push({ point: p.point, spread: p.spread, unc: n.unc, risk: n.risk });
    }
    features[feature.id] = row;
    summaries.push({ hours, taskIds });
  }
  return { features: sortedMap(Object.entries(features)), summaries, priced };
}
```

Then replace `computeEstimation`'s scenario assembly:

```javascript
export function computeEstimation(inputs, measurements) {
  const tasks = isAgentic(inputs) ? buildAgenticTasks(inputs, measurements) : buildTasks(inputs);
  const { features, summaries, priced } = buildFeatures(inputs, tasks);
  const taskHours = Object.fromEntries(Object.entries(tasks).map(([id, t]) => [id, t.e]));
  const roadmap = roadmapFor({ features: inputs.features, taskHours });
  const price = projectPrice({ features: priced, levels: inputs.contextLevels ?? {} });
  return {
    inputs,
    computed: {
      tasks: sortedMap(Object.entries(tasks).map(([id, t]) => [id, taskSummary(t)])),
      features,
      ...(componentHoursFor(inputs, features) ? { components: componentHoursFor(inputs, features) } : {}),
      ...(roadmap ? { roadmap } : {}),
      price: Object.fromEntries(Object.entries(price).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v])),
      projectConfidence: criticalConfidence(summaries, tasks),
    },
  };
}
```

Delete `globalBuffers` and `computedBlock`. In `roadmap.mjs`, drop the `months` parameter and return `share`:

```javascript
export function roadmapFor({ features, taskHours }) {
  const milestones = milestonesFrom(features, taskHours);
  if (!milestones) return undefined;
  return roadmapBands({ milestones }).map((band, i) => ({
    milestone: band.name, features: milestones[i].features, share: round2(band.share),
  }));
}
```

`round2` must be imported into `roadmap.mjs` from `rollup.mjs`, or moved to a shared module if that creates a cycle — move it to `estimate-math.mjs` if so.

- [ ] **Step 4: Run the tests**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/compute.test.mjs plugins/solution-architect/skills/estimate/scripts/test/estimate-math.test.mjs`
Expected: PASS. Then run `node scripts/compute.mjs --inputs scripts/test/fixtures/booking-inputs.json --out /tmp/check.json` from the skill directory and confirm it exits 0 and the output has a `price` block.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/lib/rollup.mjs \
        plugins/solution-architect/skills/estimate/scripts/lib/roadmap.mjs \
        plugins/solution-architect/skills/estimate/scripts/test/compute.test.mjs
git commit -m "feat(estimate): compute a price block instead of scenario costs"
```

---

### Task 6: Document checks — price block replaces the scenario table

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/checks.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/scoring-checks.mjs`
- Modify: `plugins/solution-architect/skills/estimate/references/writing.md`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/validate.test.mjs`

**Interfaces:**
- Consumes: `computed.price`, `computed.roadmap`, `computed.features[].flag` from Task 5.
- Produces: `checkPrice(md, estimation, out)` and `checkDeepEstimates(estimation, out)` exported from `checks.mjs`.

- [ ] **Step 1: Write the failing tests**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/validate.test.mjs
test('the roadmap must say bands are relative shares, not durations', () => {
  const md = '### Roadmap\n\n| Milestone | Share |\n|---|---|\n| M1 | 75% |\n\nBands are relative shares.\n';
  const out = findings({ md, estimation: withMilestones() });
  assert.ok(!out.some((f) => /relative shares/.test(f)), out.join('\n'));
});

test('a roadmap claiming durations is refused', () => {
  const md = '### Roadmap\n\n| Milestone | Months |\n|---|---|\n| M1 | 0.4 |\n\nBands are relative months.\n';
  const out = findings({ md, estimation: withMilestones() });
  assert.ok(out.some((f) => /relative shares/.test(f)), out.join('\n'));
});

test('a scenario comparison table in the md is refused', () => {
  const md = '## Summary\n\n| Scenario | Team | AI-assisted | Months | Cost |\n|---|---|---|---|---|\n';
  const out = findings({ md, estimation: priced() });
  assert.ok(out.some((f) => /scenario table was removed/i.test(f)), out.join('\n'));
});

test('the presented range must appear in the md', () => {
  const out = findings({ md: '## Summary\n\nNo numbers here.\n', estimation: priced() });
  assert.ok(out.some((f) => /presented range/i.test(f)), out.join('\n'));
});

test('a feature flagged for a deep estimate needs a breakdown or a waiver', () => {
  const est = priced();
  const id = Object.keys(est.computed.features)[0];
  est.computed.features[id].flag = 'Deep estimate required';
  est.inputs.features.find((f) => f.id === id).tasks = [];
  const out = [];
  checkDeepEstimates(est, out);
  assert.ok(out.some((f) => new RegExp(id).test(f)), out.join('\n'));
});

test('a waived deep estimate passes', () => {
  const est = priced();
  const id = Object.keys(est.computed.features)[0];
  est.computed.features[id].flag = 'Deep estimate required';
  est.inputs.features.find((f) => f.id === id).deepEstimateWaiver = 'client capped this feature at the band price';
  const out = [];
  checkDeepEstimates(est, out);
  assert.deepEqual(out, []);
});
```

Add `priced()` and `withMilestones()` helpers to the test file that build a minimal estimation object from the booking fixture plus `computeEstimation`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/validate.test.mjs`
Expected: FAIL — `checkDeepEstimates` is not exported

- [ ] **Step 3: Implement the checks**

In `checks.mjs`, change `checkRoadmap`'s prose guard from `/not calendar dates/i` to `/relative shares/i` and update its finding text to `'roadmap must state bands are relative shares, not durations'`. Then add:

```javascript
// The scenario table priced a team; there is no team any more. Leaving it in
// a document would show a cost nothing computed.
const SCENARIO_HEADER = /\|\s*Scenario\s*\|/i;

export function checkPrice(md, estimation, out) {
  if (!estimation.computed.price || estimation.computed.price.p50 === 0) return;
  if (SCENARIO_HEADER.test(md)) out.push('the scenario table was removed — show the price block instead');
  const { presentLow, presentHigh } = estimation.computed.price;
  for (const n of [presentLow, presentHigh]) {
    if (!md.includes(n.toLocaleString('en-US'))) {
      out.push(`presented range bound ${n.toLocaleString('en-US')} missing from the document`);
    }
  }
}

// v2's flag column is the handoff to the deep pass. A flagged feature that
// nobody broke down and nobody waived is the one failure mode this whole
// model has, so it is refused rather than reported.
export function checkDeepEstimates(estimation, out) {
  const byId = new Map((estimation.inputs.features ?? []).map((f) => [f.id, f]));
  for (const [id, row] of Object.entries(estimation.computed.features ?? {})) {
    if (!/^Deep estimate|^SPLIT/.test(row.flag ?? '')) continue;
    const feature = byId.get(id);
    if (feature?.deepEstimateWaiver) continue;
    if (!(feature?.tasks?.length > 0)) {
      out.push(`feature ${id}: flagged "${row.flag}" but has no task breakdown and no deepEstimateWaiver`);
    }
  }
}
```

Wire both into the module's top-level findings function alongside `checkRoadmap`.

In `references/writing.md`, replace the scenario comparison table specification with the price block, and change the roadmap prose requirement:

```markdown
| Figure | Value |
|---|---|
| Presented range | <presentLow> – <presentHigh> |
| If a single number is required | <singleNumber> |
| Contingency rate | <contingencyRate> |
| Implied accuracy | <impliedAccuracy> |

Bands are relative shares of total effort, not durations. This estimate
produces no timeline.
```

- [ ] **Step 4: Run the tests**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/validate.test.mjs`
Expected: PASS — 6 new tests

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/lib/checks.mjs \
        plugins/solution-architect/skills/estimate/scripts/lib/scoring-checks.mjs \
        plugins/solution-architect/skills/estimate/references/writing.md \
        plugins/solution-architect/skills/estimate/scripts/test/validate.test.mjs
git commit -m "feat(estimate): validate the price block and deep-estimate flags"
```

---

### Task 7: Embed the v2 workbook and fill its two new tabs

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/assets/estimate-template.html`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/xlsx-export.test.mjs`
- Reference: `Estimator_v2.xlsx` at the repo root — the source workbook to base64-encode

**Interfaces:**
- Consumes: `computed.features[].{scoreTotal,tier,point,spread,priceLow,priceHigh,flag}` and `computed.price` from Task 5.
- Produces: a seven-tab workbook. Sheet 1 is `Ballpark Estimator` with feature rows at columns A–M and the skill's `MILESTONE`/`CONTAINER`/`WHY THIS TIER` appended at N/O/P. The `Project Roll-up` sheet has its five context level cells (`C11:C15`) filled from `inputs.contextLevels`.

- [ ] **Step 1: Write the failing test**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/xlsx-export.test.mjs
test('the workbook has seven tabs in v2 order', async () => {
  const files = await buildWorkbookFiles();
  const wb = new TextDecoder().decode(files.get('xl/workbook.xml'));
  for (const name of ['How to Use', 'Ballpark Estimator', 'Scoring Guide', 'Tier Reference',
    'Project Roll-up', 'Task Breakdown', 'Score Rationale']) {
    assert.ok(wb.includes(`name="${name}"`), `missing tab ${name}`);
  }
});

test('feature rows keep v2 formulas live and append the skill columns at N-P', async () => {
  const sheet = await sheetXmlFor('sheet2.xml'); // Ballpark Estimator is tab 2 in v2
  assert.ok(/<c r="G7"[^>]*><f>/.test(sheet), 'G7 must stay a formula');
  assert.ok(/<c r="M7"[^>]*><f>/.test(sheet), 'M7 flag must stay a formula');
  assert.ok(/r="N7"/.test(sheet) && /r="P7"/.test(sheet), 'milestone/container/why at N-P');
});

test('the roll-up context cells are filled from inputs', async () => {
  const sheet = await sheetXmlFor('sheet5.xml'); // Project Roll-up
  for (const ref of ['C11', 'C12', 'C13', 'C14', 'C15']) {
    assert.ok(new RegExp(`r="${ref}"[^>]*>(<v>|<is>)`).test(sheet), `${ref} must carry a value`);
  }
});

test('the dimension weights still sum to one in the shipped template', async () => {
  const sheet = await sheetXmlFor('sheet2.xml');
  const weights = ['B5', 'C5', 'D5', 'E5', 'F5']
    .map((ref) => Number(new RegExp(`r="${ref}"[^>]*><v>([\\d.]+)</v>`).exec(sheet)?.[1]));
  assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-9, weights.join(','));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/xlsx-export.test.mjs`
Expected: FAIL — only three template tabs present; `How to Use` and `Project Roll-up` missing

- [ ] **Step 3: Re-embed the template and rewrite the fillers**

Regenerate the base64 constant from the v2 workbook:

```bash
base64 -w0 Estimator_v2.xlsx > /tmp/v2.b64
```

Replace the single-line `const XLSX_TEMPLATE = '...'` in `estimate-template.html` with the new string. Then, in the same file:

- Change `buildSheet1`'s target from `sheet1.xml` to the v2 Ballpark sheet part, and move the appended header cells from `L6`/`M6`/`N6` to `N6`/`O6`/`P6`.
- Change `featureRowXml` to write `sCell` at `N`/`O`/`P` and to leave columns `G`–`M` as the template's own formulas (`rowFormulas` is replaced by re-emitting v2's array formulas per row, not v1's `IF(G<=11,...)` chain).
- Add a `fillRollup(xml, levels)` that writes `inputs.contextLevels` into `C11:C15`. Row order is the sheet's, and it is not alphabetical — transcribe it exactly:

```javascript
// Project Roll-up rows 11-15, in the order the sheet prints them. The cells
// are plain numbers the human can overwrite; every multiplier beside them
// stays a live INDEX formula, so an edited level reprices in the workbook.
const ROLLUP_ROWS = ['codebaseMaturity', 'stackFamiliarity', 'specQuality', 'compliance', 'clientDecisions'];

function fillRollup(xml, levels) {
  return ROLLUP_ROWS.reduce((acc, key, i) => {
    const ref = `C${11 + i}`;
    const level = levels?.[key];
    if (!Number.isInteger(level)) return acc;
    return acc.replace(new RegExp(`<c r="${ref}"[^>]*>.*?</c>`), nCell(ref, XLSX_STYLE.score, level));
  }, xml);
}
```
- `EXTRA_SHEETS` keeps Task Breakdown and Score Rationale, but their `file` values move to `sheet6.xml`/`sheet7.xml` and their `sheetId`s stay unique.
- Update the autofilter reference from `A6:N<n>` to `A6:P<n>` and the `H7:H26` rewrite to the new last row.

- [ ] **Step 4: Run the tests and open the artifact**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/xlsx-export.test.mjs`
Expected: PASS — 4 new tests.
Then render a page from the booking fixture, download the workbook, and open it in a spreadsheet application. Confirm: editing a score on the Ballpark tab re-prices that row, and the Project Roll-up total changes with it. A workbook whose formulas do not recalculate is a failed task even with green tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/assets/estimate-template.html \
        plugins/solution-architect/skills/estimate/scripts/test/xlsx-export.test.mjs
git commit -m "feat(estimate): export the v2 seven-tab workbook"
```

---

### Task 8: Interview, scoring guide and reference docs

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/references/interview.md`
- Modify: `plugins/solution-architect/skills/estimate/references/scoring-guide.md`
- Modify: `plugins/solution-architect/skills/estimate/references/ai-multipliers.md`
- Modify: `plugins/solution-architect/skills/estimate/references/techniques.md`
- Modify: `plugins/solution-architect/skills/estimate/SKILL.md`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/references.test.mjs`

**Interfaces:**
- Consumes: `WEIGHTS` and `BANDS` from Task 1, `CONTEXT_FACTORS` from Task 2.
- Produces: no code interface. The guide's anchor rows remain the single source `loadGuide()` parses, so their labels and five-cell shape must not change.

- [ ] **Step 1: Write the failing test**

```javascript
// replace the tier-break assertions in references.test.mjs
import { WEIGHTS, BANDS } from '../lib/pricing.mjs';
import { CONTEXT_FACTORS } from '../lib/project-price.mjs';

test('the scoring guide states the weight of every factor', () => {
  const doc = readFileSync(new URL('../../references/scoring-guide.md', import.meta.url), 'utf8');
  for (const [key, w] of Object.entries(WEIGHTS)) {
    assert.ok(doc.includes(`${w * 100}%`), `guide never states ${key}'s ${w * 100}% weight`);
  }
});

test('the techniques doc quotes the shipped band edges', () => {
  const doc = readFileSync(new URL('../../references/techniques.md', import.meta.url), 'utf8');
  for (const b of BANDS) {
    assert.ok(doc.includes(`${b.start}`) && doc.includes(b.tier), `band ${b.tier} not documented`);
  }
});

test('the interview asks for stack familiarity and derives the other four', () => {
  const doc = readFileSync(new URL('../../references/interview.md', import.meta.url), 'utf8');
  assert.ok(/stack.*familiar/i.test(doc), 'no stack familiarity question');
  for (const key of Object.keys(CONTEXT_FACTORS)) {
    assert.ok(doc.includes(key), `context factor ${key} never mentioned`);
  }
});

test('the guide still parses into five anchors per factor', async () => {
  const { loadGuide } = await import('../lib/scoring.mjs');
  const guide = loadGuide();
  for (const [k, anchors] of Object.entries(guide)) assert.equal(anchors.length, 5, k);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/references.test.mjs`
Expected: FAIL — the guide states no weights, `techniques.md` still claims `12–17 M`

- [ ] **Step 3: Update the docs**

- `scoring-guide.md`: add the weight to each factor's heading (`Weight 20%`, `Weight 10% — lowest, deliberately`, `Weight 30% — highest`), and append v2's seven scoring-discipline rules. Keep the anchor table rows byte-identical in label and cell count — `loadGuide()` parses them.
- `techniques.md`: replace the `12–17 M` tier claim with the band table from `BANDS`, stating that bands are continuous and interpolated.
- `interview.md`: add a section for the five context factors. Four are derived with their sources named (BA readiness and status; BA layer 8 NFRs plus AR §8 PII column; BA layer 2 deciders and approvers; AR `mode` plus §3, §11, §15). One is asked, as a pick-list seeded with AR §6's tech column. State that standalone mode asks all five. Remove the team-composition and rate questions and the calibration-table question that priced hours.
- `ai-multipliers.md`: keep the category definitions as planning vocabulary; replace the formula, seniority and verification sections with a note that pricing moved to scores and the categories no longer discount anything. Keep the blanket-multiplier reasoning, reframed as why v2 weights size at 10% and uncertainty at 30%.
- `SKILL.md`: rewrite hard rule 4 to match, drop the scenario language from the flow, and add "five context factors — four derived, one asked" to step 3.

- [ ] **Step 4: Run the tests**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/references.test.mjs plugins/solution-architect/skills/estimate/scripts/test/scoring.test.mjs`
Expected: PASS — 4 new tests, `loadGuide` still parses

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/references \
        plugins/solution-architect/skills/estimate/SKILL.md \
        plugins/solution-architect/skills/estimate/scripts/test/references.test.mjs
git commit -m "docs(estimate): document v2 weights, bands and context factors"
```

---

### Task 9: Render the page from the price block

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/scripts/render.mjs`
- Modify: `plugins/solution-architect/skills/estimate/assets/estimate-template.html`
- Modify: `plugins/solution-architect/skills/estimate/scripts/lib/redact.mjs`
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/render.test.mjs`

**Interfaces:**
- Consumes: `computed.price`, `computed.roadmap` from Task 5.
- Produces: a Summary showing the presented range, the single number, contingency rate and implied accuracy; a roadmap drawn from shares. `--client-only` strips the tier bands, the context multiplier working and the overhead percentages, keeping the presented range.

- [ ] **Step 1: Write the failing tests**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/render.test.mjs
test('the summary shows the presented range, not a scenario cost', () => {
  const html = render(fixtureEstimation());
  const { presentLow, presentHigh } = fixtureEstimation().computed.price;
  assert.ok(html.includes(presentLow.toLocaleString('en-US')));
  assert.ok(html.includes(presentHigh.toLocaleString('en-US')));
  assert.ok(!/months/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'no durations anywhere');
});

test('client-only keeps the range and strips the pricing internals', () => {
  const html = render(fixtureEstimation(), { clientOnly: true });
  assert.ok(html.includes(fixtureEstimation().computed.price.presentLow.toLocaleString('en-US')));
  for (const leak of ['contextMultiplier', 'priceLow', 'overheads', 'Tier Reference']) {
    assert.ok(!html.includes(leak), `client view leaks ${leak}`);
  }
});

test('the roadmap renders shares as percentages', () => {
  const html = render(fixtureEstimation());
  assert.ok(/\d+%/.test(html), 'no share percentage rendered');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/render.test.mjs`
Expected: FAIL — the page still reads `computed.scenarios`

- [ ] **Step 3: Update the renderer and template**

Replace the scenario summary block with a price block reading `computed.price`. Replace the roadmap's month axis with share percentages. In `redact.mjs`, change the client-only strip list from rates and the labor/tooling breakdown to `price.contextMultiplier`, `price.overheads`, `price.adjustedBase`, and per-feature `point`/`priceLow`/`priceHigh`/`tier` — keeping `presentLow`, `presentHigh` and `singleNumber`.

- [ ] **Step 4: Run the tests and look at the page**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/render.test.mjs plugins/solution-architect/skills/estimate/scripts/test/browser.test.mjs`
Expected: PASS. Then render from the booking fixture and open the page. Confirm the Summary shows a range, the roadmap shows shares, and no duration appears anywhere.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/render.mjs \
        plugins/solution-architect/skills/estimate/assets/estimate-template.html \
        plugins/solution-architect/skills/estimate/scripts/lib/redact.mjs \
        plugins/solution-architect/skills/estimate/scripts/test/render.test.mjs
git commit -m "feat(estimate): render the price block and share-based roadmap"
```

---

### Task 10: Proposal figures — price from the roll-up, no months, no team

**Files:**
- Modify: `plugins/solution-architect/skills/proposal/scripts/lib/figures.mjs`
- Modify: `plugins/solution-architect/skills/proposal/scripts/lib/checks-client.mjs`
- Modify: `plugins/solution-architect/skills/proposal/scripts/derive.mjs`
- Modify: `plugins/solution-architect/skills/proposal/scripts/test/figures.test.mjs`

**Interfaces:**
- Consumes: `computed.price` and `computed.roadmap` from Task 5.
- Produces: `deriveFigures(estimation) -> { cost: { low, high }, singleNumber, milestones: [{ name, cost: { low, high }, share }] }`. No `scenario` parameter, no `months`, no `team`.

- [ ] **Step 1: Rewrite the figures tests**

`figures.test.mjs` already exists and tests the scenario-based derivation. Delete its existing tests — every one passes a scenario id — and replace the file body with:

```javascript
// plugins/solution-architect/skills/proposal/scripts/test/figures.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveFigures } from '../lib/figures.mjs';

const estimation = () => ({
  inputs: { features: [] },
  computed: {
    price: { presentLow: 43000, presentHigh: 58000, singleNumber: 50500, p50: 42577.08 },
    roadmap: [
      { milestone: 'M1 - Booking core', features: ['booking'], share: 0.75 },
      { milestone: 'M2 - Notifications', features: ['reminders'], share: 0.25 },
    ],
  },
});

test('cost comes from the presented range, not from hour ratios', () => {
  const f = deriveFigures(estimation());
  assert.equal(f.cost.low, 43000);
  assert.equal(f.cost.high, 58000);
  assert.equal(f.singleNumber, 50500);
});

test('no months and no team survive in the figures', () => {
  const f = deriveFigures(estimation());
  assert.equal(f.months, undefined);
  assert.equal(f.team, undefined);
  for (const m of f.milestones) assert.equal(m.months, undefined);
});

test('milestone cost splits follow the roadmap shares', () => {
  const f = deriveFigures(estimation());
  assert.equal(f.milestones[0].cost.low, 32300); // 43000 * 0.75, rounded to 100
  assert.equal(f.milestones[1].cost.low, 10800); // 43000 * 0.25, rounded to 100
});

test('milestone costs sum to within one rounding step of the total', () => {
  const f = deriveFigures(estimation());
  const sum = f.milestones.reduce((s, m) => s + m.cost.high, 0);
  assert.ok(Math.abs(sum - f.cost.high) <= 100 * f.milestones.length, `${sum} vs ${f.cost.high}`);
});

test('an estimate with no roadmap yields no milestones, not a crash', () => {
  const e = estimation();
  delete e.computed.roadmap;
  assert.deepEqual(deriveFigures(e).milestones, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/figures.test.mjs`
Expected: FAIL — `deriveFigures` throws `scenario "undefined" not in estimation.json`

- [ ] **Step 3: Rewrite figures.mjs**

```javascript
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
  const cost = { low: price.presentLow, high: price.presentHigh };
  return {
    cost,
    singleNumber: price.singleNumber,
    milestones: (roadmap ?? []).map((b) => ({
      name: b.milestone, cost: split(cost, b.share), share: b.share,
    })),
  };
}
```

In `checks-client.mjs`: drop `f.months` and the milestone `months` from `flat()`, delete both duration regex loops in `checkMoney`, delete the duration half of `checkHeadline`, and replace `checkLeaks`' scenario-id loop — there are no scenario ids left. Add `singleNumber` to the allowed set. In `derive.mjs`, drop the `--scenario` argument.

- [ ] **Step 4: Run the tests**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/*.test.mjs`
Expected: PASS for `figures.test.mjs`; other proposal tests fail on the Team section until Task 11.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/proposal/scripts/lib/figures.mjs \
        plugins/solution-architect/skills/proposal/scripts/lib/checks-client.mjs \
        plugins/solution-architect/skills/proposal/scripts/derive.mjs \
        plugins/solution-architect/skills/proposal/scripts/test/figures.test.mjs
git commit -m "feat(proposal): derive figures from the estimate price block"
```

---

### Task 11: Proposal document — nine sections, no Duration column

**Files:**
- Modify: `plugins/solution-architect/skills/proposal/scripts/lib/sections.mjs`
- Modify: `plugins/solution-architect/skills/proposal/scripts/lib/checks-doc.mjs`
- Modify: `plugins/solution-architect/skills/proposal/references/writing.md`
- Modify: `plugins/solution-architect/skills/proposal/references/interview.md`
- Modify: `plugins/solution-architect/skills/proposal/SKILL.md`
- Modify: `plugins/solution-architect/skills/proposal/scripts/test/checks-doc.test.mjs`

**Interfaces:**
- Consumes: `deriveFigures` from Task 10.
- Produces: `SECTIONS` as nine names, Team removed. `checkDoc({ fm, md, estimation, today }, out)` keeps its existing signature; `scenario` leaves `FM_KEYS`. `Investment & Timeline` keeps an Investment column and loses Duration.

- [ ] **Step 1: Write the failing tests**

```javascript
// append to plugins/solution-architect/skills/proposal/scripts/test/checks-doc.test.mjs
import { SECTIONS } from '../lib/sections.mjs';

test('the proposal has nine sections and no Team', () => {
  assert.equal(SECTIONS.length, 9);
  assert.ok(!SECTIONS.includes('Team'));
  assert.deepEqual(SECTIONS.slice(0, 3), ['Executive Summary', 'Background & Objectives', 'Proposed Solution']);
});

test('frontmatter no longer requires a scenario', () => {
  const fm = validFm();
  delete fm.scenario;
  const out = checkDoc({ fm, md: fullDoc(), estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(!out.some((f) => /scenario/i.test(f)), out.join('\n'));
});

test('a leftover scenario key in frontmatter is refused', () => {
  const fm = { ...validFm(), scenario: '2eng-max5x' };
  const out = checkDoc({ fm, md: fullDoc(), estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(out.some((f) => /scenario.*removed/i.test(f)), out.join('\n'));
});

test('an Investment table with a Duration column is refused', () => {
  const md = fullDoc().replace(
    '## Investment & Timeline\n\n',
    '## Investment & Timeline\n\n| Milestone | Duration | Investment |\n|---|---|---|\n| M1 | 2 months | $32,300 |\n\n',
  );
  const out = checkDoc({ fm: validFm(), md, estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(out.some((f) => /Duration column/i.test(f)), out.join('\n'));
});

test('a proposal still carrying a Team section is refused', () => {
  const md = `${fullDoc()}\n## Team\n\nTwo senior engineers.\n`;
  const out = checkDoc({ fm: validFm(), md, estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(out.some((f) => /Team section was removed/i.test(f)), out.join('\n'));
});
```

`validFm()`, `fullDoc()` and `pricedEstimation()` are helpers in that test file — update the existing ones so `fullDoc()` emits nine sections and `pricedEstimation()` returns `{ computed: { price: {...}, roadmap: [...] } }` with no `scenarios` key.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/checks-doc.test.mjs`
Expected: FAIL — `SECTIONS.length` is 10, and `checkFrontmatter` throws on `estimation.computed.scenarios[fm.scenario]` because `scenarios` is now undefined

- [ ] **Step 3: Update the sections and checks**

In `sections.mjs`, remove `'Team'` from `SECTIONS` and update the header comment from "the ten sections".

In `checks-doc.mjs`:

- Remove `'scenario'` from `FM_KEYS`.
- Delete the `estimation.computed.scenarios[fm.scenario]` branch in `checkFrontmatter` — it dereferences a key that no longer exists and would throw, not report.
- Add the removal guards and wire them into `checkDoc`:

```javascript
const DURATION_HEADER = /\|\s*Duration\s*\|/i;

// Both of these priced a team. The estimate prices a package now, so a
// document still carrying either is showing a number nothing computed.
function checkRemoved({ fm, md }, out) {
  if ('scenario' in fm) out.push('frontmatter: "scenario" was removed — the estimate has one price');
  if (/^##\s+Team\s*$/m.test(md)) out.push('the Team section was removed — this estimate prices a package, not a staffing plan');
  const investment = sectionText(md, 'Investment & Timeline') ?? '';
  if (DURATION_HEADER.test(investment)) {
    out.push('Investment & Timeline must not carry a Duration column — the estimate produces no timeline');
  }
}

export function checkDoc({ fm, md, estimation, today }, out = []) {
  checkFrontmatter({ fm, estimation, today }, out);
  checkRemoved({ fm, md }, out);
  checkSections(md, out);
  checkPlaceholders(md, out);
  return out;
}
```

The module is now at six functions, inside the ten-function gate.

In `references/writing.md`: change "the ten sections" to "the nine sections", delete the Team entry, remove the Duration column from the §7 milestone table specification, delete the sentence requiring months low/high in the Executive Summary, and change "the cost range, the duration range, and the per-milestone splits" to "the cost range, the single-number figure, and the per-milestone splits". Add one line stating the proposal carries no timeline and why.

In `references/interview.md` and `SKILL.md`: remove the scenario-pick question, the `scenario` frontmatter field, and any reference to `--scenario`.

- [ ] **Step 4: Run the whole suite**

Run: `node --test plugins/*/skills/*/scripts/test/*.test.mjs` from the repo root
Expected: PASS, everything green. This is the first point at which the branch is consistent end to end.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/proposal
git commit -m "feat(proposal): drop the Team section and the duration column"
```

---

### Task 12: End-to-end walkthrough

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/scripts/test/e2e.test.mjs`
- Modify: `plugins/solution-architect/skills/estimate/README.md`
- Modify: `plugins/solution-architect/skills/proposal/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no new interface — a test that runs compute → validate → render → derive on the booking fixture and asserts the numbers agree end to end.

- [ ] **Step 1: Write the failing test**

```javascript
// append to plugins/solution-architect/skills/estimate/scripts/test/e2e.test.mjs
test('the page, the workbook and the proposal quote the same range', async () => {
  const inputs = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const estimation = computeEstimation(inputs);
  const { presentLow, presentHigh } = estimation.computed.price;

  const html = render(estimation);
  assert.ok(html.includes(presentLow.toLocaleString('en-US')), 'page range');

  const { deriveFigures } = await import(
    '../../../proposal/scripts/lib/figures.mjs'
  );
  const figures = deriveFigures(estimation);
  assert.equal(figures.cost.low, presentLow);
  assert.equal(figures.cost.high, presentHigh);
});

test('no duration survives anywhere in the pipeline', () => {
  const inputs = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const json = JSON.stringify(computeEstimation(inputs));
  for (const gone of ['months', 'laborCost', 'toolingCost', 'totalCost', 'seniority', 'rate']) {
    assert.ok(!json.includes(`"${gone}"`), `${gone} still present in estimation.json`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/solution-architect/skills/estimate/scripts/test/e2e.test.mjs`
Expected: FAIL if any earlier task left a stray key — this is the backstop that proves the removal is complete.

- [ ] **Step 3: Fix whatever it catches, then update both READMEs**

`estimate/README.md`: replace "an AI-aware scenario comparison (team composition × AI assistance)" with the score-driven price model, and replace the page description's "recommended team, months, cost, and the committed alternatives" with the presented range, the single number and the milestone shares. State that hours are planning detail and do not set price.

`proposal/README.md`: remove the scenario language and the duration range.

- [ ] **Step 4: Run everything one final time**

Run: `node --test plugins/*/skills/*/scripts/test/*.test.mjs` from the repo root
Expected: PASS, all suites. Then run the three scripts by hand on the booking fixture — compute, validate, render — and confirm each exits 0.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/estimate/scripts/test/e2e.test.mjs \
        plugins/solution-architect/skills/estimate/README.md \
        plugins/solution-architect/skills/proposal/README.md
git commit -m "test(estimate): assert page, workbook and proposal agree"
```
