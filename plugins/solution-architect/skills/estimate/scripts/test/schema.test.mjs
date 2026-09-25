import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkInputs } from '../lib/schema.mjs';
import { checkContext } from '../lib/context-schema.mjs';

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
  bad.risks[0].probability = 7;                       // out of [0, 1]
  const findings = checkInputs(bad);
  assert.equal(findings.length, 5);
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('o <= m <= p')));
  assert.ok(findings.some((f) => f.includes('booking-rules') && f.includes('category')));
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('stated|proposed')));
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('assumptions')));
  assert.ok(findings.some((f) => f.includes('probability')));
});

test('zero estimates are refused — the honest absence is "not estimated"', () => {
  const bad = fixture();
  bad.features[0].tasks[0].m = 0;
  assert.ok(checkInputs(bad).some((f) => f.includes('never 0')));
});

test('anything compute would turn into NaN is refused up front', () => {
  const bad = fixture();
  bad.features[0].tasks[0].p = 'lots';
  bad.features[1].tasks[0].m = -20;
  bad.verificationPct = 'lots';
  bad.risks[0].probability = 7;
  bad.risks[0].impactHours = -10;
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('numbers')));
  assert.ok(findings.some((f) => f.includes('reminder-jobs') && f.includes('o <= m <= p')));
  assert.ok(findings.some((f) => f.includes('verificationPct')));
  assert.ok(findings.some((f) => f.includes('probability')));
  assert.ok(findings.some((f) => f.includes('impactHours')));
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
  bad.features[1].tasks[0].confidence = 'toString';
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('booking-api') && f.includes('category')));
  assert.ok(findings.some((f) => f.includes('reminder-jobs') && f.includes('confidence')));
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

// Context factors: five project-wide multipliers that replaced scenarios.
const contextBase = () => ({
  project: 'x', technique: 't', depth: 'STANDARD', features: [], risks: [],
  assumptions: [], verificationPct: 0.12,
  contextLevels: {
    codebaseMaturity: 2, stackFamiliarity: 1, specQuality: 3, compliance: 1, clientDecisions: 2,
  },
  contextProvenance: {
    codebaseMaturity: { level: 2, anchor: 'young and clean', cite: 'ARCHITECTURE.md §3', source: 'derived' },
    stackFamiliarity: { level: 1, anchor: 'core stack, done before', cite: 'interview', source: 'stated' },
    specQuality: { level: 3, anchor: 'outline or slide deck', cite: 'requirements.json readiness 62', source: 'derived' },
    compliance: { level: 1, anchor: 'none', cite: 'ARCHITECTURE.md §8 no PII', source: 'derived' },
    clientDecisions: { level: 2, anchor: 'two or three', cite: 'requirements.md Part 1', source: 'derived' },
  },
});

test('scenarios are no longer a required top-level key', () => {
  const out = checkInputs(contextBase());
  assert.ok(!out.some((f) => /scenarios|recommendedScenario/.test(f)), out.join('\n'));
});

test('a leftover scenarios key is refused, not ignored', () => {
  const out = checkInputs({ ...contextBase(), scenarios: [{ id: 'a' }] });
  assert.ok(out.some((f) => /scenarios.*removed/i.test(f)), out.join('\n'));
});

test('every context factor is required at STANDARD depth', () => {
  const inputs = contextBase();
  delete inputs.contextLevels.compliance;
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /compliance/.test(f)), out.join('\n'));
});

test('a context level outside 1-4 is refused', () => {
  const inputs = contextBase();
  inputs.contextLevels.compliance = 5;
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /compliance.*1-4/.test(f)), out.join('\n'));
});

test('every context factor carries an anchor, a cite and a source', () => {
  const inputs = contextBase();
  delete inputs.contextProvenance.specQuality.cite;
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /specQuality.*cite/.test(f)), out.join('\n'));
});

test('context source must be derived or stated', () => {
  const inputs = contextBase();
  inputs.contextProvenance.compliance.source = 'guessed';
  const out = [];
  checkContext(inputs, out);
  assert.ok(out.some((f) => /compliance.*derived\|stated/.test(f)), out.join('\n'));
});

test('QUICK depth needs no context factors', () => {
  const inputs = { ...contextBase(), depth: 'QUICK' };
  delete inputs.contextLevels;
  delete inputs.contextProvenance;
  const out = [];
  checkContext(inputs, out);
  assert.deepEqual(out, []);
});

test('agentic depth STANDARD needs no context factors either', () => {
  const inputs = agenticFixture();
  const out = [];
  checkContext(inputs, out);
  assert.deepEqual(out, []);
});
