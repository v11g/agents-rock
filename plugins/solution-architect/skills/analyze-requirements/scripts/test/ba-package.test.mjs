// scripts/test/ba-package.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPackage, baRows, isStated, validateBaCitations } from '../lib/ba-package.mjs';

const PKG = {
  schemaVersion: '1.0', updated: '2026-10-01',
  requirements: [
    { id: 'FR-001', text: 'Members book up to 4 courts per week.', label: 'confirmed', source: 'kickoff call 2026-09-20' },
    { id: 'FR-002', text: 'Members pay a deposit online.', label: 'recommended' },
  ],
  nfrs: [{ id: 'NFR-001', area: 'availability', text: 'The booking page is up 99.95% of the time.', label: 'assumed' }],
  integrations: [{ id: 'INT-001', system: 'Stripe', direction: 'write', label: 'confirmed', source: 'PO brief' }],
  data: [{ id: 'DAT-001', entity: 'Booking', sensitivity: 'personal', volume: 'about 900 per week', label: 'confirmed' }],
  constraints: [{ id: 'CON-001', text: 'Must run in AWS eu-west-1.', source: 'client IT policy' }],
  assumptions: [{ id: 'ASM-001', text: 'Members log in with email.', impact: 'high', status: 'unconfirmed' }],
};
const rows = baRows(PKG);
const byId = (id) => rows.find((r) => r.id === id);

test('isPackage needs schemaVersion and a requirements array', () => {
  assert.equal(isPackage(PKG), true);
  assert.equal(isPackage({ name: 'x' }), false);
  assert.equal(isPackage(null), false);
});

test('baRows reads each section with its fact text and section', () => {
  assert.deepEqual(byId('FR-001'), {
    id: 'FR-001', fact: 'Members book up to 4 courts per week.', label: 'confirmed',
    source: 'kickoff call 2026-09-20', section: 'goals and scope', cite: 'FR-001 · kickoff call 2026-09-20',
  });
  assert.equal(byId('NFR-001').section, 'quality');
  assert.equal(byId('INT-001').fact, 'Stripe (write)');
  assert.equal(byId('DAT-001').fact, 'Booking, personal, about 900 per week');
});

test('a row with no source cites the package date', () => {
  assert.equal(byId('DAT-001').cite, 'DAT-001 · 2026-10-01');
});

test('a constraint with a source and no label counts as confirmed', () => {
  assert.equal(byId('CON-001').label, 'confirmed');
  assert.equal(isStated(byId('CON-001')), true);
});

test('assumptions are never rows; assumed and recommended are not stated', () => {
  assert.equal(byId('ASM-001'), undefined);
  assert.equal(isStated(byId('NFR-001')), false);
  assert.equal(isStated(byId('FR-002')), false);
});

const packages = new Map([['requirements.json', rows]]);
const cite = (label) => ({ label, path: 'requirements.json', quote: null });

test('a citation to a confirmed row passes', () => {
  assert.deepEqual(validateBaCitations({ citations: [cite('FR-001 · kickoff call 2026-09-20')], packages }), []);
});

test('a citation to an unknown id fails', () => {
  assert.deepEqual(validateBaCitations({ citations: [cite('FR-009 · x')], packages }), [
    { check: 'quotes', message: 'FR-009 is not in requirements.json' },
  ]);
});

test('a citation to an assumed row fails with its label', () => {
  assert.deepEqual(validateBaCitations({ citations: [cite('NFR-001 · 2026-10-01')], packages }), [
    { check: 'quotes', message: 'NFR-001 is assumed in requirements.json; only confirmed rows are stated' },
  ]);
});

test('citations to other files are ignored', () => {
  const other = { label: 'C1 · 2026-09-10', path: 'inputs/C1.txt', quote: 'x' };
  assert.deepEqual(validateBaCitations({ citations: [other], packages }), []);
});
