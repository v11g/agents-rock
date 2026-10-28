import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { computeWorkflowEstimation } from '../lib/rollup.mjs';
import { taskTable } from '../lib/page-html.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));

test('each task row carries the features it serves, 7th', () => {
  const { inputs, req } = loadPair(fx);
  const out = taskTable(computeWorkflowEstimation(inputs, req, []));
  assert.deepEqual(out['api.stage'].map((x) => x[6]), [['FEAT-001', 'FEAT-002'], ['FEAT-001']]);
});
