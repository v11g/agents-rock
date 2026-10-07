import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPackage } from '../lib/checks.mjs';
import { CASES, loadWorkflow } from './scope-cases.mjs';

test('the workflow pass pair has no findings', () => {
  const { pkg, md } = loadWorkflow();
  assert.deepEqual(checkPackage({ pkg, md }), []);
});

test('a classic package without scope fields is untouched', () => {
  const { pkg, md } = loadWorkflow();
  for (const k of ['systems', 'features', 'scopeMode', 'mapLabel']) delete pkg[k];
  const plain = md.replace(/<!-- scope:start -->[\s\S]*?<!-- scope:end -->\n*/, '').replace('scopeMode: workflow\n', '');
  const findings = checkPackage({ pkg, md: plain });
  assert.ok(findings.some((f) => f.includes('WF-002') && f.includes('absent')), 'classic still requires to-be workflow ids in md');
  assert.ok(!findings.some((f) => f.includes('scope')));
});

for (const c of CASES) {
  test(`scope rule: ${c.name}`, () => {
    const { pkg, md } = c.edit(loadWorkflow());
    const findings = checkPackage({ pkg, md });
    assert.ok(findings.includes(c.finding), `expected "${c.finding}" in:\n${findings.join('\n')}`);
  });
}
