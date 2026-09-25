import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeEstimation } from '../lib/rollup.mjs';

const fixturePath = new URL('./fixtures/booking-inputs.json', import.meta.url).pathname;
const fixture = () => JSON.parse(readFileSync(fixturePath, 'utf8'));
const cli = new URL('../compute.mjs', import.meta.url).pathname;

test('golden numbers for the booking fixture', () => {
  const { computed } = computeEstimation(fixture());
  // pert(16,24,40)=25.33/σ4 · pert(24,40,80)=44/σ9.33 · pert(12,20,36)=21.33/σ4
  assert.equal(computed.tasks['booking-api'].e, 25.33);
  assert.equal(computed.tasks['booking-rules'].e, 44);
  assert.equal(computed.tasks['reminder-jobs'].e, 21.33);
  assert.equal(computed.projectConfidence, 'MED');      // critical path = booking, worst row MED
  const { price } = computed;
  // booking: weighted score 14 (M, point 2541.67) · reminders: score 11 (S, point 1423.08)
  assert.equal(price.featurePoints, 3964.74);
  assert.equal(price.contextMultiplier, 1.4);           // 1 + (.1 + 0 + .2 + 0 + .1) context deviations
  assert.equal(price.adjustedBase, 5550.64);
  assert.equal(price.contingencyRate, 0.15);            // 0.05 + 2.5×0.02 + 2.5×0.02 avg unc/risk
  assert.equal(price.p50, 9957.85);
  assert.equal(price.presentLow, 10000);
  assert.equal(price.presentHigh, 14000);
});

test('price.overheads.amount is rounded before it reaches estimation.json', () => {
  const { computed } = computeEstimation(fixture());
  // adjustedBase 5550.64 × totalPct 0.56 = 3108.3589743589755 unrounded
  assert.equal(computed.price.overheads.amount, 3108.36);
});

test('CLI writes byte-identical output on repeat runs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-'));
  const out = join(dir, 'estimation.json');
  execFileSync('node', [cli, '--inputs', fixturePath, '--out', out]);
  const first = readFileSync(out, 'utf8');
  execFileSync('node', [cli, '--inputs', fixturePath, '--out', out]);
  assert.equal(readFileSync(out, 'utf8'), first);
  assert.deepEqual(JSON.parse(first).inputs, fixture()); // inputs echoed verbatim
});

test('CLI refuses invalid inputs, naming findings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-'));
  const badPath = join(dir, 'bad.json');
  writeFileSync(badPath, JSON.stringify({ ...fixture(), recommendedScenario: 'ghost' }));
  assert.throws(
    () => execFileSync('node', [cli, '--inputs', badPath, '--out', join(dir, 'x.json')], { encoding: 'utf8' }),
    (err) => /recommendedScenario/.test(err.stderr ?? err.stdout ?? String(err)),
  );
});

test('the roadmap is top level when features have milestones', () => {
  const { computed } = computeEstimation(fixture());
  const { roadmap } = computed;
  assert.deepEqual(roadmap.map((b) => b.milestone), ['M1 - Booking core', 'M2 - Notifications']);
  assert.deepEqual(roadmap[0].features, ['booking']);
  assert.deepEqual(roadmap[1].features, ['reminders']);
  // booking (M1) carries most of the task hours
  assert.ok(roadmap[0].share > roadmap[1].share);
  assert.equal(roadmap[0].share, 0.76);
  assert.equal(roadmap[1].share, 0.24);
});

test('computed.components rolls feature hours into top-level containers', () => {
  const { computed } = computeEstimation(fixture());
  // booking (api) 69.33 · reminders (notify.jobs → notify) 21.33 · admin excused, 0
  assert.deepEqual(computed.components, { admin: 0, api: 69.33, notify: 21.33 });
});

test('no roster → no components key at all', () => {
  const bare = fixture();
  delete bare.components;
  for (const f of bare.features) delete f.component;
  const { computed } = computeEstimation(bare);
  assert.ok(!('components' in computed), 'components key must be absent, not empty');
});

test('no milestones → no roadmap key at all', () => {
  const bare = fixture();
  for (const f of bare.features) delete f.milestone;
  const { computed } = computeEstimation(bare);
  assert.ok(!('roadmap' in computed), 'roadmap key must be absent, not empty');
});

