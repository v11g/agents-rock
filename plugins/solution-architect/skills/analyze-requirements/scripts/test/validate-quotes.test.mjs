import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize, parseCitations, closestSentence, briefQuotesOf, validateQuotes,
} from '../lib/validate-quotes.mjs';

const C1 = 'Maya: We open sales at 10am sharp. For a headline act we get ten times the orders\nin the first five minutes.\nMaya: We don’t want to touch card data.';
const sources = new Map([['inputs/C1-kickoff-call.txt', C1]]);
const cite = (quote) => ({ label: 'C1 · 2026-09-10', path: 'inputs/C1-kickoff-call.txt', quote });

test('normalize folds curly quotes and whitespace', () => {
  assert.equal(normalize('  don’t  “x”\n y '), 'don\'t "x" y');
});

test('parseCitations reads label, path without fragment, and quote', () => {
  const md = '| a | stated [C1 · 2026-09-10](inputs/C1.txt) "ten times" |\n| b | stated [Q3 · 2026-10-14](interview-log.md#q3) |';
  assert.deepEqual(parseCitations(md), [
    { label: 'C1 · 2026-09-10', path: 'inputs/C1.txt', quote: 'ten times' },
    { label: 'Q3 · 2026-10-14', path: 'interview-log.md', quote: null },
  ]);
});

test('passes an exact quote, a wrapped quote, and a straight-quoted apostrophe', () => {
  const citations = [
    cite('We open sales at 10am sharp.'),
    cite('ten times the orders in the first five minutes'),
    cite("We don't want to touch card data."),
  ];
  assert.deepEqual(validateQuotes({ citations, briefQuotes: [], sources }), []);
});

test('fails a reworded quote and names the closest sentence', () => {
  const out = validateQuotes({ citations: [cite('ten times more orders in five minutes')], briefQuotes: [], sources });
  assert.equal(out.length, 1);
  assert.equal(out[0].check, 'quotes');
  assert.match(out[0].message, /not found in inputs\/C1-kickoff-call\.txt; closest: "For a headline act/);
});

test('is case-sensitive', () => {
  assert.equal(validateQuotes({ citations: [cite('we open sales at 10am sharp.')], briefQuotes: [], sources }).length, 1);
});

test('skips interview citations and citations to files not loaded', () => {
  const citations = [
    { label: 'Q3', path: 'interview-log.md', quote: null },
    { label: 'E9', path: 'inputs/E9.md', quote: 'anything' },
  ];
  assert.deepEqual(validateQuotes({ citations, briefQuotes: [], sources }), []);
});

test('Brief says quotes must appear in some input, and are skipped with no inputs', () => {
  assert.deepEqual(validateQuotes({ citations: [], briefQuotes: ['10am sharp'], sources }), []);
  const out = validateQuotes({ citations: [], briefQuotes: ['sold out in seconds'], sources });
  assert.match(out[0].message, /Brief says "sold out in seconds" is in no input file/);
  assert.deepEqual(validateQuotes({ citations: [], briefQuotes: ['anything'], sources: new Map() }), []);
});

test('briefQuotesOf reads the §13 Brief says column', () => {
  const t = {
    section: '13 Quality Requirements and SLOs',
    headers: ['Goal', 'Target', 'Brief says', 'src'],
    rows: [['Speed', 't', '"10am sharp"', 'stated'], ['Uptime', 't', '—', 'stated'], ['Not provided — x', '', '', 'stated']],
  };
  assert.deepEqual(briefQuotesOf([t]), ['10am sharp']);
  assert.deepEqual(briefQuotesOf([]), []);
});

test('closestSentence picks the sentence sharing most words', () => {
  assert.match(closestSentence(C1, 'orders in five minutes'), /^For a headline act/);
});

test('briefQuotesOf strips curly surrounding quotes', () => {
  const t = {
    section: '13 Quality Requirements and SLOs',
    headers: ['Goal', 'Target', 'Brief says', 'src'],
    rows: [['Speed', 't', '“10am sharp”', 'stated']],
  };
  const briefQuotes = briefQuotesOf([t]);
  assert.deepEqual(briefQuotes, ['10am sharp']);
  assert.deepEqual(validateQuotes({ citations: [], briefQuotes, sources }), []);
});
