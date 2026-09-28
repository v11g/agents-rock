import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JARGON } from '../lib/jargon.mjs';

const doc = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const REFS = ['references/interview.md', 'references/writing.md', 'references/review.md'];

test('no skill doc carries placeholders', () => {
  for (const f of ['SKILL.md', 'README.md', ...REFS]) {
    assert.doesNotMatch(doc(f), /\bTBD\b|\bTODO\b/, f);
  }
});

test('SKILL.md names the pipeline, both hard prerequisites, and the review gate', () => {
  const skill = doc('SKILL.md');
  assert.match(skill, /^name: proposal$/m);
  for (const needle of ['ARCHITECTURE.md', 'estimation.json', 'derive.mjs', 'validate.mjs',
    'render.mjs', 'serve.mjs', 'references/interview.md', 'references/writing.md',
    'references/review.md', 'mermaid', 'Human review']) {
    assert.ok(skill.includes(needle), `SKILL.md missing: ${needle}`);
  }
});

test('interview.md carries the prereq gate, tech levels, and profile scopes', () => {
  const d = doc('references/interview.md');
  for (const needle of ['non-tech', 'low-tech', 'technical',
    'valid', 'proposal-profile.json', '.claude/', 'stop']) {
    assert.ok(d.includes(needle), `interview.md missing: ${needle}`);
  }
  assert.doesNotMatch(d, /scenario/i);
});

test('writing.md states every validator rule family and the nine sections', () => {
  const d = doc('references/writing.md');
  for (const needle of ['Executive Summary', 'Background & Objectives', 'Proposed Solution',
    'Scope', 'Out of Scope & Assumptions', 'Delivery Approach', 'Investment & Timeline',
    'About', 'Next Steps', 'valid_until', 'jargon_allow', 'proposal-figures.json',
    'Never write a number', 'rates', 'carries no timeline']) {
    assert.ok(d.includes(needle), `writing.md missing: ${needle}`);
  }
  assert.doesNotMatch(d, /\*\*Team\*\*/);
  for (const term of ['kubernetes', 'api']) {
    assert.ok(JARGON.includes(term), `jargon list lost its anchor term: ${term}`);
  }
});

test('review.md dispatches a fresh-eyes subagent with the five-point charter', () => {
  const d = doc('references/review.md');
  for (const needle of ['fresh', 'tech level', 'hype', 'leak', 'contradiction', 'one']) {
    assert.ok(d.toLowerCase().includes(needle), `review.md missing: ${needle}`);
  }
  // The estimate produces no timeline; a review that asks for one pushes the
  // author to promise a duration nothing downstream can back.
  assert.doesNotMatch(d, /how long/i, 'review.md must not ask how long delivery takes');
  assert.match(d, /delivery duration or date/, 'a duration must be listed as a leak');
});
