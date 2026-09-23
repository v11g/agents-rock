import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashText, sectionHashes } from '../lib/state.mjs';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/drift.mjs';
const ARCH = '## 1 Goals and Scope\n\na\n\n## 13 Quality Requirements and SLOs\n\nb\n';

// execFileSync throws on a non-zero exit, and the exit code is the contract
// here, so every run goes through this.
function run(args) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout };
  }
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

test('no --state is a usage error', () => {
  assert.equal(run(['--files', 'ARCHITECTURE.md']).code, 1);
});
