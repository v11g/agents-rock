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

// "we invented this to keep moving" and "we recommend this" are different claims.
// drivers.md fires a blocker on the first and not the second, so the vocabulary
// has to keep them apart.
test('accepts assumed as distinct from proposed', () => {
  const t = { section: 'Quality Requirements', headers: ['A', 'src'], rows: [['p99', 'assumed']] };
  assert.deepEqual(validateProvenance({ tables: [t] }), []);
});
