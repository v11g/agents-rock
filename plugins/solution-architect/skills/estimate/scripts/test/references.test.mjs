import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_CATEGORIES, TIER_BREAKS } from '../lib/estimate-math.mjs';
import { TASK_SHAPES } from '../lib/measurements.mjs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const ALL = ['interview.md', 'techniques.md', 'ai-multipliers.md', 'writing.md', 'slicing.md',
  'task-shapes.md', 'agentic-estimation.md'];

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
  assert.ok(doc.includes('11-17 M') || doc.includes('11–17 M'), 'tier breaks must match TIER_BREAKS');
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
