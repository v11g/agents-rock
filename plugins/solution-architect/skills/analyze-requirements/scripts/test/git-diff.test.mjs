import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitDiff } from '../lib/git-diff.mjs';

function repoWithCommit() {
  const root = mkdtempSync(join(tmpdir(), 'rerun-safety-git-'));
  const run = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  run('init', '-q');
  run('config', 'user.email', 'test@example.com');
  run('config', 'user.name', 'Test');
  writeFileSync(join(root, 'ARCHITECTURE.md'), '# Doc\n\nbody\n');
  run('add', 'ARCHITECTURE.md');
  run('commit', '-qm', 'seed');
  return root;
}

test('an uncommitted edit comes back as a diff', () => {
  const root = repoWithCommit();
  writeFileSync(join(root, 'ARCHITECTURE.md'), '# Doc\n\nedited\n');
  const out = gitDiff({ root, file: 'ARCHITECTURE.md' });
  assert.match(out, /^-body$/m);
  assert.match(out, /^\+edited$/m);
});

// The file is committed, so `git diff` alone reports nothing. Diffing against
// the commit the state file recorded is what surfaces the change.
test('a committed edit is found by diffing against the recorded commit', () => {
  const root = repoWithCommit();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  writeFileSync(join(root, 'ARCHITECTURE.md'), '# Doc\n\nedited\n');
  execFileSync('git', ['commit', '-aqm', 'edit'], { cwd: root, stdio: 'ignore' });
  assert.equal(gitDiff({ root, file: 'ARCHITECTURE.md' }), null);
  assert.match(gitDiff({ root, file: 'ARCHITECTURE.md', since: head }), /^\+edited$/m);
});

// Outside a repo the caller must fall back to section hashes, so this has to
// return null rather than throw.
test('no repository yields null, never an exception', () => {
  const root = mkdtempSync(join(tmpdir(), 'rerun-safety-norepo-'));
  writeFileSync(join(root, 'ARCHITECTURE.md'), '# Doc\n');
  assert.equal(gitDiff({ root, file: 'ARCHITECTURE.md' }), null);
});

test('an unchanged file yields null', () => {
  const root = repoWithCommit();
  assert.equal(gitDiff({ root, file: 'ARCHITECTURE.md' }), null);
});
