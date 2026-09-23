import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, changedSections } from '../lib/drift.mjs';
import { hashText, sectionHashes } from '../lib/state.mjs';

const BODY = '# Doc\n\nbody\n';
const entryFor = (text) => ({ hash: hashText(text) });

// A file the skill has never written is never overwritten and never questioned.
// This is what makes the first run against a hand-written package safe.
test('a file with no entry is untracked, never ours', () => {
  assert.equal(classify(undefined, BODY), 'untracked');
});

// The other half of "no entry": a file this run means to create has no entry
// either. Calling it untracked would tell the agent never to write it, and no
// new ADR or companion could ever be added after run 1.
test('a file with no entry and nothing on disk is new, safe to write', () => {
  assert.equal(classify(undefined, null), 'new');
});

test('a matching hash is unchanged', () => {
  assert.equal(classify(entryFor(BODY), BODY), 'unchanged');
});

test('a differing hash is drifted', () => {
  assert.equal(classify(entryFor(BODY), '# Doc\n\nedited\n'), 'drifted');
});

// Deleting a generated file can be deliberate. Recreating it silently would
// undo a decision nobody was asked about.
test('a tracked file missing from disk is reported, not recreated', () => {
  assert.equal(classify(entryFor(BODY), null), 'missing');
});

// decisions.md already rules: an accepted ADR is superseded, never rewritten.
// The status in state is what lets a run tell an accepted record from a
// proposed draft it is free to regenerate.
test('an accepted ADR is locked whatever its hash says', () => {
  assert.equal(classify({ hash: hashText(BODY), status: 'accepted' }, BODY), 'locked');
  assert.equal(classify({ hash: 'sha256:stale', status: 'accepted' }, BODY), 'locked');
  assert.equal(classify({ hash: 'sha256:stale', status: 'proposed' }, BODY), 'drifted');
});

const ARCH = '## 1 Goals and Scope\n\na\n\n## 13 Quality Requirements and SLOs\n\nb\n';

test('changed sections are named, ascending', () => {
  const entry = { hash: hashText(ARCH), sections: sectionHashes(ARCH) };
  assert.deepEqual(changedSections(entry, ARCH.replace('\nb\n', '\nedited\n')), ['13']);
  assert.deepEqual(changedSections(entry, ARCH), []);
});

// A section deleted wholesale is a change the reader most needs to see.
test('a removed section counts as changed', () => {
  const entry = { hash: hashText(ARCH), sections: sectionHashes(ARCH) };
  assert.deepEqual(changedSections(entry, '## 1 Goals and Scope\n\na\n'), ['13']);
});

test('with no recorded sections every present section reads as changed', () => {
  assert.deepEqual(changedSections({ hash: 'sha256:x' }, ARCH), ['1', '13']);
});
