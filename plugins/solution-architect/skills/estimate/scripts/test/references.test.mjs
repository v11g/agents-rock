import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_CATEGORIES, TIER_BREAKS } from '../lib/estimate-math.mjs';
import { TASK_SHAPES } from '../lib/measurements.mjs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const ALL = ['interview.md', 'techniques.md', 'ai-multipliers.md', 'writing.md', 'slicing.md',
  'task-shapes.md', 'agentic-estimation.md', 'scoring-guide.md'];

test('no reference doc carries placeholders', () => {
  for (const f of ALL) assert.doesNotMatch(ref(f), /\bTBD\b|\bTODO\b/, f);
});

test('interview.md carries its five required parts', () => {
  const doc = ref('interview.md');
  for (const needle of ['stated', 'proposed', 'QUICK', 'STANDARD', 'DEEP',
    'confirmed scope', 'impact-if-wrong', 'calibration', 'milestone']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
});

test('techniques.md names every technique and the real tier breaks', () => {
  const doc = ref('techniques.md');
  for (const needle of ['factor-scored tiering', 'three-point PERT', 'analogy']) {
    assert.ok(doc.includes(needle), `techniques.md missing: ${needle}`);
  }
  assert.ok(doc.includes('12–17 M') || doc.includes('12-17 M'), 'tier breaks must match TIER_BREAKS');
  assert.equal(TIER_BREAKS[1].max, 17); // the doc claim above is only honest while this holds
});

test('ai-multipliers.md agrees with the code constants', () => {
  const doc = ref('ai-multipliers.md');
  for (const category of Object.keys(AI_CATEGORIES)) {
    assert.ok(doc.includes(category), `ai-multipliers.md missing category: ${category}`);
  }
  assert.match(doc, /blanket/i, 'the blanket-multiplier prohibition must be stated');
  // The Claude-plan price table lived here; seat cost is now an interview input.
  assert.doesNotMatch(doc, /PLAN_PRICES|max5x|max20x/, 'vendor plan pricing must not be documented as a constant');
});

test('interview.md asks AI-assisted (default yes) and a nullable seat cost, never a Claude plan', () => {
  const doc = ref('interview.md');
  for (const needle of ['AI-assisted', 'toolingCostPerSeat', 'default']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
  assert.doesNotMatch(doc, /Max 5x|Max 20x|Claude plan/);
});

test('interview.md defaults to one team and asks why when several are compared', () => {
  const doc = ref('interview.md');
  for (const needle of ['one team', 'recommendedReason']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
});

test('writing.md states every validator rule family', () => {
  const doc = ref('writing.md');
  for (const needle of ['not estimated', 'stated', 'proposed', 'Out of scope',
    'assumptions', 'buffer', 'elected', 'docs/estimate/', 'Roadmap', 'not calendar dates',
    'components', 'scope hole']) {
    assert.ok(doc.includes(needle), `writing.md missing: ${needle}`);
  }
});

test('slicing.md carries the vertical-slice rules and split patterns', () => {
  const doc = ref('slicing.md');
  for (const needle of ['Walking skeleton', 'user-visible', 'Workflow steps', 'Spike',
    'two levels', 'humanizingwork.com', 'addyosmani']) {
    assert.ok(doc.includes(needle), `slicing.md missing: ${needle}`);
  }
  assert.ok(/## Sources/.test(doc), 'slicing.md missing Sources section');
});

test('task-shapes.md names every shape in the code taxonomy', () => {
  const doc = ref('task-shapes.md');
  for (const shape of TASK_SHAPES) assert.ok(doc.includes(shape), `task-shapes.md missing: ${shape}`);
});

test('agentic-estimation.md states ladder, math bands, confidence, and sources', () => {
  const doc = ref('agentic-estimation.md');
  for (const needle of ['repo', 'lognormal', '1.645', 'UNCALIBRATED', 'planning',
    'means sum', 'impactMinutes', 'measurements.jsonl']) {
    assert.ok(doc.includes(needle), `agentic-estimation.md missing: ${needle}`);
  }
  assert.ok(/## Sources/.test(doc));
  for (const src of ['erikbern.com', 'Vacanti', 'atomicobject.com']) assert.ok(doc.includes(src), src);
});

test('interview.md carries the delivery-mode fork', () => {
  const doc = ref('interview.md');
  for (const needle of ['Delivery mode', 'TRADITIONAL', 'AGENTIC', 'agentContext', 'seed']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
});

test('method sources are cited where techniques are recommended', () => {
  const SOURCES = {
    'techniques.md': ['atomicobject.com', 'kmino.io', 'Modular-Earth'],
    'ai-multipliers.md': ['kmino.io'],
  };
  for (const [f, needles] of Object.entries(SOURCES)) {
    const doc = ref(f);
    assert.ok(/## Sources/.test(doc), `${f} missing Sources section`);
    for (const needle of needles) {
      assert.ok(doc.includes(needle), `${f} missing source: ${needle}`);
    }
  }
});

test('scoring-guide.md carries five rows of five anchors and the tier scale', () => {
  const doc = ref('scoring-guide.md');
  const rows = doc.split('\n').filter((l) => /^\| (Tech complexity|Feature size|Dependencies|Uncertainty|Risk) \|/.test(l));
  assert.equal(rows.length, 5);
  for (const r of rows) assert.equal(r.split('|').length - 2, 6, r); // label + 5 anchors
  assert.match(doc, /S ≤ 11 · M 12–17 · L 18–22 · XL 23\+/);
  assert.match(doc, /XL 400–800 h/);
  assert.doesNotMatch(doc, /derived:/);
});

test('interview.md scores before tasks, names the three review channels and the plain-words note', () => {
  const doc = ref('interview.md');
  for (const needle of ['scoring-guide.md', 'scores', 'scoreNote', 'scoreProvenance', 'terminal', 'csv', 'html',
    'score-review.mjs', 'accept', 'split', 'outside', 'plain', 'needsReason', 'no reason given']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
  assert.ok(doc.indexOf('Factor scores per feature') < doc.indexOf('Tasks + O/M/P'), 'scores come before tasks');
});

test('techniques.md says scores persist at STANDARD/DEEP and the band is a soft cross-check', () => {
  const doc = ref('techniques.md');
  assert.match(doc, /STANDARD\/DEEP/);
  assert.match(doc, /persist/i);
  assert.match(doc, /cross-check/i);
  assert.match(doc, /XL 400-800h|XL 400–800 h/);
});

test('writing.md documents the score fields and the Tier rule', () => {
  const doc = ref('writing.md');
  for (const needle of ['`scores`', '`scoreNote`', '`scoreProvenance`', 'anchor', 'cite', 'Tier']) {
    assert.ok(doc.includes(needle), `writing.md missing: ${needle}`);
  }
  assert.match(doc, /Tier.*must (equal|match)/);
});

test('SKILL.md points the interview at the scoring guide and the review script', () => {
  const skill = readFileSync(new URL('../../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /scoring-guide\.md/);
  assert.match(skill, /score-review\.mjs/);
});
