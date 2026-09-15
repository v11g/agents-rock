import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkDeliverables } from '../lib/checks.mjs';
import { computeEstimation } from '../lib/rollup.mjs';
import { loadMeasurements } from '../lib/measurements.mjs';

const read = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const inputs = () => JSON.parse(read('booking-inputs.json'));
const stripRoadmap = (md) => md.replace(/### Roadmap[\s\S]*?(?=### Assumptions)/, '');

test('the pass fixture passes', () => {
  assert.deepEqual(
    checkDeliverables({ md: read('estimation-pass.md'), estimation: computeEstimation(inputs()) }), []);
});

// The fixtures are the worked example a reader copies from, and the skill
// prices seats, not a named vendor plan (references.test.mjs holds the same
// line for the reference docs).
test('neither deliverable fixture names a vendor AI plan', () => {
  for (const f of ['estimation-pass.md', 'estimation-fail.md']) {
    assert.doesNotMatch(read(f), /Max 5x/, f);
  }
});

test('each seeded violation is caught by name', () => {
  const findings = checkDeliverables({ md: read('estimation-fail.md'), estimation: computeEstimation(inputs()) });
  for (const needle of ['never 0', 'src', 'assumptions cell', 'assumptions register', 'buffer', 'out of scope', 'scenario', 'roadmap']) {
    assert.ok(findings.some((f) => f.toLowerCase().includes(needle)), `no finding for: ${needle}`);
  }
});

// One team is the default interview answer now; a comparison table with a
// single row is a complete deliverable, not a missing comparison.
test('a scenario table with one row validates', () => {
  const md = read('estimation-pass.md').replace(/\n\| 3eng-noai \|[^\n]*/, '');
  const findings = checkDeliverables({ md, estimation: computeEstimation(inputs()) });
  assert.ok(!findings.some((f) => f.includes('scenario')), findings.join('\n'));
});

test('hand-edited totals are refused', () => {
  const est = computeEstimation(inputs());
  est.computed.devHours += 10;
  const findings = checkDeliverables({ md: read('estimation-pass.md'), estimation: est });
  assert.ok(findings.some((f) => f.includes('recomputed')));
});

test('an all-zero feature does not pass via the zero-spread exemption', () => {
  const bad = inputs();
  bad.features.push({ id: 'empty-feat', name: 'Nothing here', provenance: 'stated', tasks: [] });
  const findings = checkDeliverables({ md: read('estimation-pass.md'), estimation: computeEstimation(bad) });
  assert.ok(findings.some((f) => f.includes('empty-feat') && f.includes('low < hours < high')));
});

test('a Summary without a scope table is refused, not vacuously accepted', () => {
  const md = read('estimation-pass.md').replace(
    /\| Feature \| Tier \| Range \(h\) \| src \|\n\| --- \| --- \| --- \| --- \|\n(?:\|.*\|\n)+\n/,
    '',
  );
  const findings = checkDeliverables({ md, estimation: computeEstimation(inputs()) });
  assert.ok(findings.some((f) => f.includes('summary scope table missing')));
});

test('milestones without a Roadmap section are refused', () => {
  const findings = checkDeliverables({
    md: stripRoadmap(read('estimation-pass.md')), estimation: computeEstimation(inputs()) });
  assert.ok(findings.some((f) => f.includes('missing ### Roadmap')));
});

test('a Roadmap section without milestones is refused', () => {
  const bare = inputs();
  for (const f of bare.features) delete f.milestone;
  const findings = checkDeliverables({
    md: read('estimation-pass.md'), estimation: computeEstimation(bare) });
  assert.ok(findings.some((f) => f.includes('no milestones')));
});

test('no milestones and no Roadmap section is clean', () => {
  const bare = inputs();
  for (const f of bare.features) delete f.milestone;
  assert.deepEqual(checkDeliverables({
    md: stripRoadmap(read('estimation-pass.md')), estimation: computeEstimation(bare) }), []);
});

test('the roadmap honesty line is mandatory', () => {
  const md = read('estimation-pass.md').replace(/not calendar dates/, 'roughly');
  const findings = checkDeliverables({ md, estimation: computeEstimation(inputs()) });
  assert.ok(findings.some((f) => f.includes('not calendar dates')));
});

// Agentic deliverable checks.
const agenticMd = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url).pathname, 'utf8');
const measurementsFixture = new URL('./fixtures/measurements.jsonl', import.meta.url).pathname;

