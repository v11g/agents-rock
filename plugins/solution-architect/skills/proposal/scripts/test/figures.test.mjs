// plugins/solution-architect/skills/proposal/scripts/test/figures.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('milestone cost splits follow the roadmap shares; the last takes the remainder', () => {
  const f = deriveFigures(estimation());
  assert.equal(f.milestones[0].cost.low, 32300); // 43000 * 0.75, rounded to 100
  assert.equal(f.milestones[1].cost.low, 10700); // 43000 - 32300, not round100(10750) = 10800
});

// R59: the rows above the bold Total line must add up to it exactly, and
// checkMoney refuses any hand-corrected amount, so the figures have to.
const withShares = (shares) => {
  const e = estimation();
  e.computed.roadmap = shares.map((share, i) => ({ milestone: `M${i + 1}`, features: [], share }));
  return e;
};

test('milestone costs sum exactly to the presented range', () => {
  for (const shares of [[0.75, 0.25], [0.33, 0.33, 0.33], [0.17, 0.42, 0.42]]) {
    const f = deriveFigures(withShares(shares));
    for (const bound of ['low', 'high']) {
      const sum = f.milestones.reduce((s, m) => s + m.cost[bound], 0);
      assert.equal(sum, f.cost[bound], `shares ${shares} ${bound}: rows sum to ${sum}`);
    }
  }
});

test('an estimate with no roadmap yields no milestones, not a crash', () => {
  const e = estimation();
  delete e.computed.roadmap;
  assert.deepEqual(deriveFigures(e).milestones, []);
});

// R54: an unpriced estimate (agentic mode / QUICK depth, no scored features)
// must be refused, never quoted at $0.
test('an unpriced estimate (p50 zero) is refused, not quoted at $0', () => {
  const e = estimation();
  e.computed.price = { presentLow: 0, presentHigh: 0, singleNumber: 0, p50: 0 };
  assert.throws(() => deriveFigures(e), /estimate is not priced \(no scored features\)/);
});

test('a missing price block is refused the same way', () => {
  const e = estimation();
  delete e.computed.price;
  assert.throws(() => deriveFigures(e), /estimate is not priced \(no scored features\)/);
});

test('derive.mjs CLI writes the figures file and refuses an unpriced estimate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-derive-'));
  const est = join(dir, 'estimation.json');
  writeFileSync(est, JSON.stringify(estimation()));
  const out = join(dir, 'proposal-figures.json');
  const cli = new URL('../derive.mjs', import.meta.url).pathname;
  execFileSync('node', [cli, '--estimation', est, '--out', out]);
  const written = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(written.cost.low, 43000);
  assert.equal(written.milestones[0].name, 'M1 - Booking core');

  const unpriced = estimation();
  unpriced.computed.price = { presentLow: 0, presentHigh: 0, singleNumber: 0, p50: 0 };
  writeFileSync(est, JSON.stringify(unpriced));
  assert.throws(() => execFileSync('node', [cli, '--estimation', est, '--out', out], { stdio: 'pipe' }));
});
