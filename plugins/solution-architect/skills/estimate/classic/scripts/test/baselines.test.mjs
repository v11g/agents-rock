import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMeasurements } from '../../../shared/lib/measurements.mjs';
import { percentile, matchBaseline, confidenceFor } from '../../../shared/lib/baselines.mjs';

const fixturePath = new URL('./fixtures/measurements.jsonl', import.meta.url).pathname;
const records = () => loadMeasurements(fixturePath).records;
const CTX = { agent: 'claude-code', model: 'sonnet', repository: 'project-a' };
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} !~ ${b}`);

test('percentile interpolates linearly', () => {
  const v = [6, 8, 9, 11, 12, 19, 34];
  near(percentile(v, 0.5), 11);
  near(percentile(v, 0.8), 17.6);   // pos 4.8 → 12 + 0.8·(19−12)
  near(percentile(v, 0.95), 29.5);  // pos 5.7 → 19 + 0.7·(34−19)
});

test('rung 1: exact repo+agent+model match wins', () => {
  const stats = matchBaseline(
    { shape: 'cross_file_refactor', scope: { affectedFiles: 8 } },
    { records: records(), agentContext: CTX },
  );
  assert.equal(stats.matchLevel, 1);
  assert.equal(stats.samples, 7);
  near(stats.p50, 11);
  assert.equal(stats.evidence.length, 7);
  assert.deepEqual(stats.evidence[0], { id: 'm01', description: 'Refactor A', minutes: 6 });
});

test('rung 2: different repo falls through to shape+agent', () => {
  const stats = matchBaseline(
    { shape: 'cross_file_refactor', scope: { affectedFiles: 8 } },
    { records: records(), agentContext: { ...CTX, repository: 'other-repo' } },
  );
  assert.equal(stats.matchLevel, 2);
  assert.equal(stats.samples, 7);
});

test('per-task model override matches its own history', () => {
  const stats = matchBaseline(
    { shape: 'planning', scope: {}, model: 'opus' },
    { records: records(), agentContext: { agent: 'claude-code', model: 'sonnet', repository: 'project-b' } },
  );
  assert.equal(stats.samples, 2);   // rung 4: only 2 planning records exist
  assert.equal(stats.matchLevel, 4);
});

test('rung 3: similar scope (±50% affected files) when agent differs', () => {
  const stats = matchBaseline(
    { shape: 'configuration', scope: { affectedFiles: 1 } },
    { records: [...records(), ...records(), ...records()].filter((r) => r.task_shape === 'configuration'),
      agentContext: { agent: 'claude-code', model: 'sonnet', repository: 'project-a' } },
  );
  // 3 copies of the cursor config record: rung 2 fails (agent cursor), rung 3 matches on scope
  assert.equal(stats.matchLevel, 3);
  assert.equal(stats.samples, 3);
});

test('no match at any rung is UNCALIBRATED', () => {
  const stats = matchBaseline(
    { shape: 'database_change', scope: { affectedFiles: 2 } },
    { records: records(), agentContext: CTX },
  );
  assert.deepEqual(stats, { samples: 0, matchLevel: 0, evidence: [] });
  assert.equal(confidenceFor(stats), 'UNCALIBRATED');
});

test('confidence tiers follow the spec table', () => {
  assert.equal(confidenceFor({ samples: 0 }), 'UNCALIBRATED');
  assert.equal(confidenceFor({ samples: 2, p50: 10, p80: 11 }), 'LOW');
  assert.equal(confidenceFor({ samples: 7, p50: 11, p80: 17.6 }), 'MED');
  assert.equal(confidenceFor({ samples: 10, p50: 10, p80: 11.2 }), 'HIGH');
  assert.equal(confidenceFor({ samples: 10, p50: 10, p80: 25 }), 'MED'); // high variance demotes
});

// Task 3 appends: duration math.
import { agenticTask } from '../../../shared/lib/baselines.mjs';

test('n>=5: lognormal fit — mean above median, spread from log-space z', () => {
  const a = agenticTask(
    { shape: 'cross_file_refactor', scope: { affectedFiles: 8 }, seedMinutes: { o: 10, m: 20, p: 45 } },
    { records: records(), agentContext: CTX },
  );
  // p50=11, p95=29.5 → σ_log=ln(29.5/11)/1.645≈0.5997
  // e = 11·exp(σ_log²/2) ≈ 13.17 min; σ = e·√(exp(σ_log²)−1) ≈ 8.66 min
  near(a.e, 13.17 / 60);
  near(a.sigma, 8.66 / 60);
  near(a.lowH, 11 / 60);
  near(a.highH, 29.5 / 60);
  assert.equal(a.calibrated, true);
  assert.equal(a.confidence, 'MED');
  near(a.minutes, 11);
});

test('1<=n<5: median of matches + seed-derived sigma', () => {
  const a = agenticTask(
    { shape: 'planning', scope: {}, model: 'opus', seedMinutes: { o: 20, m: 40, p: 80 } },
    { records: records(), agentContext: { agent: 'claude-code', model: 'sonnet', repository: 'project-b' } },
  );
  near(a.e, 47.5 / 60);          // median of [40, 55]
  near(a.sigma, (80 - 20) / 6 / 60);
  near(a.lowH, 40 / 60);         // small samples: bounds are min/max of matches
  near(a.highH, 55 / 60);
  assert.equal(a.confidence, 'LOW');
  assert.equal(a.calibrated, true);
});

test('n=0: seed pert, uncalibrated', () => {
  const a = agenticTask(
    { shape: 'database_change', scope: {}, seedMinutes: { o: 10, m: 20, p: 40 } },
    { records: records(), agentContext: CTX },
  );
  near(a.e, ((10 + 80 + 40) / 6) / 60);   // pert e = 21.67 min
  near(a.sigma, (30 / 6) / 60);
  near(a.lowH, 10 / 60);
  near(a.highH, 40 / 60);
  assert.equal(a.calibrated, false);
  assert.equal(a.confidence, 'UNCALIBRATED');
  assert.equal(a.minutes, null);
});
