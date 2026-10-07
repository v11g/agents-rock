import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_CATEGORIES } from '../../../shared/lib/estimate-math.mjs';
import { TASK_SHAPES } from '../../../shared/lib/measurements.mjs';
import { WEIGHTS, BANDS } from '../../../shared/lib/pricing.mjs';
import { CONTEXT_FACTORS } from '../../../shared/lib/project-price.mjs';
import { readZip } from './zip.mjs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const ALL = ['interview.md', 'techniques.md', 'ai-multipliers.md', 'writing.md', 'slicing.md',
  'task-shapes.md', 'agentic-estimation.md', 'scoring-guide.md'];

test('no reference doc carries placeholders', () => {
  for (const f of ALL) assert.doesNotMatch(ref(f), /\bTBD\b|\bTODO\b/, f);
});

// The Claude-plan price table used to live in ai-multipliers.md and the
// interview's seat-cost question used to guard against naming one; both
// hosts are gone, but the vendor-neutrality rule they carried is not — it
// now covers every reference doc, not just the one that happened to host it.
test('no reference doc names a vendor AI plan tier', () => {
  for (const f of ALL) assert.doesNotMatch(ref(f), /Max 5x|Max 20x|Claude plan/, f);
});

test('interview.md carries its five required parts', () => {
  const doc = ref('interview.md');
  for (const needle of ['stated', 'proposed', 'QUICK', 'STANDARD', 'DEEP',
    'confirmed scope', 'impact-if-wrong', 'calibration', 'milestone']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
});

test('techniques.md names every technique and the shipped bands', () => {
  const doc = ref('techniques.md');
  for (const needle of ['factor-scored tiering', 'three-point PERT', 'analogy']) {
    assert.ok(doc.includes(needle), `techniques.md missing: ${needle}`);
  }
  for (const b of BANDS) {
    assert.ok(doc.includes(`${b.start}`) && doc.includes(b.tier), `band ${b.tier} not documented`);
  }
  assert.match(doc, /continuous/i, 'bands must be described as continuous');
  assert.match(doc, /interpolat/i, 'bands must be described as interpolated');
});

test('ai-multipliers.md agrees with the code constants', () => {
  const doc = ref('ai-multipliers.md');
  for (const category of Object.keys(AI_CATEGORIES)) {
    assert.ok(doc.includes(category), `ai-multipliers.md missing category: ${category}`);
  }
  assert.match(doc, /blanket/i, 'the blanket-multiplier prohibition must be stated');
  assert.doesNotMatch(doc, /PLAN_PRICES|max5x|max20x/, 'vendor plan pricing must not be documented as a constant');
});

// AI-assisted (default yes) and toolingCostPerSeat priced a team that no
// longer exists in estimation-inputs.json — schema.mjs refuses `scenarios`
// outright. The doc must not describe fields the code no longer accepts.
test('interview.md does not ask for a team, rates, or a seat cost', () => {
  const doc = ref('interview.md');
  assert.doesNotMatch(doc, /toolingCostPerSeat|recommendedReason/, 'removed team/rate fields must not be documented');
  assert.doesNotMatch(doc, /Team \+ rates \+ seniority mix/);
});

test('writing.md states every validator rule family', () => {
  const doc = ref('writing.md');
  for (const needle of ['not estimated', 'stated', 'proposed', 'Out of scope',
    'assumptions', 'contingencyRate', 'elected', 'docs/estimate/', 'Roadmap', 'relative shares',
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

test('the scoring guide states the weight of every factor and the priced bands', () => {
  const doc = ref('scoring-guide.md');
  const rows = doc.split('\n').filter((l) => /^\| (Tech complexity|Feature size|Dependencies|Uncertainty|Risk) \|/.test(l));
  assert.equal(rows.length, 5);
  for (const r of rows) assert.equal(r.split('|').length - 2, 6, r); // label + 5 anchors
  for (const [key, w] of Object.entries(WEIGHTS)) {
    assert.ok(doc.includes(`${w * 100}%`), `guide never states ${key}'s ${w * 100}% weight`);
  }
  for (const b of BANDS) {
    assert.ok(doc.includes(`${b.start}`) && doc.includes(b.tier), `band ${b.tier} not documented`);
  }
  assert.doesNotMatch(doc, /XL 400.{1,3}800 ?h/, 'hours calibration must be gone — price bands replace it');
  assert.doesNotMatch(doc, /derived:/);
});

test('interview.md scores before tasks, names the three review channels and the plain-words note', () => {
  const doc = ref('interview.md');
  for (const needle of ['scoring-guide.md', 'scores', 'scoreNote', 'scoreProvenance', 'terminal', 'csv', 'html',
    'score-review.mjs', 'accept', 'split', 'outside', 'plain', 'needsReason', 'no reason given', 'window.__feedback()']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
  // The review page ships designed from assets/; a per-lead redesign would
  // fork the read-back contract into as many versions as there are leads.
  assert.doesNotMatch(doc, /frontend-design/);
  assert.ok(doc.indexOf('Factor scores per feature') < doc.indexOf('Tasks + O/M/P'), 'scores come before tasks');
});

// The five context factors from project-price.mjs: four derived from
// upstream BA/architecture artifacts, one (stack familiarity) asked
// directly. Standalone mode (no companion docs) asks all five.
test('interview.md asks for stack familiarity and derives the other four context factors', () => {
  const doc = ref('interview.md');
  assert.match(doc, /stack.*familiar/i, 'no stack familiarity question');
  for (const key of Object.keys(CONTEXT_FACTORS)) {
    assert.ok(doc.includes(key), `context factor ${key} never mentioned`);
  }
  assert.match(doc, /standalone/i, 'standalone mode must state it asks all five');
});

test('techniques.md says scores persist at STANDARD/DEEP and the band is the price, not a cross-check', () => {
  const doc = ref('techniques.md');
  assert.match(doc, /STANDARD\/DEEP/);
  assert.match(doc, /persist/i);
  assert.doesNotMatch(doc, /soft cross-check/i, 'the band is the price now, not a cross-check against it');
  assert.doesNotMatch(doc, /XL 400-800h|XL 400–800 h/, 'hours calibration must be gone');
});

test('writing.md documents the score fields and the Tier rule', () => {
  const doc = ref('writing.md');
  for (const needle of ['`scores`', '`scoreNote`', '`scoreProvenance`', 'anchor', 'cite', 'Tier']) {
    assert.ok(doc.includes(needle), `writing.md missing: ${needle}`);
  }
  assert.match(doc, /Tier.*must (equal|match)/);
});

test('SKILL.md points the interview at the scoring guide and the review script', () => {
  const skill = readFileSync(new URL('../../FLOW.md', import.meta.url), 'utf8');
  assert.match(skill, /scoring-guide\.md/);
  assert.match(skill, /score-review\.mjs/);
});

// The level definitions for the five context factors live in the v2 workbook
// the page embeds (Project Roll-up F11:F15, rows in CONTEXT_FACTORS order).
// Read them from those bytes so the rubric cannot drift from the workbook.
function rollupDefinitions() {
  const html = readFileSync(new URL('../../assets/estimate-template.html', import.meta.url), 'utf8');
  const files = readZip(Buffer.from(/const XLSX_TEMPLATE = '([^']+)'/.exec(html)[1], 'base64'));
  const strings = [...files.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join('').replace(/&amp;/g, '&'));
  const sheet = files.get('xl/worksheets/sheet5.xml').toString('utf8');
  return [11, 12, 13, 14, 15].map((row) => {
    const idx = new RegExp(`<c r="F${row}"[^>]*t="s"[^>]*><v>(\\d+)</v>`).exec(sheet)[1];
    return strings[Number(idx)].split(' / ');
  });
}

test('the scoring guide carries the workbook\'s level definitions for every context factor', () => {
  const doc = ref('scoring-guide.md');
  const defs = rollupDefinitions();
  Object.keys(CONTEXT_FACTORS).forEach((key, i) => {
    const row = doc.split('\n').find((l) => l.startsWith(`| \`${key}\` |`));
    assert.ok(row, `scoring-guide.md has no rubric row for ${key}`);
    const cells = row.split('|').slice(2, -1).map((c) => c.trim());
    assert.deepEqual(cells, defs[i], `${key} levels differ from Project Roll-up F${11 + i}`);
  });
});

// Level 1 is the familiar, cheapest end (x1.00); level 3-4 is a stack new to
// the team (x1.35). A pick-list that runs the other way prices backwards.
test('interview.md asks stack familiarity with level 1 as the familiar stack', () => {
  const doc = ref('interview.md');
  const levels = rollupDefinitions()[1];
  levels.forEach((words, i) => {
    const re = new RegExp(`${i + 1}\\s+${words.replace(/ /g, '\\s+')}`, 'i');
    assert.ok(re.test(doc), `stack pick-list level ${i + 1} must read "${words}"`);
  });
  assert.doesNotMatch(doc, /never used it/i, 'level 1 is the familiar stack, not "never used it"');
});
