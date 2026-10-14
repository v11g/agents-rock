import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, py, stage } from './helpers.mjs';

test('the pass fixture is clean', () => {
  const r = check(stage());
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^draft clean$/m);
});

test('wrong arguments print usage and exit 2', () => {
  const r = py('check.py', ['--nope']);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage: check\.py --draft <draft\.json>/);
});

test('a file that is not JSON exits 1', () => {
  const dir = stage();
  writeFileSync(join(dir, 'draft.json'), '{ nope');
  const r = check(dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /draft\.json: /);
});

test('missing or mistyped fields are named with their place', () => {
  const r = check(stage((d) => { delete d.client; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^draft: client missing or not str$/m);
  const f = check(stage((d) => { delete d.systems[0].features[0].does; }));
  assert.match(f.err, /^systems\[0\]\.features\[0\]: does missing or not str$/m);
  const q = check(stage((d) => { d.questions[0].refs = 'P1'; }));
  assert.match(q.err, /^questions\[0\]: refs missing or not list$/m);
});

test('ids and kinds outside their lists are reported', () => {
  const r = check(stage((d) => {
    d.sources[0].kind = 'fax';
    d.problems[0].id = 'Problem1';
    d.systems[0].workflows[0].kind = 'loop';
    d.scope.exclusions[0].reason = 'nope';
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^sources: E1 kind fax is not email, call or note$/m);
  assert.match(r.err, /^problems: bad id Problem1$/m);
  assert.match(r.err, /^systems\[0\]\.workflows\[0\]: kind loop is not main, side or sub$/m);
  assert.match(r.err, /^scope\.exclusions\[0\]: reason nope is not owned-elsewhere, later-phase or no-detail$/m);
});

test('references to unknown sources, problems and features are reported', () => {
  const r = check(stage((d) => {
    d.systems[0].features[0].source = 'E9';
    d.systems[1].problem = 'P7';
    d.assumptions[0].feature = 'Nope';
    d.questions[0].refs = ['P1', 'X3'];
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^systems\[0\]\.features\[0\]: unknown source E9$/m);
  assert.match(r.err, /^systems\[1\]: unknown problem P7$/m);
  assert.match(r.err, /^assumptions\[0\]: unknown feature Nope$/m);
  assert.match(r.err, /^questions\[0\]: unknown ref X3$/m);
});

test('duplicate source and problem ids are reported', () => {
  const r = check(stage((d) => { d.sources[1].id = 'E1'; d.problems[1].id = 'P1'; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^sources: duplicate id E1$/m);
  assert.match(r.err, /^problems: duplicate id P1$/m);
});
