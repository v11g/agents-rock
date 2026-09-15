import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkInputs } from '../lib/schema.mjs';

const fixture = () => JSON.parse(
  readFileSync(new URL('./fixtures/booking-inputs.json', import.meta.url), 'utf8'));

test('the booking fixture is valid', () => {
  assert.deepEqual(checkInputs(fixture()), []);
});

test('every defect is named with its path', () => {
  const bad = fixture();
  bad.features[0].tasks[0].o = 50;                    // o > m
  bad.features[0].tasks[1].category = 'ai-magic';     // unknown category
  bad.features[1].provenance = 'observed';            // valid vocabulary, but scope must be stated|proposed
  delete bad.features[0].tasks[0].assumptions;        // missing register
  bad.recommendedScenario = 'ghost';                  // not a scenario id
  const findings = checkInputs(bad);
  assert.equal(findings.length, 5);
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('o <= m <= p')));
  assert.ok(findings.some((f) => f.includes('booking-rules') && f.includes('category')));
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('stated|proposed')));
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('assumptions')));
  assert.ok(findings.some((f) => f.includes('recommendedScenario')));
});

test('zero estimates are refused — the honest absence is "not estimated"', () => {
  const bad = fixture();
  bad.features[0].tasks[0].m = 0;
  assert.ok(checkInputs(bad).some((f) => f.includes('never 0')));
});

test('anything compute would turn into NaN is refused up front', () => {
  const bad = fixture();
  bad.scenarios[1].aiAssisted = 'yes';
  bad.scenarios[0].team[0].seniority = 'staff';
  bad.scenarios[0].team[1].rate = -5;
  bad.overheadPct = 1.4;
  bad.verificationPct = 'lots';
  bad.risks[0].probability = 7;
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('2eng-max5x') && f.includes('aiAssisted')));
  assert.ok(findings.some((f) => f.includes('3eng-noai') && f.includes('seniority')));
  assert.ok(findings.some((f) => f.includes('3eng-noai') && f.includes('rate')));
  assert.ok(findings.some((f) => f.includes('overheadPct')));
  assert.ok(findings.some((f) => f.includes('verificationPct')));
  assert.ok(findings.some((f) => f.includes('probability')));
});

test('a string estimate is refused, not silently coerced by pert()', () => {
  const bad = fixture();
  bad.features[0].tasks[0].o = '16';
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('numbers')));
});

test('a feature with no tasks is refused — the zero-spread exemption must not be reachable', () => {
  const bad = fixture();
  bad.features[1].tasks = [];
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('task')));
});

test('inherited object keys do not pass the enum checks', () => {
  const bad = fixture();
  bad.features[0].tasks[0].category = 'toString';
  bad.scenarios[0].team[0].seniority = 'toString';
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('category')));
  assert.ok(findings.some((f) => f.includes('3eng-noai') && f.includes('seniority')));
});

// The Claude-plan enum is gone: a scenario says whether the team has AI
// help (drives hours) and what a tooling seat costs (drives cost, nullable).
test('a legacy "plan" key is refused and the finding names its replacement', () => {
  const bad = fixture();
  bad.scenarios[1].plan = 'max5x';
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('2eng-max5x') && f.includes('plan') && f.includes('aiAssisted')));
});

test('aiAssisted must be a boolean and toolingCostPerSeat a positive number or null', () => {
  const bad = fixture();
  delete bad.scenarios[0].aiAssisted;
  bad.scenarios[1].toolingCostPerSeat = '100';
  let findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('3eng-noai') && f.includes('aiAssisted')));
  assert.ok(findings.some((f) => f.includes('2eng-max5x') && f.includes('toolingCostPerSeat')));
  const zero = fixture();
  zero.scenarios[1].toolingCostPerSeat = 0;
  assert.ok(checkInputs(zero).some((f) => f.includes('2eng-max5x') && f.includes('toolingCostPerSeat')));
  const missing = fixture();
  delete missing.scenarios[1].toolingCostPerSeat;
  assert.ok(checkInputs(missing).some((f) => f.includes('2eng-max5x') && f.includes('toolingCostPerSeat')));
});

