import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateElections } from '../lib/validate-elections.mjs';

const full = [
  { name: 'threat-model', elected: true },
  { name: 'interface-contract', elected: true },
  { name: 'estimation', elected: false, reason: 'user declined estimates' },
  { name: 'domain-overview', elected: false, reason: 'thin domain: CLI wrapper' },
  { name: 'validation-plan', elected: false, reason: 'no critical claims to check yet' },
];

test('passes a complete election record', () => {
  assert.deepEqual(validateElections({ frontmatter: { electedDocs: full } }), []);
});

test('fails when a companion has no record', () => {
  const findings = validateElections({ frontmatter: { electedDocs: full.slice(0, 3) } });
  assert.match(findings[0].message, /domain-overview/);
});

test('fails un-elected entry without reason', () => {
  const docs = [...full.slice(0, 3), { name: 'domain-overview', elected: false }];
  const findings = validateElections({ frontmatter: { electedDocs: docs } });
  assert.match(findings[0].message, /reason/);
});

test('fails when electedDocs missing entirely', () => {
  const findings = validateElections({ frontmatter: {} });
  assert.equal(findings.length, 1);
});

// A set that never considered whether its claims get checked should say so, the
// same way it says so about a threat model it did not write.
test('validation-plan is a companion that must be elected or refused', () => {
  const without = full.filter((d) => d.name !== 'validation-plan');
  const findings = validateElections({ frontmatter: { electedDocs: without } });
  assert.match(findings[0].message, /validation-plan/);
});
