import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindOf, labelOf } from '../lib/doc-kinds.mjs';

// Index 0 is ARCHITECTURE.md by construction — render.mjs already flags it this
// way with `spine: i === 0`. Nothing reads its filename, because a target repo
// is free to call it something else.
test('the first document is the spine whatever it is called', () => {
  assert.equal(kindOf('ARCHITECTURE.md', 0), 'spine');
  assert.equal(kindOf('docs/design/system.md', 0), 'spine');
});

test('the three fixed-name companions are recognised', () => {
  assert.equal(kindOf('docs/threat-model.md', 1), 'threat-model');
  assert.equal(kindOf('docs/estimation.md', 2), 'estimation');
  assert.equal(kindOf('docs/DOMAIN-OVERVIEW.md', 3), 'domain-overview');
});

// A repo that writes THREAT-MODEL.md is writing the same document.
test('companion matching ignores case', () => {
  assert.equal(kindOf('docs/THREAT-MODEL.md', 1), 'threat-model');
  assert.equal(kindOf('docs/Domain-Overview.md', 2), 'domain-overview');
});

// Everything with no kind renders exactly as it does today. These are the four
// document classes the spec deliberately excludes, and each one silently
// acquiring an explainer is the regression this test exists to catch.
test('excluded document classes get no kind', () => {
  assert.equal(kindOf('docs/adr/0001-use-postgres.md', 1), undefined);
  assert.equal(kindOf('src/billing/CONTEXT.md', 2), undefined);
  assert.equal(kindOf('CONTEXT-MAP.md', 3), undefined);
  assert.equal(kindOf('docs/openapi.yaml', 4), undefined);
  assert.equal(kindOf('docs/whatever.md', 5), undefined);
});

// A companion name at index 0 is still the spine: the position wins, because a
// set whose root document is called estimation.md would otherwise lose its 16
// section explainers and gain one wrong one.
test('position beats filename', () => {
  assert.equal(kindOf('docs/estimation.md', 0), 'spine');
});

test('validation-plan is a labelled companion', () => {
  assert.equal(kindOf('docs/validation-plan.md', 1), 'validation-plan');
  assert.equal(labelOf('validation-plan'), 'Validation Plan');
});
