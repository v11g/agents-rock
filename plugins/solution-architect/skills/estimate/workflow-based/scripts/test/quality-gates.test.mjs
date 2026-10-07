import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEMPLATE_LIMITS, moduleFiles, templateScripts, violations,
} from '../../../../analyze-requirements/scripts/lib/quality-gate.mjs';

const base = new URL('../..', import.meta.url).pathname;

for (const file of moduleFiles(base, ['scripts/lib', 'scripts'])) {
  test(`gates: ${file.replace(base, '')}`, () => {
    assert.deepEqual(violations(readFileSync(file, 'utf8')), []);
  });
}

for (const { file, js } of templateScripts(base)) {
  test(`gates: ${file.replace(base, '')}`, () => {
    assert.deepEqual(violations(js, TEMPLATE_LIMITS), []);
  });
}

const xlsxExport = new URL('../../../shared/assets/xlsx-export.js', import.meta.url).pathname;
test('gates: shared/assets/xlsx-export.js', () => {
  assert.deepEqual(violations(readFileSync(xlsxExport, 'utf8'), TEMPLATE_LIMITS), []);
});