// Agentic-mode rollup.
import { loadMeasurements } from '../lib/measurements.mjs';

const agenticInputsPath = new URL('./fixtures/agentic-inputs.json', import.meta.url).pathname;
const measurementsFixture = new URL('./fixtures/measurements.jsonl', import.meta.url).pathname;
function agenticInputs() {
  const inputs = JSON.parse(readFileSync(agenticInputsPath, 'utf8'));
  inputs.measurementsPath = measurementsFixture;
  return inputs;
}
const measurements = () => loadMeasurements(measurementsFixture).records;

test('agentic tasks are baseline-driven', () => {
  const { computed } = computeEstimation(agenticInputs(), measurements());
  const swap = computed.tasks['swap-refactor'];
  assert.equal(swap.samples, 7);
  assert.equal(swap.matchLevel, 1);
  assert.equal(swap.confidence, 'MED');
  assert.equal(swap.calibrated, true);
  assert.equal(swap.minutes, 11);
  assert.ok(Math.abs(swap.e - 13.17 / 60) < 0.01);
  const db = computed.tasks['swap-db'];
  assert.equal(db.confidence, 'UNCALIBRATED');
  assert.equal(db.calibrated, false);
});

test('uncalibrated task taints project confidence', () => {
  const { computed } = computeEstimation(agenticInputs(), measurements());
  assert.equal(computed.projectConfidence, 'UNCALIBRATED'); // swap-db sits on the largest feature
});

test('compute.mjs CLI resolves measurementsPath itself', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentic-'));
  const inPath = join(dir, 'inputs.json');
  const outPath = join(dir, 'estimation.json');
  writeFileSync(inPath, JSON.stringify(agenticInputs()));
  execFileSync('node', [cli, '--inputs', inPath, '--out', outPath]);
  const estimation = JSON.parse(readFileSync(outPath, 'utf8'));
  assert.equal(estimation.computed.tasks['swap-refactor'].samples, 7);
});

test('computed features carry the scores\' total and tier, copied not derived', () => {
  const { computed } = computeEstimation(fixture());
  assert.equal(computed.features.booking.scoreTotal, 14);
  assert.equal(computed.features.booking.tier, 'M');
  assert.equal(computed.features.reminders.scoreTotal, 11);
  assert.equal(computed.features.reminders.tier, 'S');
  // hours are untouched by scoring
  assert.equal(computed.features.booking.hours, 69.33);
});

test('QUICK inputs get no score fields in computed features', () => {
  const quick = fixture();
  quick.depth = 'QUICK';
  for (const f of quick.features) { delete f.scores; delete f.scoreNote; delete f.scoreProvenance; }
  const { computed } = computeEstimation(quick);
  assert.equal('tier' in computed.features.booking, false);
  assert.equal('scoreTotal' in computed.features.booking, false);
});

test('computed carries a price block and no scenarios', () => {
  const { computed } = computeEstimation(fixture());
  assert.equal(computed.scenarios, undefined);
  assert.equal(computed.devHours, undefined);
  assert.ok(computed.price.p50 > 0);
  assert.ok(computed.price.presentHigh >= computed.price.presentLow);
  assert.equal(computed.price.presentLow % 500, 0);
});

test('every scored feature carries its price and flag', () => {
  const { computed } = computeEstimation(fixture());
  for (const f of Object.values(computed.features)) {
    assert.ok(Number.isFinite(f.point), 'point');
    assert.ok(Number.isFinite(f.spread), 'spread');
    assert.equal(typeof f.flag, 'string');
    assert.ok(f.priceLow <= f.point && f.point <= f.priceHigh);
  }
});

test('the roadmap is top level and its shares sum to 1', () => {
  const { computed } = computeEstimation(fixture());
  const total = computed.roadmap.reduce((sum, b) => sum + b.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `shares sum to ${total}`);
  assert.equal(computed.roadmap[0].startMonths, undefined);
});

test('repeat runs are byte-identical', () => {
  assert.equal(
    JSON.stringify(computeEstimation(fixture())),
    JSON.stringify(computeEstimation(fixture())),
  );
});