// Skipping the seat price is allowed — the client may mandate a vendor — but
// only as a recorded gap: an AI-assisted scenario with a null seat cost needs
// an assumption that says so, or the page would show a total silently missing
// a line item.
test('a null seat cost on an AI-assisted scenario needs a tooling assumption', () => {
  const gap = fixture();
  gap.scenarios[1].toolingCostPerSeat = null;
  assert.ok(checkInputs(gap).some((f) => f.includes('2eng-max5x') && f.includes('tooling') && f.includes('assumption')));
  gap.assumptions.push({ text: 'AI tooling cost per seat not yet set — client may mandate a vendor',
    impactIfWrong: 'adds ~2% to total at $100-200/seat/month' });
  assert.deepEqual(checkInputs(gap), []);
  const unaided = fixture();
  unaided.scenarios[0].toolingCostPerSeat = null;   // 3eng-noai is aiAssisted: false — no gap to record
  assert.deepEqual(checkInputs(unaided), []);
});

test('recommendedReason, when present, is a non-empty string', () => {
  const ok = fixture();
  ok.recommendedReason = 'client has one senior available';
  assert.deepEqual(checkInputs(ok), []);
  const bad = fixture();
  bad.recommendedReason = '  ';
  assert.ok(checkInputs(bad).some((f) => f.includes('recommendedReason')));
});

test('milestones are all-or-nothing across features', () => {
  const bad = fixture();
  delete bad.features[1].milestone;   // features[0] has one, features[1] doesn't
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('milestone missing')));
});

test('components are all-or-nothing and must resolve to the roster', () => {
  const bad = fixture();
  delete bad.features[1].component;                 // features[0] has one
  assert.ok(checkInputs(bad).some((f) => f.includes('reminders') && f.includes('component missing')));
  const ghost = fixture();
  ghost.features[0].component = 'ghost';
  assert.ok(checkInputs(ghost).some((f) => f.includes('booking') && f.includes('not in roster')));
  const tagOnly = fixture();
  delete tagOnly.components;
  assert.ok(checkInputs(tagOnly).some((f) => f.includes('no top-level components roster')));
  const bare = fixture();
  delete bare.components;
  for (const f of bare.features) delete f.component;
  assert.deepEqual(checkInputs(bare), []);          // no roster at all → still valid
});

test('an uncovered leaf component is a scope hole unless notEstimated says why', () => {
  const bad = fixture();
  bad.components.push({ id: 'reports', name: 'Reporting' });
  assert.ok(checkInputs(bad).some((f) => f.includes('reports') && f.includes('no feature covers it')));
  const excused = fixture();
  excused.components.push({ id: 'reports', name: 'Reporting', notEstimated: 'phase 2' });
  assert.deepEqual(checkInputs(excused), []);
  const blank = fixture();
  blank.components[3].notEstimated = '  ';          // admin's excuse blanked
  assert.ok(checkInputs(blank).some((f) => f.includes('admin') && f.includes('reason')));
});

test('the roster is two levels max and parents must exist', () => {
  const deep = fixture();
  deep.components.push({ id: 'retry', name: 'Retry', parent: 'notify.jobs' });
  assert.ok(checkInputs(deep).some((f) => f.includes('retry') && f.includes('two levels max')));
  const orphan = fixture();
  orphan.components[2].parent = 'ghost';            // notify.jobs → nonexistent parent
  assert.ok(checkInputs(orphan).some((f) => f.includes('notify.jobs') && f.includes('not in roster')));
});

test('a blank milestone is refused; none at all is fine', () => {
  const bad = fixture();
  bad.features[0].milestone = '  ';
  bad.features[1].milestone = 'M2';
  assert.ok(checkInputs(bad).some((f) => f.includes('booking') && f.includes('non-empty')));
  const bare = fixture();
  for (const f of bare.features) delete f.milestone;
  assert.deepEqual(checkInputs(bare), []);           // no milestones at all → still valid
});

// Agentic-mode schema branch.
const agenticFixturePath = new URL('./fixtures/agentic-inputs.json', import.meta.url).pathname;
const agenticFixture = () => JSON.parse(readFileSync(agenticFixturePath, 'utf8'));

test('agentic fixture validates clean', () => {
  assert.deepEqual(checkInputs(agenticFixture()), []);
});

test('agentic tasks reject team-mode and script-owned fields', () => {
  const inputs = agenticFixture();
  Object.assign(inputs.features[1].tasks[0], { category: 'boilerplate', confidence: 'HIGH', o: 1, m: 2, p: 3 });
  const findings = checkInputs(inputs);
  for (const banned of ['category', 'confidence', '"o"', '"m"', '"p"']) {
    assert.ok(findings.some((f) => f.includes(banned)), `expected finding for ${banned}: ${findings}`);
  }
});

