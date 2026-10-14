import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const skill = () => readFileSync(at('SKILL.md'), 'utf8');
const FILES = ['steps/discover.md', 'steps/draft.md', 'steps/assumptions.md', 'steps/check.md',
  'references/rules.md', 'references/draft-schema.md', 'references/credits.md'];

test('SKILL.md front matter names the skill and its trigger', () => {
  const head = skill().split('---')[1];
  assert.match(head, /^name: draft-scope$/m);
  assert.match(head, /^description: .*emails.*call transcripts.*DOCX.*business-analyst/m);
});

test('SKILL.md points at every step and reference file, and each exists', () => {
  for (const f of FILES) {
    assert.ok(skill().includes(f), `SKILL.md does not mention ${f}`);
    assert.ok(existsSync(at(f)), `${f} missing`);
  }
});

test('SKILL.md names both script commands', () => {
  assert.match(skill(), /python3 scripts\/check\.py --draft /);
  assert.match(skill(), /python3 scripts\/build_docx\.py --draft .* --out /);
});

test('credits name the borrowed repo and its licence', () => {
  const credits = readFileSync(at('references/credits.md'), 'utf8');
  assert.match(credits, /phuryn\/pm-skills/);
  assert.match(credits, /MIT/);
});

test('the skill reads nothing from the business-analyst skill', () => {
  for (const f of ['SKILL.md', ...FILES]) {
    assert.doesNotMatch(readFileSync(at(f), 'utf8'), /skills\/business-analyst\//, f);
  }
});

test('discover note follows the summarize-interview template', () => {
  const note = readFileSync(at('steps/discover.md'), 'utf8');
  const labels = ['**Current Solution**:', '**What They Like About Current Solution**:',
    '**Problems With Current Solution**:', '**Key Insights**:', '**Action Items**:', '**Open points**:'];
  let at0 = -1;
  for (const l of labels) {
    const i = note.indexOf(l);
    assert.ok(i > at0, `${l} missing or out of order`);
    at0 = i;
  }
  assert.doesNotMatch(note, /^Quotes:/m);
  assert.match(note, /plain Markdown, the shape above without the surrounding code fence/);
});

test('skipped small talk is never mentioned, not even as skipped', () => {
  for (const f of ['steps/discover.md', 'steps/check.md']) {
    assert.match(readFileSync(at(f), 'utf8'), /never\s+mention\s+what\s+you\s+skipped/i, f);
  }
});
