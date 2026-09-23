import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = 'plugins/solution-architect/skills/analyze-requirements/scripts';
const ARCH = `---
name: atlas
docVersion: 1.2.0
---

# Atlas Architecture

## 1 Goals and Scope

Assign jobs to drivers.

## 13 Quality Requirements and SLOs

p99 under 200 ms.
`;
const ADR = '# ADR 0001: Use Stripe\n\n## Status\n\nAccepted\n\n## Context\n\nCheckout needs a processor.\n';
const FILES = ['ARCHITECTURE.md', 'docs/adr/0001-stripe.md'];

function run(script, args) {
  const { status, stdout, stderr } = spawnSync('node', [`${BIN}/${script}`, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { code: status, stdout, stderr };
}

// What step 5 leaves on disk: the package, and nothing recorded about it yet.
function packageDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rerun-safety-record-'));
  mkdirSync(join(dir, 'docs', 'adr'), { recursive: true });
  writeFileSync(join(dir, 'ARCHITECTURE.md'), ARCH);
  writeFileSync(join(dir, 'docs', 'adr', '0001-stripe.md'), ADR);
  return dir;
}

const record = (dir, files = FILES) => run('record.mjs', ['--state', join(dir, 'architecture-state.json'), '--files', ...files]);
const gate = (dir, files = FILES) => run('drift.mjs', ['--state', join(dir, 'architecture-state.json'), '--files', ...files]);
const stateOf = (dir) => JSON.parse(readFileSync(join(dir, 'architecture-state.json'), 'utf8'));

// The round trip the whole feature rests on: run 1 records, run 2 recognises
// its own output. Without the writer, run 2 sees no state at all.
test('a recorded package comes back unchanged', () => {
  const dir = packageDir();
  assert.equal(record(dir).code, 0);
  const { code, stdout } = gate(dir, ['ARCHITECTURE.md']);
  assert.equal(code, 0);
  assert.match(stdout, /ARCHITECTURE\.md\s+unchanged/);
});

// The bug the branch exists for, with the writing end attached: before this
// script, run 1 recorded nothing and run 2 cleared the hand edit for overwrite.
test('recording is what makes a later hand edit report drifted', () => {
  const dir = packageDir();
  record(dir);
  writeFileSync(join(dir, 'ARCHITECTURE.md'), ARCH.replace('200 ms', '150 ms'));
  const { code, stdout } = gate(dir, ['ARCHITECTURE.md']);
  assert.equal(code, 2);
  assert.match(stdout, /ARCHITECTURE\.md\s+drifted/);
  assert.match(stdout, /changed: §13/);
});

test('the record carries every field the next run reads', () => {
  const dir = packageDir();
  record(dir);
  const state = stateOf(dir);
  assert.match(state._generated, /do not edit/);
  assert.equal(state.revision, 1);
  assert.match(state.updated, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  assert.equal(state.docVersion, '1.2.0');
  assert.equal(state.gitCommit, null, 'outside a repository there is no commit');
  assert.deepEqual(Object.keys(state.files), FILES);
  assert.match(state.files['ARCHITECTURE.md'].hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(state.files['ARCHITECTURE.md'].sections), ['1', '13']);
});

// Only ARCHITECTURE.md has a spine to cut on; an ADR carries a status instead,
// and that status is what exempts it from being rewritten.
test('an ADR records the status its document declares', () => {
  const dir = packageDir();
  record(dir);
  const entry = stateOf(dir).files['docs/adr/0001-stripe.md'];
  assert.equal(entry.status, 'accepted');
  assert.equal(entry.sections, undefined);
});

test('each run bumps the revision and keeps earlier files recorded', () => {
  const dir = packageDir();
  record(dir);
  assert.equal(record(dir, ['ARCHITECTURE.md']).code, 0);
  const state = stateOf(dir);
  assert.equal(state.revision, 2);
  assert.deepEqual(Object.keys(state.files), FILES);
});

test('inside a repository the commit is recorded', () => {
  const dir = packageDir();
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('add', 'ARCHITECTURE.md');
  git('commit', '-qm', 'seed');
  record(dir);
  assert.equal(stateOf(dir).gitCommit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim());
});

// The one record of what the last run wrote. Renaming over it resets the
// revision and takes the bytes with it; drift.mjs already refuses to treat a
// corrupt file as absent-and-forgotten, and the writer is where that rule can
// be enforced in code rather than prose.
test('a corrupt state file is refused, not overwritten', () => {
  const dir = packageDir();
  const statePath = join(dir, 'architecture-state.json');
  writeFileSync(statePath, '{ not json');
  const { code, stderr } = record(dir);
  assert.notEqual(code, 0);
  assert.match(stderr, /unreadable/);
  assert.equal(readFileSync(statePath, 'utf8'), '{ not json', 'never deleted');
});

test('recording nothing is a usage error', () => {
  const dir = packageDir();
  for (const argv of [['--files', 'ARCHITECTURE.md'], ['--state', join(dir, 'architecture-state.json')]]) {
    const { code, stderr } = run('record.mjs', argv);
    assert.equal(code, 1, argv.join(' '));
    assert.match(stderr, /^usage:/m);
  }
});
