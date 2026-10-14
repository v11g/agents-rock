import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, stage } from './helpers.mjs';

const quote = (d) => d.problems[1].quotes[0];

test('a reworded quote is reported with the closest source sentence', () => {
  const r = check(stage((d) => { quote(d).text = 'When a ticket is lost the customer calls us.'; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^problems\[1\]\.quotes\[0\]: not word for word in C1; closest: "Dana: When a ticket gets lost the customer calls us and we have no idea where the cake is\."$/m);
});

test('normalised quotes match: line breaks, extra spaces, part of a sentence', () => {
  const r = check(stage((d) => {
    quote(d).text = 'When a ticket gets lost   the customer\ncalls us and we have no idea where the cake is.';
    d.problems[0].quotes[0].text = 'Last month we ran out twice on a Saturday';
  }));
  assert.equal(r.code, 0, r.err);
  const c = check(stage((d) => { quote(d).text = 'the customer calls us'; }));
  assert.equal(c.code, 0, c.err);
});

test('a missing source file is reported once', () => {
  const dir = stage();
  rmSync(join(dir, 'sources', 'C1.txt'));
  const r = check(dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /^sources: C1 file sources\/C1\.txt not found$/m);
});

test('a problem no feature or question points at is reported', () => {
  const r = check(stage((d) => {
    d.problems.push({ id: 'P3', text: 'We cannot see which cakes are custom', quotes: [{ source: 'C1', text: 'About 30% of orders are custom cakes.' }] });
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^P3: no feature or client question points at it$/m);
});

test('a client question alone covers a problem', () => {
  const r = check(stage((d) => {
    d.problems.push({ id: 'P3', text: 'We cannot see which cakes are custom', quotes: [{ source: 'C1', text: 'About 30% of orders are custom cakes.' }] });
    d.questions.push({ text: 'Last time a custom cake was late, where did it wait?', why: 'Shapes the custom-cake steps', assume: 'Same steps as other orders', refs: ['P3'] });
  }));
  assert.equal(r.code, 0, r.err);
});

test('limits: 7 problems, 9 assumptions, a 6-word step, 1- and 7-word feature names', () => {
  const r = check(stage((d) => {
    for (let n = 3; n <= 7; n++) d.problems.push({ id: `P${n}`, text: 'x', quotes: [quote(d)] });
    d.questions[0].refs = d.problems.map((p) => p.id);
    d.assumptions = Array.from({ length: 9 }, () => d.assumptions[0]);
    d.systems[0].workflows[0].steps[0] = 'Take the order in from WhatsApp';
    d.systems[0].features[0].name = 'Board';
    d.systems[1].features[0].name = 'Alert for flour when it drops low';
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^problems: 7, at most 6$/m);
  assert.match(r.err, /^assumptions: 9, at most 8$/m);
  assert.match(r.err, /^systems\[0\]\.workflows\[0\]: step "Take the order in from WhatsApp" has 6 words, at most 5$/m);
  assert.match(r.err, /^systems\[0\]\.features\[0\]: name "Board" has 1 words, 2 to 6$/m);
  assert.match(r.err, /^systems\[1\]\.features\[0\]: name "Alert for flour when it drops low" has 7 words, 2 to 6$/m);
});

test('no problems at all is reported', () => {
  const r = check(stage((d) => { d.problems = []; d.systems.forEach((s) => { s.problem = 'P1'; s.features = []; }); d.assumptions = []; d.questions = []; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^problems: 0, at least 1$/m);
});

test('a banned word outside quotes is reported with its place', () => {
  const r = check(stage((d) => {
    d.systems[0].purpose = 'A seamless way to track orders; closes P2';
    d.questions[0].assume = 'Some bags left';
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^systems\[0\]\.purpose: vague word "seamless"$/m);
  assert.match(r.err, /^questions\[0\]\.assume: vague word "some"$/m);
});

test('vague word inside quotes is allowed', () => {
  const r = check(stage((d) => {
    d.questions[0].text = 'You wrote "deliveries must be fast": by what time of day?';
    d.questions[0].why = 'Sets the promise in “quick” terms';
  }));
  assert.equal(r.code, 0, r.err);
});

test('banned words match whole words only', () => {
  const r = check(stage((d) => { d.systems[1].purpose = 'Keeps flour on hand for breakfast baking; closes P1'; }));
  assert.equal(r.code, 0, r.err);
});

function withNote(text, quotes) {
  const dir = stage((d) => {
    d.sources.push({ id: 'N1', kind: 'note', date: '2026-09-12', who: 'Dana Lee — reply', file: 'sources/N1.txt' });
    d.problems[0].quotes.push(...quotes.map((q) => ({ source: 'N1', text: q })));
  });
  writeFileSync(join(dir, 'sources', 'N1.txt'), text);
  return check(dir);
}

test('reply markers, dashes, case and wrapping quote marks still match', () => {
  const r = withNote('Hi,\n> We need the  orders\n> to arrive by 9am.\nThe oven broke — again.\n',
    ['we need the orders to arrive by 9am', '“the oven broke - again”']);
  assert.equal(r.code, 0, r.err);
});

test('a quote hint never carries a reply marker', () => {
  const r = withNote('Hi,\n> We need the orders to arrive by 9am.\n', ['we need lorries by 9am']);
  assert.equal(r.code, 1);
  assert.match(r.err, /closest: "We need the orders to arrive by 9am\."$/m);
});

test('a vague word in single quotes is allowed, an apostrophe is not a quote', () => {
  const ok = check(stage((d) => {
    d.questions[0].text = "You wrote 'fast': by what time of day?";
    d.questions[0].why = 'Sets the ‘quick’ promise';
  }));
  assert.equal(ok.code, 0, ok.err);
  const bad = check(stage((d) => { d.questions[0].assume = "Dana's cakes go out fast"; }));
  assert.match(bad.err, /^questions\[0\]\.assume: vague word "fast"$/m);
});

test('a workflow with no steps and a problem with no quote are reported', () => {
  const r = check(stage((d) => { d.systems[0].workflows[0].steps = []; d.problems[1].quotes = []; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^systems\[0\]\.workflows\[0\]: no steps$/m);
  assert.match(r.err, /^P2: no quote$/m);
});
