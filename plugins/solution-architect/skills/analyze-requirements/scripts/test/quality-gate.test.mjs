import { test } from 'node:test';
import assert from 'node:assert/strict';
import { violations, LIMITS } from '../lib/quality-gate.mjs';

// The span counter walks braces. Braces that live inside a regex, a string or a
// comment are not structure, and counting them makes a short function measure
// long — the overshoot runs on into whatever follows it.
test('a brace escaped inside a regex does not inflate the span', () => {
  const src = [
    'function short(s) {',
    "  return s.replace(/=>\\s*\\{/g, '');",
    '}',
    '',
    'function after() {',
    '  return 1;',
    '}',
  ].join('\n');
  assert.deepEqual(violations(src, { functionLines: 4 }), []);
});

test('a lone brace inside a string does not inflate the span', () => {
  const src = [
    'function short() {',
    "  return '{';",
    '}',
    '',
    'function after() {',
    ...Array(20).fill('  const x = 1;'),
    '}',
  ].join('\n');
  assert.deepEqual(violations(src, { functionLines: 22 }), []);
});

test('a brace in a comment does not inflate the span', () => {
  const src = [
    'function short() {',
    '  // opens with { and never closes',
    '  return 1;',
    '}',
    '',
    'function after() {',
    ...Array(20).fill('  const x = 1;'),
    '}',
  ].join('\n');
  assert.deepEqual(violations(src, { functionLines: 22 }), []);
});

// The limit is there to cap how much logic you hold in your head at once. A
// static HTML string is not logic, and neither is a comment — estimate's
// renderMethod is 30 lines of which 25 are prose inside one template literal.
test('a static template literal does not count toward function length', () => {
  const src = [
    'function render() {',
    '  return `',
    ...Array(30).fill('    <p>static copy</p>'),
    '  `;',
    '}',
  ].join('\n');
  assert.deepEqual(violations(src, { functionLines: 22 }), []);
});

test('a long comment block does not count toward function length', () => {
  const src = [
    'function short() {',
    ...Array(30).fill('  // explaining at length'),
    '  return 1;',
    '}',
  ].join('\n');
  assert.deepEqual(violations(src, { functionLines: 22 }), []);
});

test('a genuinely long function is still reported', () => {
  const src = ['function long() {', ...Array(30).fill('  const x = 1;'), '}'].join('\n');
  assert.deepEqual(violations(src, { functionLines: 22 }), ['function of 32 lines (max 22)']);
});

// The body opener is found as the first `{` after `function NAME`. When the
// first parameter is object-destructured, that `{` belongs to the parameter
// list, not the body — the brace-depth walk then closes on the parameter list
// and the real body is never measured.
test('a destructured first parameter does not truncate the measured body', () => {
  const src = ['function long({ a, b }) {', ...Array(25).fill('  const x = 1;'), '}'].join('\n');
  assert.deepEqual(violations(src, { functionLines: 22 }), ['function of 27 lines (max 22)']);
});

test('an omitted limit skips its check', () => {
  const src = ['function f(a, b, c, d) {', '  return a + b + c + d;', '}'].join('\n');
  assert.deepEqual(violations(src, { functionLines: 22 }), [], 'params not checked when absent');
  assert.deepEqual(violations(src, { params: 3 }), ['function with 4 params (max 3)']);
});

test('the module holds itself to the shared limits', () => {
  assert.equal(LIMITS.fileLines, 200);
  assert.equal(LIMITS.functionLines, 22);
});
