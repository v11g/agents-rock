import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import {
  TASK_SHAPES, DEFAULT_MEASUREMENTS_PATH, expandHome, resolveMeasurementsPath,
  checkMeasurement, loadMeasurements,
} from '../../../shared/lib/measurements.mjs';

const fixturePath = new URL('./fixtures/measurements.jsonl', import.meta.url).pathname;

test('taxonomy carries the 13 spec shapes', () => {
  assert.equal(TASK_SHAPES.length, 13);
  for (const s of ['cross_file_refactor', 'planning', 'investigation', 'bug_fix']) {
    assert.ok(TASK_SHAPES.includes(s), s);
  }
});

test('expandHome resolves ~/ against the home directory', () => {
  assert.equal(expandHome('~/.agents-rock/m.jsonl'), join(homedir(), '.agents-rock/m.jsonl'));
  assert.equal(expandHome('/abs/path.jsonl'), '/abs/path.jsonl');
});

test('resolveMeasurementsPath prefers inputs override, else global default', () => {
  assert.equal(resolveMeasurementsPath({ measurementsPath: '/x.jsonl' }), '/x.jsonl');
  assert.equal(resolveMeasurementsPath({}), expandHome(DEFAULT_MEASUREMENTS_PATH));
});

test('checkMeasurement: valid record passes, bad fields are errors, unknown shape is a warning', () => {
  const good = { task_shape: 'bug_fix', repository: 'r', agent: 'a', model: 'm', actual_minutes: 5 };
  assert.deepEqual(checkMeasurement(good), { errors: [], warnings: [] });
  const bad = checkMeasurement({ task_shape: 'bug_fix', repository: '', agent: 'a', model: 'm', actual_minutes: 0 });
  assert.equal(bad.errors.length, 2); // repository empty, actual_minutes not positive
  const odd = checkMeasurement({ ...good, task_shape: 'quantum_reticulation' });
  assert.deepEqual(odd.errors, []);
  assert.equal(odd.warnings.length, 1);
});

test('loadMeasurements: missing file is empty, corrupt/invalid lines are skipped with warnings', () => {
  assert.deepEqual(loadMeasurements('/nonexistent/nowhere.jsonl'), { records: [], warnings: [] });
  const dir = mkdtempSync(join(tmpdir(), 'meas-'));
  const p = join(dir, 'm.jsonl');
  writeFileSync(p, `${JSON.stringify({ task_shape: 'bug_fix', repository: 'r', agent: 'a', model: 'm', actual_minutes: 5 })}\nnot json\n${JSON.stringify({ task_shape: 'bug_fix', repository: 'r', agent: 'a', model: 'm', actual_minutes: -1 })}\n`);
  const { records, warnings } = loadMeasurements(p);
  assert.equal(records.length, 1);
  assert.equal(warnings.length, 2);
});

test('the shipped fixture is fully valid', () => {
  const { records, warnings } = loadMeasurements(fixturePath);
  assert.equal(records.length, 20);
  assert.deepEqual(warnings, []);
});
