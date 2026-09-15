import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { deriveFigures, formatMoney } from '../lib/figures.mjs';

// Hand-checkable synthetic estimation: spread ratios are lo 0.8 / hi 1.2.
const estimation = {
  inputs: {
    scenarios: [{
      id: 's1', aiAssisted: true, toolingCostPerSeat: 100,
      team: [{ seniority: 'senior', rate: 50 }, { seniority: 'mid', rate: 40 }],
    }],
  },
  computed: {
    features: {
      a: { hours: 100, low: 80, high: 120 },
      b: { hours: 100, low: 80, high: 120 },
    },
    scenarios: {
      s1: {
        months: 2, totalCost: 10000,
        roadmap: [
          { milestone: 'M1', startMonths: 0, endMonths: 1.5 },
          { milestone: 'M2', startMonths: 1.5, endMonths: 2 },
        ],
      },
    },
  },
};

test('figures scale totals by the feature spread ratios', () => {
  const f = deriveFigures(estimation, 's1');
  assert.deepEqual(f.cost, { low: 8000, high: 12000 });
  assert.deepEqual(f.months, { low: 1.6, high: 2.4 });
});

test('milestone splits follow the roadmap band shares', () => {
  const f = deriveFigures(estimation, 's1');
  assert.deepEqual(f.milestones, [
    { name: 'M1', cost: { low: 6000, high: 9000 }, months: { low: 1.2, high: 1.8 } },
    { name: 'M2', cost: { low: 2000, high: 3000 }, months: { low: 0.4, high: 0.6 } },
  ]);
});

test('team lists seniorities only — rates never leave the estimate', () => {
  const f = deriveFigures(estimation, 's1');
  assert.deepEqual(f.team, ['senior', 'mid']);
  assert.doesNotMatch(JSON.stringify(f), /rate|50|40/);
});

test('no roadmap means no milestones, not a crash', () => {
  const noRoadmap = structuredClone(estimation);
  delete noRoadmap.computed.scenarios.s1.roadmap;
  assert.deepEqual(deriveFigures(noRoadmap, 's1').milestones, []);
});

test('unknown scenario throws with the id in the message', () => {
  assert.throws(() => deriveFigures(estimation, 'nope'), /scenario "nope" not in estimation\.json/);
});

test('formatMoney uses en-US grouping with a dollar sign', () => {
  assert.equal(formatMoney(8000), '$8,000');
  assert.equal(formatMoney(1234500), '$1,234,500');
});

test('derive.mjs CLI writes the figures file and refuses unknown scenarios', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-derive-'));
  const est = join(dir, 'estimation.json');
  writeFileSync(est, JSON.stringify(estimation));
  const out = join(dir, 'proposal-figures.json');
  const cli = new URL('../derive.mjs', import.meta.url).pathname;
  execFileSync('node', [cli, '--estimation', est, '--scenario', 's1', '--out', out]);
  const written = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(written.cost.low, 8000);
  assert.equal(written.milestones[0].name, 'M1');
  assert.throws(() => execFileSync('node', [cli, '--estimation', est, '--scenario', 'nope', '--out', out]));
});
