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
