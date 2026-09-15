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
  assert.equal(computed.devHours, 90.67);               // round2(152/6 + 44 + 128/6)
  assert.equal(computed.overheadHours, 31.73);          // round2(90.6667 × 0.35)
  assert.equal(computed.spreadBufferHours, 10.91);      // round2(√(4² + 9.3333² + 4²))
  assert.equal(computed.riskBufferHours, 12);           // 0.3 × 40
  assert.equal(computed.projectConfidence, 'MED');      // critical path = booking, worst row MED
  const rec = computed.scenarios['2eng-max5x'];
  assert.ok(rec.months > 0 && rec.totalCost > 0);
  assert.equal(rec.totalCost, rec.laborCost + rec.toolingCost);
  assert.equal('planCost' in rec, false);
  // Same team math as before the plan→aiAssisted rename: hours and seat cost pinned
  assert.equal(computed.scenarios['3eng-noai'].hours, 145.31);
  assert.equal(rec.hours, 101.35);
  assert.equal(rec.toolingCost, 80.44);                 // 0.4022 mo × $100 × 2 seats
  // AI hours strictly below traditional on every task in an AI scenario
  for (const id of Object.keys(computed.tasks)) {
    assert.ok(rec.taskHours[id] < computed.tasks[id].e);
  }
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

test('scenarios carry a roadmap when features have milestones', () => {
  const { computed } = computeEstimation(fixture());
  const roadmap = computed.scenarios['2eng-max5x'].roadmap;
  assert.deepEqual(roadmap.map((b) => b.milestone), ['M1 - Booking core', 'M2 - Notifications']);
  assert.deepEqual(roadmap[0].features, ['booking']);
  assert.deepEqual(roadmap[1].features, ['reminders']);
  assert.equal(roadmap[0].startMonths, 0);
  assert.equal(roadmap[1].startMonths, roadmap[0].endMonths); // bands tile, no gap
  assert.equal(roadmap[1].endMonths, computed.scenarios['2eng-max5x'].months);
  // AI-adjusted shares: booking (M1) carries most of the hours
  assert.ok(roadmap[0].endMonths - roadmap[0].startMonths
    > roadmap[1].endMonths - roadmap[1].startMonths);
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
  for (const s of Object.values(computed.scenarios)) {
    assert.ok(!('roadmap' in s), 'roadmap key must be absent, not empty');
  }
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

test('agentic tasks are baseline-driven and scenario-independent', () => {
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
  // measured durations do not vary by team or plan
  assert.deepEqual(computed.scenarios.solo.taskHours, computed.scenarios.pair.taskHours);
});

test('agentic risks convert minutes to hours; uncalibrated task taints project confidence', () => {
  const { computed } = computeEstimation(agenticInputs(), measurements());
  assert.equal(computed.riskBufferHours, Math.round((0.3 * 30 / 60) * 100) / 100);
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
