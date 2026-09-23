import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, hashText, sectionHashes, readState, writeState } from '../lib/state.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Line endings, trailing spaces and how many newlines a file ends with are
// editor artefacts. If they changed the hash, every run would report drift on
// files nobody touched, and people would learn to answer "overwrite" without
// reading — which is worse than having no guard at all.
test('editor artefacts hash the same', () => {
  const base = '# Title\n\nbody\n';
  for (const variant of ['# Title\r\n\r\nbody\r\n', '# Title\n\nbody   \n', '# Title\n\nbody\n\n\n']) {
    assert.equal(hashText(variant), hashText(base), JSON.stringify(variant));
  }
});

// The other half of the same rule: normalisation must not be so eager that a
// real edit hashes as unchanged. That is the failure that loses data silently.
test('a real edit hashes differently', () => {
  assert.notEqual(hashText('# Title\n\nbody\n'), hashText('# Title\n\nBody\n'));
  assert.notEqual(hashText('| a | b |\n'), hashText('| a  | b |\n'));
});

test('normalise leaves exactly one trailing newline', () => {
  assert.equal(normalise('a'), 'a\n');
  assert.equal(normalise('a\n\n\n'), 'a\n');
});

test('a hash is labelled with its algorithm', () => {
  assert.match(hashText('x'), /^sha256:[0-9a-f]{64}$/);
});

const ARCH = `---
name: atlas
---

# Atlas Architecture

## 1 Goals and Scope

Assign jobs to drivers.

## 13 Quality Requirements and SLOs

| scenario | measure | target | priority | src |
|---|---|---|---|---|
| peak checkout | p99 | 200 ms | must | stated |

## 16 Glossary

| term | meaning | src |
|---|---|---|
| job | one delivery | stated |
`;

test('sections are keyed by their spine number', () => {
  assert.deepEqual(Object.keys(sectionHashes(ARCH)), ['1', '13', '16']);
});

// The point of hashing per section: editing one must not move the others, or
// the fallback report names every section and tells the reader nothing.
test('editing one section moves only that section', () => {
  const before = sectionHashes(ARCH);
  const after = sectionHashes(ARCH.replace('200 ms', '150 ms'));
  assert.equal(after['1'], before['1']);
  assert.equal(after['16'], before['16']);
  assert.notEqual(after['13'], before['13']);
});

// Frontmatter and the H1 belong to no section. Folding them into section 1
// would report a driver change every time the document version is bumped.
test('content before the first numbered heading is in no section', () => {
  const after = sectionHashes(ARCH.replace('name: atlas', 'name: atlas-2'));
  assert.deepEqual(after, sectionHashes(ARCH));
});

const tmp = () => mkdtempSync(join(tmpdir(), 'rerun-safety-'));

test('state survives a round trip', () => {
  const path = join(tmp(), 'architecture-state.json');
  const state = { revision: 2, files: { 'ARCHITECTURE.md': { hash: 'sha256:aa' } } };
  writeState(path, state);
  assert.deepEqual(readState(path).state, state);
});

test('an absent state file is not an error', () => {
  assert.deepEqual(readState(join(tmp(), 'nope.json')), { state: null });
});

// A corrupt state file is the one case where deleting would be convenient and
// wrong: it is the only record of what the last run wrote.
test('a corrupt state file reads as absent, is reported, and is left alone', () => {
  const path = join(tmp(), 'architecture-state.json');
  writeFileSync(path, '{ not json');
  const result = readState(path);
  assert.equal(result.state, null);
  assert.match(result.error, /unreadable/);
  assert.equal(readFileSync(path, 'utf8'), '{ not json');
});

// Written last and atomically: a crash must leave the previous revision intact
// rather than a half-written file that the next run would trust.
test('writing leaves no temp file behind', () => {
  const dir = tmp();
  const path = join(dir, 'architecture-state.json');
  writeState(path, { revision: 1, files: {} });
  assert.deepEqual(readdirSync(dir), ['architecture-state.json']);
  assert.equal(existsSync(`${path}.tmp`), false);
});

// The crash case itself. A write that dies partway must leave revision 1
// readable — that is what lets the next run treat the half-written documents
// as drifted and ask about them, instead of trusting them.
test('a failed write leaves the previous revision intact', () => {
  const path = join(tmp(), 'architecture-state.json');
  writeState(path, { revision: 1, files: {} });
  const circular = { revision: 2 };
  circular.self = circular;
  assert.throws(() => writeState(path, circular));
  assert.equal(readState(path).state.revision, 1);
});
