import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
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

// `gitCommit` is HEAD as it stood when run 1 finished — before anyone committed
// what run 1 had just written. Diffing against it renders the whole generated
// package as additions, and the one line a person must judge is lost in it.
function committedPackage() {
  const dir = packageDir(ARCH);
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  writeFileSync(join(dir, 'README.md'), 'seed\n');
  git('add', 'README.md');
  git('commit', '-qm', 'seed');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  writeFileSync(join(dir, 'architecture-state.json'), JSON.stringify({
    revision: 1,
    gitCommit: head,
    files: { 'ARCHITECTURE.md': { hash: hashText(ARCH), sections: sectionHashes(ARCH) } },
  }));
  git('add', 'ARCHITECTURE.md');
  git('commit', '-qm', 'the generated package');
  return dir;
}

test('the diff shows the hand edit, not the whole generated package', () => {
  const dir = committedPackage();
  writeFileSync(join(dir, 'ARCHITECTURE.md'), ARCH.replace('\nb\n', '\nedited by hand\n'));
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'ARCHITECTURE.md']);
  assert.equal(code, 2);
  assert.match(stdout, /^\s*\+edited by hand$/m);
  assert.doesNotMatch(stdout, /^\s*\+## 1 Goals and Scope$/m);
});

// The spec's other git row: a repository whose package was never committed has
// no old bytes to show, so the section numbers are all the reader gets.
test('an uncommitted package falls back to section numbers', () => {
  const dir = committedPackage();
  execFileSync('git', ['rm', '-q', '--cached', 'ARCHITECTURE.md'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-qm', 'drop it'], { cwd: dir, stdio: 'ignore' });
  writeFileSync(join(dir, 'ARCHITECTURE.md'), ARCH.replace('\nb\n', '\nedited by hand\n'));
  const { code, stdout } = run(['--state', join(dir, 'architecture-state.json'), '--files', 'ARCHITECTURE.md']);
  assert.equal(code, 2);
  assert.match(stdout, /changed: §13/);
});

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

// A gate that a typo turns into a clean bill of health fails the wrong way: an
// empty write set prints nothing and exits 0, which reads as "all clear".
test('an empty file list is a usage error, not a clean bill of health', () => {
  const dir = packageDir(ARCH);
  const state = join(dir, 'architecture-state.json');
  for (const argv of [['--state', state], ['--state', state, '--files'], ['--state', state, '--file', 'ARCHITECTURE.md']]) {
    const { code, stderr } = run(argv);
    assert.equal(code, 1, argv.join(' '));
    assert.match(stderr, /^usage:/m);
  }
});