function agenticEstimation() {
  const agenticInputs = JSON.parse(
    readFileSync(new URL('./fixtures/agentic-inputs.json', import.meta.url).pathname, 'utf8'));
  agenticInputs.measurementsPath = measurementsFixture;
  return computeEstimation(agenticInputs, loadMeasurements(measurementsFixture).records);
}

test('agentic pass fixture validates clean', () => {
  assert.deepEqual(checkDeliverables({ md: agenticMd('agentic-estimation-pass.md'), estimation: agenticEstimation() }), []);
});

test('agentic fail fixture trips every enforcement rule', () => {
  const findings = checkDeliverables({ md: agenticMd('agentic-estimation-fail.md'), estimation: agenticEstimation() });
  assert.ok(findings.some((f) => /vague estimate language/.test(f)), 'vague range');
  assert.ok(findings.some((f) => /uncalibrated/i.test(f)), 'uncalibrated masked as measured');
  assert.ok(findings.some((f) => /evidence/i.test(f) && /m99/.test(f)), 'invented evidence');
  assert.ok(findings.some((f) => /evidence/i.test(f) && /m01/.test(f) && /600/.test(f)), 'wrong evidence minutes');
});

test('agentic estimation without a planning task is refused', () => {
  const estimation = agenticEstimation();
  estimation.inputs.features = estimation.inputs.features.filter((f) => f.id !== 'plan');
  const findings = checkDeliverables({ md: agenticMd('agentic-estimation-pass.md'), estimation });
  assert.ok(findings.some((f) => /planning/.test(f)));
});

test('missing Delivery header line is a finding', () => {
  const md = agenticMd('agentic-estimation-pass.md').replace(/Delivery: agentic.*\n/, '');
  const findings = checkDeliverables({ md, estimation: agenticEstimation() });
  assert.ok(findings.some((f) => /Delivery:/.test(f)));
});

test('a Summary Tier cell that disagrees with the scores is refused at STANDARD depth', () => {
  const md = read('estimation-pass.md').replace('| User can book appointment | M |', '| User can book appointment | L |');
  const findings = checkDeliverables({ md, estimation: computeEstimation(inputs()) });
  assert.ok(findings.some((f) => f === 'scope row "User can book appointment": Tier L does not match scores (M)'), findings.join('\n'));
});

test('the Tier column is required at STANDARD depth and ignored at QUICK', () => {
  const noTier = read('estimation-pass.md')
    .replace('| Feature | Tier | Range (h) | src |', '| Feature | Range (h) | src |')
    .replace('| --- | --- | --- | --- |\n| User', '| --- | --- | --- |\n| User')
    .replace('| User can book appointment | M | 40–120 |', '| User can book appointment | 40–120 |')
    .replace('| Email reminders | S | 12–36 |', '| Email reminders | 12–36 |');
  assert.ok(checkDeliverables({ md: noTier, estimation: computeEstimation(inputs()) })
    .some((f) => f.includes('Tier column')));
  const quick = inputs();
  quick.depth = 'QUICK';
  for (const f of quick.features) { delete f.scores; delete f.scoreNote; delete f.scoreProvenance; }
  const md = read('estimation-pass.md').replace('| User can book appointment | M |', '| User can book appointment | XL |');
  assert.ok(!checkDeliverables({ md, estimation: computeEstimation(quick) }).some((f) => f.includes('Tier')));
});
