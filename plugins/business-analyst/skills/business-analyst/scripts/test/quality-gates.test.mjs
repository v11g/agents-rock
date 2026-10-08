import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEMPLATE_LIMITS, templateScripts, violations,
} from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/quality-gate.mjs';

// The review page's modules. checks.mjs predates the gates and is over them;
// it is not listed, and this work only shrinks it.
const MODULES = [
  'scripts/review.mjs', 'scripts/lib/review-data.mjs',
  'scripts/lib/review-page.mjs', 'scripts/lib/review-layout.mjs', 'scripts/lib/scope-render.mjs',
];
const base = new URL('../..', import.meta.url).pathname;

for (const file of MODULES) {
  test(`gates: ${file}`, () => {
    assert.deepEqual(violations(readFileSync(base + file, 'utf8')), []);
  });
}

for (const { file, js } of templateScripts(base)) {
  test(`gates: ${file.replace(base, '')}`, () => {
    assert.deepEqual(violations(js, TEMPLATE_LIMITS), []);
  });
}
