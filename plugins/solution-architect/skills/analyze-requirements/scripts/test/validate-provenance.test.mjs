import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProvenance } from '../lib/validate-provenance.mjs';

const ok = { section: 'Core Components', headers: ['C', 'src'], rows: [['api', 'observed']] };
const badValue = { section: 'Data Stores', headers: ['S', 'src'], rows: [['pg', 'guessed']] };
const noColumn = { section: 'External Integrations', headers: ['System'], rows: [['stripe']] };
const generated = { section: 'Decisions', headers: ['ADR'], rows: [['0001']] };

test('passes valid tables and exempts generated sections', () => {
  assert.deepEqual(validateProvenance({ tables: [ok, generated] }), []);
});

test('fails a row with an unknown src value', () => {
  const findings = validateProvenance({ tables: [badValue] });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /guessed/);
});

test('fails a table missing the src column', () => {
  const findings = validateProvenance({ tables: [noColumn] });
  assert.match(findings[0].message, /src column/);
});

test('accepts researched with a source suffix', () => {
  const t = { section: 'X', headers: ['A', 'src'], rows: [['a', 'researched [stripe docs]']] };
  assert.deepEqual(validateProvenance({ tables: [t] }), []);
});

test('warns, never fails, on a stated row with no citation', () => {
  const t = { section: 'Constraints', headers: ['C', 'src'], rows: [['azure', 'stated']] };
  const out = validateProvenance({ tables: [t] });
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'warn');
  assert.match(out[0].message, /"Constraints" row "azure": stated has no citation/);
});

test('accepts a cited stated row, with or without a quote', () => {
  const t = {
    section: 'Constraints', headers: ['C', 'src'],
    rows: [
      ['azure', 'stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "it has to run there"'],
      ['owner', 'stated [Q2 · 2026-10-14](interview-log.md#q2)'],
    ],
  };
  assert.deepEqual(validateProvenance({ tables: [t] }), []);
});
