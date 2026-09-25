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
  const f = featurePrice(s(5, 5, 5, 3, 3));
  assert.ok(f.point >= 6000, `expected >= 6000, got ${f.point}`);
  assert.equal(f.flag, 'Deep estimate recommended');
});
