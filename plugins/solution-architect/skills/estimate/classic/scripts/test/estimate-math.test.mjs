import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pert, roadmapBands, AI_CATEGORIES } from '../../../shared/lib/estimate-math.mjs';

const close = (got, want) => assert.ok(Math.abs(got - want) < 1e-9, `${got} !~ ${want}`);

test('pert: E=(O+4M+P)/6, sigma=(P-O)/6', () => {
  const { e, sigma } = pert({ o: 16, m: 24, p: 40 });
  close(e, 152 / 6);
  close(sigma, 4);
});

test('the hours-to-money machinery is gone', async () => {
  const mod = await import('../../../shared/lib/estimate-math.mjs');
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
  const { scoreSummary } = await import('../../../shared/lib/scoring.mjs');
  const scores = Object.fromEntries(['tech', 'size', 'deps', 'unc', 'risk']
    .map((k, i) => [k, { n: [1, 3, 3, 3, 3][i], anchor: '', cite: 'x' }]));
  const got = scoreSummary({ scores });
  close(got.scoreTotal, 13);
  assert.equal(got.tier, 'M');
});
