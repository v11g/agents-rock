import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { mainBuilder, computeWorkflowEstimation } from '../lib/rollup.mjs';
import { featurePrice } from '../../../shared/lib/pricing.mjs';
import { projectPrice } from '../../../shared/lib/project-price.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));

test('mainBuilder: fewest builds wins; earliest milestone on a tie; undefined when nobody builds it', () => {
  const comps = [
    { id: 'a', milestone: 'M2 - Later', builds: [{ feature: 'F1' }] },
    { id: 'b', milestone: 'M1 - First', builds: [{ feature: 'F1' }] },
    { id: 'c', milestone: 'M1 - First', builds: [{ feature: 'F1' }, { feature: 'F2' }] },
  ];
  assert.equal(mainBuilder('F1', comps).id, 'b');
  assert.equal(mainBuilder('F2', comps).id, 'c');
  assert.equal(mainBuilder('F9', comps), undefined);
});

test('mainBuilder: M2 sorts before M10 on a tie', () => {
  const comps = [
    { id: 'late', milestone: 'M10 - Later', builds: [{ feature: 'F1' }] },
    { id: 'early', milestone: 'M2 - Earlier', builds: [{ feature: 'F1' }] },
  ];
  assert.equal(mainBuilder('F1', comps).id, 'early');
});

test('feature rows carry name, system, derived milestone, builders and the price', () => {
  const { inputs, req } = loadPair(fx);
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  const f1 = computed.features['FEAT-001'];
  assert.equal(f1.name, 'Order pipeline & stage engine');
  assert.equal(f1.system, 'Warehouse operations');
  assert.equal(f1.milestone, 'M1 - Walking skeleton'); // api.stage (2 builds) beats office (3)
  assert.deepEqual(f1.builtBy, ['api.stage', 'office']);
  assert.equal(computed.features['FEAT-004'].milestone, 'M3 - Operations');
  assert.equal(computed.features['FEAT-004'].provenance, 'proposed'); // BA label: recommended
  assert.equal(computed.features['FEAT-005'].provenance, 'stated');
  const p = featurePrice({ tech: 3, size: 3, deps: 2, unc: 3, risk: 3 });
  assert.equal(f1.point, Math.round(p.point * 100) / 100);
});

test('a feature built only by milestone-less components gets milestone null', () => {
  const { inputs, req } = loadPair(fx);
  for (const c of inputs.components) delete c.milestone;
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  assert.equal(computed.features['FEAT-001'].milestone, null);
});

test('component rows sum agentic hours and list what they build', () => {
  const { inputs, req } = loadPair(fx);
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  const billing = computed.components['api.billing'];
  assert.deepEqual(billing.builds, ['FEAT-005']);
  assert.equal(billing.container, 'api');
  assert.ok(billing.hours > 0 && billing.low <= billing.hours && billing.hours <= billing.high);
  assert.deepEqual(Object.keys(billing.tasks), ['billing-docs', 'billing-match']);
  assert.equal(computed.components.ops.hours, 0);
});

test('price equals the shared project roll-up over the same five features', () => {
  const { inputs, req } = loadPair(fx);
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  const priced = inputs.features.map(() => { const p = featurePrice({ tech: 3, size: 3, deps: 2, unc: 3, risk: 3 }); return { point: p.point, spread: p.spread, unc: 3, risk: 3 }; });
  const want = projectPrice({ features: priced, levels: inputs.contextLevels });
  assert.equal(computed.price.presentLow, Math.round(want.presentLow * 100) / 100);
  assert.equal(computed.price.presentHigh, Math.round(want.presentHigh * 100) / 100);
  assert.equal(computed.price.singleNumber, Math.round(want.singleNumber * 100) / 100);
  assert.equal(Object.keys(computed.features).length, 5);
});
