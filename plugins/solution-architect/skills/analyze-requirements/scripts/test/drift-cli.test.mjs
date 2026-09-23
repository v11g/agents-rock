import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashText, sectionHashes } from '../lib/state.mjs';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/drift.mjs';
const ARCH = '## 1 Goals and Scope\n\na\n\n## 13 Quality Requirements and SLOs\n\nb\n';

// spawnSync never throws on a non-zero exit and always hands back both
// streams, so the usage test can assert on stderr instead of only inferring
// "some" failure from the exit code. stdio is explicit so the usage text is
// captured rather than leaking into the suite's own output.
function run(args) {
  const { status, stdout, stderr } = spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { code: status, stdout, stderr };
}

function packageDir(archText) {
  const dir = mkdtempSync(join(tmpdir(), 'rerun-safety-cli-'));
  writeFileSync(join(dir, 'ARCHITECTURE.md'), archText);
  writeFileSync(join(dir, 'architecture-state.json'), JSON.stringify({
    revision: 1,
    files: { 'ARCHITECTURE.md': { hash: hashText(ARCH), sections: sectionHashes(ARCH) } },
  }));
  return dir;
}

test('an untouched package exits zero and says so', () => {
  const dir = packageDir(ARCH);
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'ARCHITECTURE.md']);
  assert.equal(code, 0);
  assert.match(stdout, /ARCHITECTURE\.md\s+unchanged/);
});

// The exit code carries the signal: an agent that only checks it must still
// stop, because the whole point is that nothing is written before the question.
test('drift exits 2 and names the changed sections', () => {
  const dir = packageDir(ARCH.replace('\nb\n', '\nedited by hand\n'));
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'ARCHITECTURE.md']);
  assert.equal(code, 2);
  assert.match(stdout, /ARCHITECTURE\.md\s+drifted/);
  assert.match(stdout, /changed: §13/);
  assert.doesNotMatch(stdout, /§1\b/);
});

test('a file with no state entry is untracked and does not fail the run', () => {
  const dir = packageDir(ARCH);
  writeFileSync(join(dir, 'notes.md'), 'hand written\n');
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'notes.md']);
  assert.equal(code, 0);
  assert.match(stdout, /notes\.md\s+untracked/);
});

test('a missing state file is a first run, not a failure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rerun-safety-first-'));
  writeFileSync(join(dir, 'ARCHITECTURE.md'), ARCH);
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'ARCHITECTURE.md']);
  assert.equal(code, 0);
  assert.match(stdout, /first run/);
});

// A new ADR on run 2 has no entry and no file. It is not "not ours" — nobody
// has one — so the gate must not hand the agent a verdict that forbids it.
test('a file that does not exist yet is new, not untracked', () => {
  const dir = packageDir(ARCH);
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'docs/adr/0002-new.md']);
  assert.equal(code, 0);
  assert.match(stdout, /0002-new\.md\s+new/);
});

// "nothing blocked" means the run is not halted, not that nothing is judged.
// Point the skill at a directory that already holds a hand-written package and
// every file in it must still come back untracked — that is the property that
// makes a first run against someone else's documents safe.
test('a first run still classifies the files it was given', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rerun-safety-first-'));
  writeFileSync(join(dir, 'ARCHITECTURE.md'), ARCH);
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'ARCHITECTURE.md']);
  assert.equal(code, 0);
  assert.match(stdout, /ARCHITECTURE\.md\s+untracked/);
});

test('no --state is a usage error', () => {
  const { code, stderr } = run(['--files', 'ARCHITECTURE.md']);
  assert.equal(code, 1);
  assert.match(stderr, /^usage:/m);
});
