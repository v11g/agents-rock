import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildInputs } from '../lib/inputs.mjs';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs';
const FRONT = '---\nelectedDocs: [{"name":"threat-model","elected":false,"reason":"r"},{"name":"interface-contract","elected":false,"reason":"r"},{"name":"estimation","elected":false,"reason":"r"},{"name":"domain-overview","elected":false,"reason":"r"}]\n---\n\n';
const CALL = 'Maya: We pay for Azure already, so it has to run there.\n';

function setUp(archRel, body) {
  const dir = mkdtempSync(join(tmpdir(), 'quotes-cli-'));
  mkdirSync(join(dir, 'inputs'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'inputs', 'C1-kickoff-call.txt'), CALL);
  writeFileSync(join(dir, archRel), FRONT + body);
  writeFileSync(join(dir, 'model.json'), JSON.stringify({ elements: {} }));
  return dir;
}

const row = (cell) => `## 2 Constraints\n\n| Constraint | src |\n| --- | --- |\n| Azure | ${cell} |\n`;
const run = (dir, archRel, inputs) => spawnSync('node', [CLI, '--root', dir,
  '--arch', join(dir, archRel), '--model', join(dir, 'model.json'),
  ...(inputs ? ['--inputs', join(dir, 'inputs', 'C1-kickoff-call.txt')] : [])], { encoding: 'utf8' });

test('exact quote passes with no provenance warning', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "it has to run there"'));
  const r = run(dir, 'ARCHITECTURE.md', true);
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout, /WARN \[provenance\]/);
});

test('reworded quote fails with the closest sentence', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "it must run on Azure"'));
  const r = run(dir, 'ARCHITECTURE.md', true);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL \[quotes\] "it must run on Azure" not found/m);
});

test('citation to an input not passed with --inputs fails the links check', () => {
  const dir = setUp('ARCHITECTURE.md', row('stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "it has to run there"'));
  const r = run(dir, 'ARCHITECTURE.md', false);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL \[links\] .*target file missing/m);
});

test('citation paths resolve from a nested ARCHITECTURE.md', async () => {
  const dir = setUp('docs/ARCHITECTURE.md', row('stated [C1 · 2026-09-10](../inputs/C1-kickoff-call.txt) "it has to run there"'));
  const inputs = await buildInputs({
    root: dir, archPath: join(dir, 'docs', 'ARCHITECTURE.md'), modelPath: join(dir, 'model.json'),
    inputPaths: [join(dir, 'inputs', 'C1-kickoff-call.txt')],
  });
  assert.equal(inputs.citations[0].path, 'inputs/C1-kickoff-call.txt');
  assert.ok(inputs.sources.has('inputs/C1-kickoff-call.txt'));
  assert.ok(inputs.files.includes('inputs/C1-kickoff-call.txt'));
});
