import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkDeliverables, checkDeepEstimates } from '../lib/checks.mjs';
import { computeEstimation } from '../lib/rollup.mjs';
import { loadMeasurements } from '../../../shared/lib/measurements.mjs';

const read = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const inputs = () => JSON.parse(read('booking-inputs.json'));
const stripRoadmap = (md) => md.replace(/### Roadmap[\s\S]*?(?=### Assumptions)/, '');
// checkDeliverables under another name, for the price/roadmap tests below.
const findings = checkDeliverables;
// The booking fixture already carries milestones and scored features, so
// one fully computed estimation object serves both the price tests and the
// roadmap tests below.
const priced = () => computeEstimation(inputs());

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
  for (const needle of ['never 0', 'src', 'assumptions cell', 'assumptions register', 'out of scope', 'scenario', 'roadmap']) {
    assert.ok(findings.some((f) => f.toLowerCase().includes(needle)), `no finding for: ${needle}`);
  }
});

// The price block replaces the scenario table outright — a lingering one is
// refused even when it sits beside an otherwise-clean, fully priced doc.
test('a lingering scenario table is refused even in an otherwise-clean deliverable', () => {
  const scenarioTable = '### Scenario comparison\n\n'
    + '| Scenario | Team | AI-assisted | Months | Cost | Notes |\n'
    + '| --- | --- | --- | --- | --- | --- |\n'
    + '| 3eng-noai | 2 mid + 1 junior | no | 0.43 | $7,266 | — |\n\n';
  const md = read('estimation-pass.md').replace('### Price', `${scenarioTable}### Price`);
  const findings = checkDeliverables({ md, estimation: computeEstimation(inputs()) });
  assert.ok(findings.some((f) => /scenario table was removed/i.test(f)), findings.join('\n'));
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
  const md = read('estimation-pass.md').replace(/relative shares/, 'roughly');
  const findings = checkDeliverables({ md, estimation: computeEstimation(inputs()) });
  assert.ok(findings.some((f) => f.includes('relative shares')));
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

// Price block / deep-estimate checks (Task 6).
test('the roadmap must say bands are relative shares, not durations', () => {
  const md = '### Roadmap\n\n| Milestone | Share |\n|---|---|\n| M1 | 75% |\n\nBands are relative shares.\n';
  const out = findings({ md, estimation: priced() });
  assert.ok(!out.some((f) => /relative shares/.test(f)), out.join('\n'));
});

test('a roadmap claiming durations is refused', () => {
  const md = '### Roadmap\n\n| Milestone | Months |\n|---|---|\n| M1 | 0.4 |\n\nBands are relative months.\n';
  const out = findings({ md, estimation: priced() });
  assert.ok(out.some((f) => /relative shares/.test(f)), out.join('\n'));
});

test('a scenario comparison table in the md is refused', () => {
  const md = '## Summary\n\n| Scenario | Team | AI-assisted | Months | Cost |\n|---|---|---|---|---|\n';
  const out = findings({ md, estimation: priced() });
  assert.ok(out.some((f) => /scenario table was removed/i.test(f)), out.join('\n'));
});

test('the presented range must appear in the md', () => {
  const out = findings({ md: '## Summary\n\nNo numbers here.\n', estimation: priced() });
  assert.ok(out.some((f) => /presented range/i.test(f)), out.join('\n'));
});

test('a feature flagged for a deep estimate needs a breakdown or a waiver', () => {
  const est = priced();
  const id = Object.keys(est.computed.features)[0];
  est.computed.features[id].flag = 'Deep estimate required';
  est.inputs.features.find((f) => f.id === id).tasks = [];
  const out = [];
  checkDeepEstimates(est, out);
  assert.ok(out.some((f) => new RegExp(id).test(f)), out.join('\n'));
});

// schema.mjs makes every feature carry at least one task, so "has tasks"
// can never fail. One task is not a breakdown (R58): the deep pass needs two
// or more, or a waiver.
test('a flagged feature with a single ordinary task is refused; two tasks pass', () => {
  const est = priced();
  const id = 'reminders';
  est.computed.features[id].flag = 'Deep estimate required';
  const feature = est.inputs.features.find((f) => f.id === id);
  assert.equal(feature.tasks.length, 1, 'fixture precondition: reminders has one task');
  const one = [];
  checkDeepEstimates(est, one);
  assert.ok(one.some((f) => f.includes(id)), 'one task must not satisfy the deep-estimate gate');
  feature.tasks = [feature.tasks[0], { ...feature.tasks[0], name: 'second task' }];
  const two = [];
  checkDeepEstimates(est, two);
  assert.deepEqual(two, []);
});

test('a waived deep estimate passes', () => {
  const est = priced();
  const id = Object.keys(est.computed.features)[0];
  est.computed.features[id].flag = 'Deep estimate required';
  est.inputs.features.find((f) => f.id === id).deepEstimateWaiver = 'client capped this feature at the band price';
  const out = [];
  checkDeepEstimates(est, out);
  assert.deepEqual(out, []);
});

// Through the real gate (checkDeliverables, the path validate.mjs actually
// takes) rather than the helper in isolation: validate.mjs reads
// estimation.json straight off disk and never runs checkInputs, so a bare
// `true` hand-edited into inputs.deepEstimateWaiver after compute must still
// be refused here, not just at schema.mjs's compute-time gate.
test('a bare true deepEstimateWaiver does not pass the real gate; a reason does', () => {
  const est = priced();
  const id = Object.keys(est.computed.features)[0];
  est.computed.features[id].flag = 'Deep estimate required';
  const feature = est.inputs.features.find((f) => f.id === id);
  feature.tasks = [];
  const md = read('estimation-pass.md');

  feature.deepEstimateWaiver = true;
  const tampered = checkDeliverables({ md, estimation: est });
  assert.ok(tampered.some((f) => f.includes(id) && f.includes('deepEstimateWaiver')), tampered.join('\n'));

  feature.deepEstimateWaiver = 'client capped this feature at the band price';
  const passing = checkDeliverables({ md, estimation: est });
  assert.ok(!passing.some((f) => f.includes(id) && f.includes('deepEstimateWaiver')), passing.join('\n'));
});
