import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStrategy } from '../lib/validate-strategy.mjs';

const GOALS = '13 Quality Requirements and SLOs';
const STRATEGY = '4 Solution Strategy';
const goals = (...cells) => ({
  section: GOALS, headers: ['Goal', 'Target', 'Brief says', 'src'],
  rows: cells.map((c) => [c, 't', 'q', 'stated']),
});
const strategy = (...serves) => ({
  section: STRATEGY, headers: ['Decision', 'Serves', 'ADR', 'src'],
  rows: serves.map((s, i) => [`decision ${i}`, s, 'ADR-001', 'proposed']),
});
const THREE = goals('Uptime', 'Integration', 'Speed (gives way first)');
const render = (t) => [
  `## ${t.section}`, '', `| ${t.headers.join(' | ')} |`, `|${t.headers.map(() => '---').join('|')}|`,
  ...t.rows.map((r) => `| ${r.join(' | ')} |`), '',
].join('\n');
const run = (tables, archMd = '') => validateStrategy({ tables: [], archMd: tables.map(render).join('\n') + archMd });
const fails = (fs) => fs.filter((f) => f.level !== 'warn');

test('passes three goals, one giving way, every goal served', () => {
  assert.deepEqual(run([THREE, strategy('Uptime, Integration', 'Speed')]), []);
});

test('fails when §13 does not have exactly three rows', () => {
  const out = run([goals('Uptime', 'Speed (gives way first)'), strategy('Uptime, Speed')]);
  assert.match(out[0].message, /2 goal rows, expected 3/);
});

test('fails when no goal or two goals give way first', () => {
  assert.equal(run([goals('A', 'B', 'C'), strategy('A, B, C')]).length, 1);
  const two = goals('A (gives way first)', 'B (gives way first)', 'C');
  assert.match(run([two, strategy('A, B, C')])[0].message, /marks 2 goals/);
});

test('Not provided rows count as rows but not as goals', () => {
  const t = goals('Reliability', 'Simplicity (gives way first)', 'Not provided — user declined');
  assert.deepEqual(run([t, strategy('Reliability', 'Simplicity')]), []);
  const one = goals('Reliability', 'Not provided — a', 'Not provided — b');
  assert.deepEqual(run([one, strategy('Reliability')]), []);
});

test('fails a decision serving a non-goal, and one serving nothing', () => {
  const out = run([THREE, strategy('Uptime, Integration, Speed', 'Growth', '')]);
  assert.equal(out.length, 2);
  assert.match(out[0].message, /"growth", not a §13 goal/);
  assert.match(out[1].message, /serves no goal/);
});

test('fails a goal no decision serves', () => {
  const out = run([THREE, strategy('Uptime, Integration')]);
  assert.match(out[0].message, /goal "speed" is served by no §4 decision/);
});

test('matches serves names case-insensitively and with the gives-way label', () => {
  assert.deepEqual(run([THREE, strategy('uptime, INTEGRATION', 'Speed (gives way first)')]), []);
});

test('fails a §4 table with no Serves column', () => {
  const t = { section: STRATEGY, headers: ['Decision', 'ADR', 'src'], rows: [['d', 'a', 'proposed']] };
  assert.match(run([THREE, t])[0].message, /no Serves column/);
});

test('legacy §13 (no Goal column) warns once and skips serves checks', () => {
  const legacy = { section: GOALS, headers: ['Requirement', 'Target', 'src'], rows: [['r', 't', 'stated']] };
  const out = run([legacy, strategy('anything')]);
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'warn');
  assert.match(out[0].message, /predates top-3 goals/);
});

test('§4 written as bullets warns, even under a ### subheading', () => {
  const md = '## 4 Solution Strategy\n\n### Notes\n\n- Single app → ADR-001\n\n## 5 Architecture Model\n';
  const out = run([THREE], md);
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'warn');
  assert.match(out[0].message, /§4 is a list/);
});

test('no findings when §4 and §13 are absent or Not applicable', () => {
  assert.deepEqual(run([], '## Core Components\n'), []);
  const md = '## 4 Solution Strategy\n\nNot applicable — single script\n\n## 13 Quality Requirements\n\nNot applicable — x\n';
  assert.deepEqual(run([], md), []);
});

test('fails never carry the warn level', () => {
  assert.equal(fails(run([THREE, strategy('Uptime')])).length, 2);
});

const GOAL_TABLE = '| Goal | Target | Brief says | src |\n|---|---|---|---|\n| A | t | q | stated |\n| B | t | q | stated |\n| C (gives way first) | t | q | stated |\n';
const SERVES = (rows) => `| Decision | Serves | ADR | src |\n|---|---|---|---|\n${rows}\n`;

test('checks a §4 table under a ### subheading', () => {
  const md = `## 4 Solution Strategy\n\n### Key decisions\n\n${SERVES('| d | A | ADR-1 | proposed |')}\n## 13 Quality Requirements\n\n${GOAL_TABLE}`;
  const out = validateStrategy({ tables: [], archMd: md });
  assert.equal(fails(out).length, 2);
  assert.match(out[0].message, /goal "b" is served by no §4 decision/);
});

test('finds the Goal table when another table comes first in §13', () => {
  const slo = '| SLO | Target | src |\n|---|---|---|\n| p95 | 1s | stated |\n\n';
  const md = `## 4 Solution Strategy\n\n${SERVES('| d | A | ADR-1 | proposed |')}\n## 13 Quality Requirements\n\n${slo}${GOAL_TABLE}`;
  const out = validateStrategy({ tables: [], archMd: md });
  assert.ok(out.every((f) => f.level !== 'warn'));
  assert.equal(out.length, 2);
});

test('skips serves checks when every §13 goal is Not provided', () => {
  const t = goals('Not provided — a', 'Not provided — b', 'Not provided — c');
  assert.deepEqual(run([t, strategy('Growth', '')]), []);
});

test('ignores markdown emphasis in goal and serves cells', () => {
  const t = goals('**Uptime**', '_Integration_', 'Speed *(gives way first)*');
  assert.deepEqual(run([t, strategy('Uptime, **Integration**', 'Speed')]), []);
});
