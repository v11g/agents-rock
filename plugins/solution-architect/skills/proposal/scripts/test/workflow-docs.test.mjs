import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('SKILL.md routes a workflow estimate to references/workflow.md', () => {
  const skill = doc('SKILL.md');
  assert.match(skill, /scopeMode` is `"workflow"` → follow\s+`references\/workflow\.md`/);
  assert.ok(skill.includes('proposal-inputs.json'));
});

test('workflow.md carries the inputs contract, both commands and the hand-over', () => {
  const d = doc('references/workflow.md');
  for (const needle of ['proposal-inputs.json', 'scripts/validate.mjs --estimation', '--inputs', 'scripts/render.mjs --estimation',
    '--mermaid-bundle', 'Download PDF', 'Download DOCX', 'USD', 'jargonAllow', 'techLevel', 'demonstrates', 'no proposal.md']) {
    assert.ok(d.includes(needle), `workflow.md missing: ${needle}`);
  }
  assert.doesNotMatch(d, /\bTBD\b|\bTODO\b/);
});

test('review.md has a workflow charter that reads the rendered page', () => {
  const d = doc('references/review.md');
  assert.match(d, /## Workflow mode[\s\S]*dist\/proposal\.html/);
});
