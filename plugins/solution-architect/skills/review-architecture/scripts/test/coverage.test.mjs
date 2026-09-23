import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionTable, firstTable } from '../lib/tables.mjs';
import { mustRows, designCoverage, validationCoverage, evidenceCoverage, traceability, ratio, notes }
  from '../lib/coverage.mjs';

const ARCH = `---
name: atlas
---

## 12 Security

| threat | src |
|---|---|
| spoofing | stated |

## 13 Quality Requirements & SLOs

| scenario | measure | target | priority | src |
|---|---|---|---|---|
| checkout submit at peak, 400 carts | p99 end-to-end | 200 ms | must | stated |
| worker killed mid-job | recovery time | 30 s | must | assumed |
| admin report export | render time | 4 s | should | proposed |

## 14 Decisions
`;

// Titled the way a real one is. Looking the table up by an exact "Validation
// plan" heading reported an empty plan for a document full of rows, which read
// as nothing-to-check rather than as a reader that could not find it.
const PLAN = `# Northwind Dispatch — Validation plan

One row per claim that would change the design if it turned out false.

| claim | method | condition | threshold | status | src |
|---|---|---|---|---|---|
| p99 end-to-end under peak | load test | staging | 200 ms | planned | stated |
| recovery time after kill | fault injection | one worker | 30 s | result: 22 s, environment: staging, date: 2026-09-01, artifact: runs/42 | observed |
`;

test('reads the table under a numbered heading, not its neighbour', () => {
  const t = sectionTable(ARCH, 'Quality Requirements & SLOs');
  assert.deepEqual(t.headers, ['scenario', 'measure', 'target', 'priority', 'src']);
  assert.equal(t.rows.length, 3);
});

test('a missing section yields no table rather than throwing', () => {
  assert.equal(sectionTable(ARCH, 'Risks & Technical Debt'), undefined);
});

test('must rows are the ones priority says they are', () => {
  const rows = mustRows(sectionTable(ARCH, 'Quality Requirements & SLOs'));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].measure, 'p99 end-to-end');
});

// An ADR answers a §13 row when it names that row's measure. Without an id
// column that string is the only stable handle the two documents share.
test('design coverage counts must rows an ADR names', () => {
  const rows = mustRows(sectionTable(ARCH, 'Quality Requirements & SLOs'));
  const adrs = ['we will shard by tenant. addresses: §13 p99 end-to-end'];
  assert.deepEqual(designCoverage(rows, adrs), { n: 1, d: 2 });
});

test('validation coverage counts must rows the plan has a row for', () => {
  const rows = mustRows(sectionTable(ARCH, 'Quality Requirements & SLOs'));
  const plan = firstTable(PLAN);
  assert.deepEqual(validationCoverage(rows, plan.rows), { n: 2, d: 2 });
});

// Evidence is all four fields or it is still a plan.
test('evidence coverage needs result, environment, date and artifact', () => {
  const plan = firstTable(PLAN);
  assert.deepEqual(evidenceCoverage(plan.rows), { n: 1, d: 2 });
});

test('traceability counts ADRs naming a section that exists', () => {
  const adrs = ['addresses §13 p99 end-to-end', 'we will use redis', 'addresses §2 vpc'];
  assert.deepEqual(traceability(adrs), { n: 2, d: 3 });
});

// A system with no must rows has not achieved full coverage, and printing 100%
// there is the dishonesty this report exists to catch.
test('a zero denominator is not applicable, never 100%', () => {
  assert.deepEqual(ratio(0, 0), { notApplicable: true });
  assert.deepEqual(ratio(0, 3), { n: 0, d: 3 });
});

// A section this script could not parse and a section that is genuinely absent
// both yield an empty row set, and reported the same way the reviewer cannot
// tell a clean sheet from a broken reader.
test('a section that could not be read is said out loud', () => {
  assert.deepEqual(notes(ARCH, []), []);
  assert.deepEqual(notes('# Nothing here', []),
    ['section 13 Quality Requirements & SLOs not found — no driver ratios computed']);
});

test('an absent ADR directory is said out loud too', () => {
  assert.deepEqual(notes(ARCH, []).length, 0);
  assert.match(notes(ARCH, undefined)[0], /no ADR directory/);
});
