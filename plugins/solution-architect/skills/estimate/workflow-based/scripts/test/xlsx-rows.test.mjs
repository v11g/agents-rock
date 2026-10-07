import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { computeWorkflowEstimation } from '../lib/rollup.mjs';
import { xlsxRows } from '../lib/xlsx-rows.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));
function rows(editReq) {
  const { inputs, req } = loadPair(fx);
  if (editReq) editReq(req);
  return xlsxRows(computeWorkflowEstimation(inputs, req, []), req);
}

test('one row per feature, grouped by system in requirements order, main builder sets milestone and container', () => {
  const r = rows();
  assert.deepEqual(r.map((x) => [x.id, x.system]), [
    ['FEAT-001', 'Warehouse operations'], ['FEAT-002', 'Warehouse operations'],
    ['FEAT-003', 'Orders & invoicing'], ['FEAT-004', 'Orders & invoicing'], ['FEAT-005', 'Orders & invoicing'],
  ]);
  const f1 = r[0];
  assert.equal(f1.name, 'Order pipeline & stage engine');
  assert.equal(f1.milestone, 'M1 - Walking skeleton');
  assert.equal(f1.container, 'Core API'); // main builder api.stage, parent api
  assert.equal(f1.provenance, 'stated');
  assert.equal(r.find((x) => x.id === 'FEAT-004').provenance, 'proposed'); // BA label "recommended"
  assert.equal(f1.scores.tech.n, 3);
});

test('a feature in no system goes last, with a blank system', () => {
  const r = rows((req) => { req.systems[0].features = ['FEAT-002']; });
  assert.deepEqual(r.map((x) => [x.id, x.system]), [
    ['FEAT-002', 'Warehouse operations'], ['FEAT-003', 'Orders & invoicing'], ['FEAT-004', 'Orders & invoicing'],
    ['FEAT-005', 'Orders & invoicing'], ['FEAT-001', ''],
  ]);
});

test('a feature two systems list gets one row, under the first system', () => {
  const r = rows((req) => { req.systems[1].features = ['FEAT-001', ...req.systems[1].features]; });
  assert.deepEqual(r.filter((x) => x.id === 'FEAT-001').map((x) => x.system), ['Warehouse operations']);
  assert.equal(r.length, 5);
});

test('every task appears once, under the first feature its component builds', () => {
  const r = rows();
  const all = r.flatMap((x) => x.tasks.map((t) => t.name));
  assert.equal(all.length, 8);
  assert.equal(new Set(all).size, 8);
  // office builds FEAT-001, -003, -005 and is no feature's main builder: its task still lands, under FEAT-001
  assert.deepEqual(r[0].tasks.map((t) => t.name), ['Stage transitions with audit', 'Transition tests', 'Orders, quotes and invoicing screens']);
});

test('task hours map to o / m / p and the shape becomes the category', () => {
  const t = rows().find((x) => x.id === 'FEAT-005').tasks.find((x) => x.name === 'Three-way match');
  assert.deepEqual({ o: t.o, m: t.m, p: t.p, category: t.category, confidence: t.confidence },
    { o: 1, m: 2.17, p: 4, category: 'small_implementation', confidence: 'UNCALIBRATED' });
  assert.deepEqual(t.assumptions, []);
});
