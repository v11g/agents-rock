import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs';
const FRONT = '---\nelectedDocs: [{"name":"threat-model","elected":false,"reason":"r"},{"name":"interface-contract","elected":false,"reason":"r"},{"name":"estimation","elected":false,"reason":"r"},{"name":"domain-overview","elected":false,"reason":"r"}]\n---\n\n';
const PKG = {
  schemaVersion: '1.0', updated: '2026-10-01',
  requirements: [{ id: 'FR-001', text: 'Members book up to 4 courts per week.', label: 'confirmed', source: 'kickoff call 2026-09-20' }],
  nfrs: [{ id: 'NFR-001', area: 'availability', text: 'The booking page is up 99.95% of the time.', label: 'assumed' }],
};

function setUp(archRel, body, input = JSON.stringify(PKG)) {
  const dir = mkdtempSync(join(tmpdir(), 'ba-cli-'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'requirements.json'), input);
  writeFileSync(join(dir, archRel), FRONT + body);
  writeFileSync(join(dir, 'model.json'), JSON.stringify({ elements: {} }));
  return dir;
}

const row = (cell) => `## 2 Constraints\n\n| Constraint | src |\n| --- | --- |\n| Courts | ${cell} |\n`;
const run = (dir, archRel) => spawnSync('node', [CLI, '--root', dir,
  '--arch', join(dir, archRel), '--model', join(dir, 'model.json'),
  '--inputs', join(dir, 'requirements.json')], { encoding: 'utf8' });

test('a citation to a confirmed row passes', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [FR-001 · kickoff call 2026-09-20](requirements.json)'));
  const r = run(dir, 'ARCHITECTURE.md');
  assert.equal(r.status, 0, r.stdout);
});

test('a citation to an assumed row fails with its label', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [NFR-001 · 2026-10-01](requirements.json)'));
  const r = run(dir, 'ARCHITECTURE.md');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL \[quotes\] NFR-001 is assumed in requirements.json/m);
});

test('a reworded quote on a json citation fails once', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [FR-001 · kickoff call 2026-09-20](requirements.json) "up to five courts"'));
  const r = run(dir, 'ARCHITECTURE.md');
  assert.equal(r.status, 1);
  assert.equal(r.stdout.match(/^FAIL /gm).length, 1, r.stdout);
});

const Q = '"The page must show "open" 99.95% of the time."';
const q13 = (quote) => `## 13 Quality Requirements\n\n| Goal | Target | Brief says | src |\n| --- | --- | --- | --- |\n| Uptime | 99.95% | ${quote} | proposed |\n`;
const nfr = (label) => ({ ...PKG, nfrs: [{ ...PKG.nfrs[0], text: 'The page must show "open" 99.95% of the time.', label, source: 'kickoff call 2026-09-20' }] });

test('a Brief says quote from a confirmed row passes, even with a JSON-escaped quote', () => {
  const dir = setUp('ARCHITECTURE.md', q13(Q), JSON.stringify(nfr('confirmed')));
  assert.doesNotMatch(run(dir, 'ARCHITECTURE.md').stdout, /Brief says/);
});

test('a Brief says quote from an assumed row fails', () => {
  const dir = setUp('ARCHITECTURE.md', q13(Q), JSON.stringify(nfr('assumed')));
  assert.match(run(dir, 'ARCHITECTURE.md').stdout, /Brief says .* is in no input file/);
});

test('an inline quote on a confirmed citation cannot borrow a recommended row', () => {
  const pkg = { ...PKG, requirements: [...PKG.requirements, { id: 'FR-003', text: 'Members pay a deposit', label: 'recommended' }] };
  const dir = setUp('ARCHITECTURE.md', row('stated [FR-001 · kickoff call 2026-09-20](requirements.json) "Members pay a deposit"'), JSON.stringify(pkg));
  const r = run(dir, 'ARCHITECTURE.md');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL \[quotes\]/m);
});

test('a citation label that is not the row cite fails', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [FR-001 · made-up source](requirements.json)'));
  assert.match(run(dir, 'ARCHITECTURE.md').stdout, /does not match requirements.json; cite it as FR-001 · kickoff call 2026-09-20/);
});

test('citation paths resolve from a nested ARCHITECTURE.md', () => {
  const dir = setUp('docs/ARCHITECTURE.md', row('stated [NFR-001 · 2026-10-01](../requirements.json)'));
  const r = run(dir, 'docs/ARCHITECTURE.md');
  assert.match(r.stdout, /NFR-001 is assumed/);
});

test('a json input that is not a package is plain text, not a crash', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [C9 · 2026-10-01](requirements.json) "port"'), '{"port": 8080');
  const r = run(dir, 'ARCHITECTURE.md');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('valid json that is not a package is plain text, not a crash', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [C9 · 2026-10-01](requirements.json) "port"'), '{"port": 8080}');
  const r = run(dir, 'ARCHITECTURE.md');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
