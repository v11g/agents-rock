// The pre-fed eval fixtures feed `claude plugin eval` a finished estimate.
// If they drift from the current estimate model, every eval scores correct
// behaviour as failure. Pin them: each recomputes to its stored numbers,
// derives a price, and the figures its eval asserts are the ones derived.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkInputs } from '../../../estimate/classic/scripts/lib/schema.mjs';
import { computeEstimation } from '../../../estimate/classic/scripts/lib/rollup.mjs';
import { deriveFigures } from '../lib/figures.mjs';

const evalsDir = new URL('../../evals/', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, evalsDir), 'utf8'));
const evals = read('evals.json').evals;
const PRE_FED = { 1: 'pre-fed-harborline-dispatch', 2: 'pre-fed-meridian-dental' };

const flat = (f) => [f.cost.low, f.cost.high, f.singleNumber,
  ...f.milestones.flatMap((m) => [m.cost.low, m.cost.high])];

for (const [id, dir] of Object.entries(PRE_FED)) {
  test(`${dir}: v2 inputs, stored numbers recompute, figures match the eval`, () => {
    const inputs = read(`fixtures/${dir}/estimation-inputs.json`);
    assert.deepEqual(checkInputs(inputs), []);
    const stored = read(`fixtures/${dir}/estimation.json`);
    assert.deepEqual(computeEstimation(stored.inputs).computed, stored.computed);
    assert.deepEqual(stored.inputs, inputs, 'estimation.json was computed from other inputs');
    const figures = deriveFigures(stored);
    const traced = evals.find((e) => e.id === Number(id)).assertions
      .find((a) => a.startsWith('every-number-traces-upstream'));
    const listed = JSON.parse(`[${/\{([\d, ]+)\}/.exec(traced)[1]}]`);
    assert.deepEqual([...listed].sort((a, b) => a - b), flat(figures).sort((a, b) => a - b));
  });
}

test('the unpriced fixture really is unpriced, so the proposal refuses it', () => {
  const stored = read('fixtures/gate-check-unpriced-harborline/estimation.json');
  assert.deepEqual(computeEstimation(stored.inputs).computed, stored.computed);
  assert.throws(() => deriveFigures(stored), /not priced/);
});