test('agentic tasks require shape, scope, ordered positive seedMinutes', () => {
  const inputs = agenticFixture();
  const task = inputs.features[1].tasks[0];
  task.shape = 'jazz_hands';
  task.seedMinutes = { o: 45, m: 20, p: 10 };
  delete task.scope;
  const findings = checkInputs(inputs);
  assert.ok(findings.some((f) => f.includes('unknown shape')));
  assert.ok(findings.some((f) => f.includes('seedMinutes')));
  assert.ok(findings.some((f) => f.includes('scope')));
});

test('agentic mode requires agentContext and minute-based risks with reasons', () => {
  const inputs = agenticFixture();
  delete inputs.agentContext;
  inputs.risks = [{ name: 'r', probability: 0.5, impactHours: 2 }];
  const findings = checkInputs(inputs);
  assert.ok(findings.some((f) => f.includes('agentContext')));
  assert.ok(findings.some((f) => f.includes('impactMinutes')));
  assert.ok(findings.some((f) => f.includes('reason')));
});

test('agentContext.repository, when present, must be a non-empty string', () => {
  const inputs = agenticFixture();
  inputs.agentContext.repository = '';
  const findings = checkInputs(inputs);
  assert.ok(findings.some((f) => f.includes('agentContext.repository')));
});

test('agentContext.repository is optional', () => {
  const inputs = agenticFixture();
  delete inputs.agentContext.repository;
  assert.deepEqual(checkInputs(inputs), []);
});

test('deliveryMode vocabulary is enforced; team inputs stay valid', () => {
  const inputs = agenticFixture();
  inputs.deliveryMode = 'vibes';
  assert.ok(checkInputs(inputs).some((f) => f.includes('deliveryMode')));
  assert.deepEqual(checkInputs(fixture()), []); // existing booking fixture untouched
});

const GUIDE_RISK_4 = 'Payments, auth, data migrations, or PII — high business impact';

test('scores are required at STANDARD depth, complete, 1–5, anchored to the guide, cited', () => {
  const bad = fixture();
  delete bad.features[1].scores;
  bad.features[0].scores.risk = { n: 6, anchor: GUIDE_RISK_4, cite: 'x' };
  bad.features[0].scores.tech.anchor = 'hard';
  bad.features[0].scores.size.cite = '';
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('scores object is required')));
  assert.ok(findings.some((f) => f.includes('booking') && f.includes('scores.risk.n must be an integer 1–5')));
  assert.ok(findings.some((f) => f.includes('booking') && f.includes('scores.tech.anchor is not the guide')));
  assert.ok(findings.some((f) => f.includes('booking') && f.includes('scores.size.cite is required')));
});

test('an anchor must be the guide sentence for that factor and score, not another score', () => {
  const bad = fixture();
  bad.features[0].scores.risk = { n: 3, anchor: GUIDE_RISK_4, cite: 'payments' }; // risk 4's sentence on a 3
  assert.ok(checkInputs(bad).some((f) => f.includes("scores.risk.anchor is not the guide's sentence for risk = 3")));
});

test('the plain-words note refuses jargon and provenance is stated|proposed', () => {
  const bad = fixture();
  bad.features[0].scoreNote = 'Risk 4 per ARCHITECTURE.md §6';
  bad.features[1].scoreNote = '';
  bad.features[1].scoreProvenance = 'observed';
  const findings = checkInputs(bad);
  assert.equal(findings.filter((f) => f.includes('scoreNote must be one plain sentence')).length, 2);
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('scoreProvenance must be stated|proposed')));
});

test('scores must have exactly the five factors', () => {
  const bad = fixture();
  bad.features[0].scores.extra = { n: 1, anchor: 'x', cite: 'y' };
  assert.ok(checkInputs(bad).some((f) => f.includes('exactly tech, size, deps, unc, risk')));
});

test('QUICK depth refuses persisted scores and needs no scores', () => {
  const quick = fixture();
  quick.depth = 'QUICK';
  for (const f of quick.features) {
    f.tasks = [{ ...f.tasks[0], id: `${f.id}-band`, o: 60, m: 110, p: 160 }];
  }
  assert.ok(checkInputs(quick).some((f) => f.includes('booking') && f.includes('scores is not persisted at QUICK depth')));
  for (const f of quick.features) { delete f.scores; delete f.scoreNote; delete f.scoreProvenance; }
  assert.deepEqual(checkInputs(quick), []);
});

test('depth must be one of the three named depths', () => {
  const bad = fixture();
  bad.depth = 'SCORING';
  assert.ok(checkInputs(bad).some((f) => f === 'depth must be QUICK|STANDARD|DEEP'));
});
