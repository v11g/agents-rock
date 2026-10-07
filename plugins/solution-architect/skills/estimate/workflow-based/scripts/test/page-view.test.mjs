import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { computeWorkflowEstimation } from '../lib/rollup.mjs';
import { priceView, milestoneView, registerView } from '../lib/page-view.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));
function estimate(mutate) {
  const { inputs, req } = loadPair(fx);
  if (mutate) mutate(inputs, req);
  return { est: computeWorkflowEstimation(inputs, req, []), req };
}

test('priceView: the computed price, five context rows, eight overhead lines, effort', () => {
  const { est } = estimate();
  const v = priceView(est);
  assert.equal(v.price.presentLow, est.computed.price.presentLow);
  assert.equal(v.featureCount, 5);
  assert.deepEqual(v.context.map((c) => c.key), ['codebaseMaturity', 'stackFamiliarity', 'specQuality', 'compliance', 'clientDecisions']);
  assert.deepEqual(v.context[2], { key: 'specQuality', label: 'Specification quality', level: 3, anchor: 'Outline or slide deck', multiplier: 1.2 });
  assert.equal(v.overheads.length, 8);
  assert.equal(v.overheads.at(-1).label, 'Cross-feature integration');
  assert.deepEqual({ components: v.effort.components, tasks: v.effort.tasks }, { components: 6, tasks: 8 });
  assert.equal(v.avgUnc, 3);
});

test('priceView: no tasks anywhere → zero hours and no implied rate', () => {
  const { est } = estimate((i) => { for (const c of i.components) c.tasks = []; });
  assert.equal(priceView(est).effort.hours, 0);
  assert.equal(priceView(est).effort.rate, null);
});

test('milestoneView: features land with their main builder, in milestone order', () => {
  const { est } = estimate();
  const ms = milestoneView(est);
  assert.deepEqual(ms.map((m) => m.name), ['M1 - Walking skeleton', 'M2 - Money', 'M3 - Operations']);
  assert.deepEqual(ms.map((m) => m.features.map((f) => f.id)), [['FEAT-001', 'FEAT-003'], ['FEAT-002', 'FEAT-005'], ['FEAT-004']]);
  assert.equal(ms[0].title, '1. Walking skeleton');
  assert.ok(Math.abs(ms.reduce((n, m) => n + m.share, 0) - 1) < 0.02);
  assert.ok(ms[2].low > 0 && ms[2].low < ms[2].high && ms[2].high < est.computed.price.presentHigh);
});

test('registerView: assumptions as text; exclusions = scope.out then inputs.exclusions', () => {
  const { est, req } = estimate();
  const r = registerView(est, req);
  assert.equal(r.assumptions.length, 2);
  assert.deepEqual(r.exclusions, ['last-mile delivery tracking', 'Hosting and third-party subscription fees']);
});

test('registerView: no scope.out and no exclusions → empty list', () => {
  const { est, req } = estimate((i, r) => { delete i.exclusions; delete r.raw.scope; });
  assert.deepEqual(registerView(est, req).exclusions, []);
});
