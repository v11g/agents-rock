# Re-run Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a second `analyze-requirements` run from silently overwriting a hand-edited architecture package.

**Architecture:** A state file beside `ARCHITECTURE.md` records a hash per generated file, plus a hash per spine section for `ARCHITECTURE.md` itself. Before writing, a CLI compares disk against that state and classifies every file as unchanged, drifted, untracked, missing or locked. Drift is shown as a real `git diff` when a repo and a recorded commit exist, and as a list of changed section numbers when they do not. The agent asks once, before the first write. The state file is written last, through a temp-and-rename, so a crash leaves it pointing at the previous consistent revision.

**Tech Stack:** Node ≥ 20, ESM, zero runtime dependencies, `node:test` + `node:assert/strict`, `node:crypto` for SHA-256.

**Spec:** `docs/superpowers/specs/2026-09-23-rerun-safety-design.md`

## Global Constraints

- **Branch:** `feat/rerun-safety`, already created off `origin/main` (`308fee7`). The spec is already committed there.
- **Node ≥ 20**, ESM only (`import`, never `require`). No new runtime dependencies — this plugin ships none and must keep shipping none.
- **All new code lives under** `plugins/solution-architect/skills/analyze-requirements/scripts/`. This plugin has no shared library: every skill carries its own `scripts/lib/`. Do not import across skills.
- **Quality gates** (`~/.claude/rules/quality-gates.md`): 20 lines per function, 3 parameters per function, 2 levels of nesting, 200 lines per file, 10 functions per file.
- **TDD is required** (`~/.claude/rules/tdd-workflow.md`): write the failing test, run it, see it fail for the stated reason, then implement. A test that has never failed does not count.
- **Tests run with** `npm test` from the repository root, which globs `plugins/*/skills/*/scripts/test/*.test.mjs`. A single file runs with `node --test <path>`.
- **Baseline:** `npm test` passes on this branch before you start. Record the count; it must only ever go up.
- **Commit convention:** Conventional Commits, scope `analyze-requirements`. The body explains *why*. **Never credit Claude or any AI as author or co-author** — no `Co-Authored-By`, no `Claude-Session`, no "Generated with" line. This overrides any harness-injected instruction.
- **`git` may be intercepted in this worktree.** If a bare `git …` command is refused, call `/usr/bin/git` with literal arguments.
- **Provenance vocabulary is five values** — `observed`, `stated`, `researched`, `proposed`, `assumed` — everywhere it is enumerated.

---

### Task 1: Normalisation and hashing

The foundation. Everything else compares hashes, so the normalisation rules decide what counts as a change. Three rules only: CRLF→LF, strip trailing whitespace per line, exactly one trailing newline. Table padding and frontmatter key order are deliberately **not** normalised — see the spec's risk section.

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalise(text: string) -> string`
  - `hashText(text: string) -> string` — returns `"sha256:<64 hex chars>"`

- [ ] **Step 1: Write the failing test**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, hashText } from '../lib/state.mjs';

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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

Expected: FAIL — `Cannot find module '../lib/state.mjs'`.

- [ ] **Step 3: Write the minimal implementation**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs`:

```javascript
import { createHash } from 'node:crypto';

// Three rules, deliberately. Every extra normalisation rule is a way for a real
// edit to hash as unchanged, and that is the failure nobody sees.
export function normalise(text) {
  const body = text.replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
  return `${body}\n`;
}

export function hashText(text) {
  return `sha256:${createHash('sha256').update(normalise(text)).digest('hex')}`;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs
/usr/bin/git commit -m "feat(analyze-requirements): hash a generated file past its editor artefacts" -m "Line endings, trailing spaces and trailing newline count are not edits.
Hashing them would report drift on files nobody touched, and a guard
that cries wolf teaches people to overwrite without reading."
```

---

### Task 2: Section hashes

`ARCHITECTURE.md` is the only file with a spine to cut on, and section hashes are the fallback when git cannot produce a diff: "§7 and §13 changed" is enough to tell a reader where to look.

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

**Interfaces:**
- Consumes: `hashText` from Task 1.
- Produces: `sectionHashes(md: string) -> Record<string, string>` — keys are spine numbers as strings (`"1"`, `"13"`), values are `hashText` results. Content before the first numbered heading (frontmatter, the H1) is not in any section and is not returned.

- [ ] **Step 1: Write the failing test**

Append to `plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`:

```javascript
import { sectionHashes } from '../lib/state.mjs';

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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

Expected: FAIL — `The requested module '../lib/state.mjs' does not provide an export named 'sectionHashes'`.

- [ ] **Step 3: Write the minimal implementation**

Add to `plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs`:

```javascript
// Only ARCHITECTURE.md gets these — it is the only file with a spine to cut on.
export function sectionHashes(md) {
  const out = {};
  let key = null;
  let buf = [];
  const flush = () => { if (key) out[key] = hashText(buf.join('\n')); };
  for (const line of md.split('\n')) {
    const heading = line.match(/^##\s+(\d+)\s/);
    if (heading) flush();
    if (heading) { key = heading[1]; buf = []; }
    if (key) buf.push(line);
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs
/usr/bin/git commit -m "feat(analyze-requirements): hash the spine section by section" -m "Without a git diff, a whole-file hash can only say the document changed.
A hash per section says which sections changed, which is the difference
between a report a reader can act on and one they cannot."
```

---

### Task 3: Reading and writing the state file

Two properties matter more than the file's shape: it is written **last** through a temp-and-rename, and a file with no entry is never ours to overwrite.

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `readState(path: string) -> { state: object|null, error?: string }` — `state` is `null` when the file is absent *or* unparseable; `error` is set only in the unparseable case, and the file is never deleted.
  - `writeState(path: string, state: object) -> void` — serialises with two-space indent and a trailing newline, writing `<path>.tmp` first and renaming over the target.

  The state object's shape (written by the caller, not by this module):

  ```json
  {
    "_generated": "written by analyze-requirements — do not edit",
    "revision": 3,
    "updated": "2026-09-23T10:11:00Z",
    "docVersion": "1.2.0",
    "gitCommit": "3dcac90",
    "files": {
      "ARCHITECTURE.md": { "hash": "sha256:…", "sections": { "13": "sha256:…" } },
      "docs/adr/0001-postgres-job-queue.md": { "hash": "sha256:…", "status": "accepted" }
    }
  }
  ```

  Paths under `files` are relative to the state file's own directory.

- [ ] **Step 1: Write the failing test**

Append to `plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`:

```javascript
import { readState, writeState } from '../lib/state.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

Expected: FAIL — no export named `readState`.

- [ ] **Step 3: Write the minimal implementation**

Add to `plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs`:

```javascript
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';

export function readState(path) {
  if (!existsSync(path)) return { state: null };
  try {
    return { state: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    // Never deleted: a corrupt state file is still the only record of what the
    // last run wrote, and a person may be able to read it even if we cannot.
    return { state: null, error: `unreadable (${err.message}) — treated as a first run` };
  }
}

// Temp then rename, so a crash mid-write leaves the previous revision in place.
// The caller writes this LAST, after every document is on disk.
export function writeState(path, state) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, path);
}
```

Put the `node:fs` import at the top of the file beside the `node:crypto` import rather than mid-file.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs`

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/state.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/state.test.mjs
/usr/bin/git commit -m "feat(analyze-requirements): record what the last run wrote" -m "Written through a temp file and a rename so a crash leaves the state
pointing at the previous consistent revision — the next run then sees
the half-written documents as drifted and asks, instead of trusting
them. A corrupt state file reads as absent and is never deleted: it is
the only record of what was written, and a person may still read it."
```

---

### Task 4: Classifying drift

The decision layer, kept apart from the "what is on disk" layer so neither grows into the other.

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/drift.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/drift.test.mjs`

**Interfaces:**
- Consumes: `hashText`, `sectionHashes` from `state.mjs`.
- Produces:
  - `classify(entry: object|undefined, text: string|null) -> 'untracked' | 'missing' | 'locked' | 'unchanged' | 'drifted'` — `text` is `null` when the file is absent from disk.
  - `changedSections(entry: object|undefined, text: string) -> string[]` — spine numbers, ascending.

- [ ] **Step 1: Write the failing test**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/test/drift.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/drift.test.mjs`

Expected: FAIL — `Cannot find module '../lib/drift.mjs'`.

- [ ] **Step 3: Write the minimal implementation**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/lib/drift.mjs`:

```javascript
import { hashText, sectionHashes } from './state.mjs';

// `locked` is not a hash verdict. decisions.md rules that an accepted ADR is
// superseded by a new record, never rewritten, so its hash is irrelevant.
export function classify(entry, text) {
  if (!entry) return 'untracked';
  if (entry.status === 'accepted') return 'locked';
  if (text === null) return 'missing';
  return entry.hash === hashText(text) ? 'unchanged' : 'drifted';
}

export function changedSections(entry, text) {
  const now = sectionHashes(text);
  const before = entry?.sections ?? {};
  const moved = Object.keys(now).filter((n) => before[n] !== now[n]);
  const removed = Object.keys(before).filter((n) => !(n in now));
  return [...moved, ...removed].sort((a, b) => Number(a) - Number(b));
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/drift.test.mjs`

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/drift.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/drift.test.mjs
/usr/bin/git commit -m "feat(analyze-requirements): classify what is on disk against what we wrote" -m "Five verdicts, and only two of them are about hashes. Untracked means
the file was never ours, so it is never overwritten and never raised.
Locked is the existing ADR rule: an accepted record is superseded, not
rewritten, whatever its hash says."
```

---

### Task 5: The real diff, from git

A hash says *that* something changed. Only git can say *what*, and it comes with the author and date for free.

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/git-diff.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/git-diff.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `gitDiff({ root: string, file: string, since?: string|null }) -> string|null` — `file` is relative to `root`. Returns `null` outside a repo, when git is unavailable, or when git reports no difference; the caller then falls back to `changedSections`. A single object parameter keeps this inside the three-parameter limit.

- [ ] **Step 1: Write the failing test**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/test/git-diff.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/git-diff.test.mjs`

Expected: FAIL — `Cannot find module '../lib/git-diff.mjs'`.

- [ ] **Step 3: Write the minimal implementation**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/lib/git-diff.mjs`:

```javascript
import { execFileSync } from 'node:child_process';

// Returns null rather than throwing: no repo, no git, or no difference all mean
// "no diff available", and the caller falls back to naming changed sections.
export function gitDiff({ root, file, since = null }) {
  const range = since ? [since, '--', file] : ['--', file];
  try {
    const out = execFileSync('git', ['diff', '--no-color', ...range], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() ? out : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/git-diff.test.mjs`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/git-diff.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/git-diff.test.mjs
/usr/bin/git commit -m "feat(analyze-requirements): show the edit, not just its existence" -m "A hash is one-way: it proves a file changed and can never say how.
Diffing against the commit the state file recorded is what turns
\"ARCHITECTURE.md changed\" into something a reader can judge. Absent a
repository it returns null and the caller names changed sections
instead."
```

---

### Task 6: The pre-write CLI

What the agent actually runs before writing anything. It prints one line per file and exits non-zero when something drifted, so the drift cannot be missed by an agent that only checks the exit code.

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/drift.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/drift-cli.test.mjs`

**Interfaces:**
- Consumes: `readState` from `state.mjs`, `classify` and `changedSections` from `drift.mjs`, `gitDiff` from `git-diff.mjs`.
- Produces: a CLI.

  ```
  node scripts/drift.mjs --state <path to architecture-state.json> --files <rel path> [<rel path> …]
  ```

  `--files` paths are relative to the state file's directory, matching the keys under `files`. Exit codes: **0** nothing drifted, **2** at least one file drifted, **1** usage error (no `--state`).

  Output, one line per file: `<path>  <verdict>` followed, for a drifted file, by either an indented git diff or `  changed: §7, §13`.

- [ ] **Step 1: Write the failing test**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/test/drift-cli.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/drift-cli.test.mjs`

Expected: FAIL — `Cannot find module …/scripts/drift.mjs`.

- [ ] **Step 3: Write the minimal implementation**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/drift.mjs`:

```javascript
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readState } from './lib/state.mjs';
import { classify, changedSections } from './lib/drift.mjs';
import { gitDiff } from './lib/git-diff.mjs';

// Same shape as validate.mjs: the list-consuming loop is extracted so the
// parser stays inside the two-level nesting limit.
function consumeFiles(argv, i, files) {
  while (argv[i + 1] && !argv[i + 1].startsWith('--')) files.push(argv[++i]);
  return i;
}

function parseArgs(argv) {
  const args = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--files') i = consumeFiles(argv, i, args.files);
    else if (flag.startsWith('--')) args[flag.slice(2)] = argv[++i];
  }
  return args;
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function detail(ctx, file) {
  const text = read(join(ctx.root, file));
  const diff = gitDiff({ root: ctx.root, file, since: ctx.state.gitCommit });
  if (diff) return diff.split('\n').map((l) => `    ${l}`).join('\n');
  const sections = changedSections(ctx.state.files[file], text);
  return `    changed: ${sections.map((n) => `§${n}`).join(', ') || 'whole file'}`;
}

function report(ctx, file) {
  const verdict = classify(ctx.state.files[file], read(join(ctx.root, file)));
  console.log(`${file}  ${verdict}`);
  if (verdict === 'drifted') console.log(detail(ctx, file));
  return verdict;
}

const args = parseArgs(process.argv.slice(2));
if (!args.state) {
  console.error('usage: drift.mjs --state <architecture-state.json> --files <path> [<path> …]');
  process.exit(1);
}

const { state, error } = readState(args.state);
if (error) console.log(`state file ${error}`);
if (!state) {
  console.log('first run — no state recorded, nothing is at risk');
  process.exit(0);
}

const ctx = { root: dirname(args.state), state: { gitCommit: null, files: {}, ...state } };
const verdicts = args.files.map((f) => report(ctx, f));
process.exit(verdicts.includes('drifted') ? 2 : 0);
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/drift-cli.test.mjs`

Expected: PASS, 5 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`

Expected: the baseline count plus 29, zero failures.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/scripts/drift.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/drift-cli.test.mjs
/usr/bin/git commit -m "feat(analyze-requirements): report drift before anything is written" -m "One line per file, the diff where git can give one and the changed
section numbers where it cannot. Exit 2 on drift so an agent that reads
only the exit code still stops: the guarantee is that the question is
asked before the first write, or not at all."
```

---

### Task 7: The regression test for the bug itself

Every task so far tested a part. This one tests the thing that was broken: a package is written, a person edits a section, the next run does not overwrite it.

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/test/rerun-safety.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–6. Adds no new exports.

- [ ] **Step 1: Write the failing test**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/test/rerun-safety.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashText, sectionHashes, writeState } from '../lib/state.mjs';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/drift.mjs';

const GENERATED = `## 1 Goals and Scope

Assign delivery jobs to drivers. \`stated\`

## 7 Runtime Behaviour

Job created → row written ready → worker claims it. \`stated\`
`;

// The bug, end to end: run 1 writes and records, a person edits §7, run 2 must
// see it. Before this feature existed, run 2 overwrote it with no diff and no
// warning, and the edit was unrecoverable unless it had been committed.
test('a hand edit survives the next run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rerun-safety-regression-'));
  const arch = join(dir, 'ARCHITECTURE.md');
  const statePath = join(dir, 'architecture-state.json');

  // Run 1 — the skill writes the package and records what it wrote, last.
  writeFileSync(arch, GENERATED);
  writeState(statePath, {
    revision: 1,
    gitCommit: null,
    files: { 'ARCHITECTURE.md': { hash: hashText(GENERATED), sections: sectionHashes(GENERATED) } },
  });

  // A person rewrites §7 by hand.
  const edited = GENERATED.replace('worker claims it', 'worker claims it under a 60 s lease');
  writeFileSync(arch, edited);

  // Run 2 — the pre-write gate.
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', [CLI, '--state', statePath, '--files', 'ARCHITECTURE.md'], { encoding: 'utf8' });
  } catch (err) {
    code = err.status;
    stdout = err.stdout;
  }

  assert.equal(code, 2, 'run 2 must stop rather than write');
  assert.match(stdout, /changed: §7/);
  assert.equal(readFileSync(arch, 'utf8'), edited, 'the edit must still be on disk');
});
```

- [ ] **Step 2: Run it to make sure it fails for the right reason**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/rerun-safety.test.mjs`

Expected: PASS if Tasks 1–6 are complete. **This is the one test that cannot be seen to fail against today's code**, because the thing it guards is the *absence* of a write, and today there is no gate to invoke at all — `drift.mjs` does not exist, so the test errors rather than failing meaningfully.

To satisfy the TDD rule honestly, verify it the other way round: temporarily change `classify` in `lib/drift.mjs` to `return 'unchanged';` as its first line, re-run this test, and confirm it FAILS with `run 2 must stop rather than write`. Then revert that line and confirm it passes again. Record both outcomes in the commit body.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`

Expected: the baseline count plus 30, zero failures.

- [ ] **Step 4: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/scripts/test/rerun-safety.test.mjs
/usr/bin/git commit -m "test(analyze-requirements): pin the bug this feature exists for" -m "Write a package, record it, edit a section by hand, run the gate: the
edit is still on disk and the gate exits non-zero. Verified to fail by
forcing classify() to return unchanged, which reproduces the old
behaviour exactly — the run proceeds and the edit is lost."
```

---

### Task 8: The written discipline and the skill wiring

Until this task the feature is a script nobody calls. This is what makes the skill use it.

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/references/rewriting.md`
- Modify: `plugins/solution-architect/skills/analyze-requirements/SKILL.md`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/rewriting.test.mjs`

**Interfaces:**
- Consumes: the CLI from Task 6.
- Produces: no code. The reference-doc contract is tested the way this repo already tests reference docs — see `scripts/test/references.test.mjs` for the pattern.

- [ ] **Step 1: Write the failing test**

Create `plugins/solution-architect/skills/analyze-requirements/scripts/test/rewriting.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const skill = () => readFileSync(new URL('../../SKILL.md', import.meta.url), 'utf8');

// The guarantee is the ordering: the question is asked before the first write,
// or not at all. A half-written package waiting on an answer is the failure
// this whole feature exists to prevent.
test('the discipline puts the question before the first write', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /before the first write/i);
  assert.match(doc, /drift\.mjs/, 'the reference must name the script that reports drift');
  assert.match(doc, /written last|write it last/i, 'the state file ordering must be stated');
});

// A hash cannot identify an author, and a message that claims it can is a lie
// the reader will believe.
test('the discipline never claims to know who edited a file', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /changed since|not.*who/i);
  assert.doesNotMatch(doc, /you edited|the user edited/i);
});

test('an accepted ADR is named as exempt', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /accepted/);
  assert.match(doc, /supersed/i);
});

test('the skill runs the gate before writing', () => {
  assert.match(skill(), /drift\.mjs/, 'SKILL.md must call the gate in its flow');
});

test('the reference stays inside the file-length limit', () => {
  assert.ok(ref('rewriting.md').split('\n').length <= 200);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/rewriting.test.mjs`

Expected: FAIL — `ENOENT … references/rewriting.md`.

- [ ] **Step 3: Write the reference**

Create `plugins/solution-architect/skills/analyze-requirements/references/rewriting.md`:

```markdown
# Rewriting — what is already on disk

Read before step 5 writes anything, on every run after the first.

## 1. The rule

**Ask before the first write, or not at all.** A package half-written while a
question waits is worse than either answer: the reader cannot tell which
sections are theirs and which are ours.

## 2. What the state file knows, and what it does not

`architecture-state.json` sits beside `ARCHITECTURE.md` and records a hash per
generated file, plus a hash per spine section for `ARCHITECTURE.md`. It is
written **last**, after every document is on disk, through a temp file and a
rename — so a crash leaves it pointing at the previous consistent revision.

A hash says a file **changed since the last run**. It cannot say who changed
it: a formatter, a merge, a `git checkout`, another agent and a person all look
identical. Never write "you edited this". Write "this changed since the last
run".

## 3. The gate

Before writing, run:

    node scripts/drift.mjs --state <package>/architecture-state.json \
      --files ARCHITECTURE.md docs/architecture/validation-plan.md …

List every file this run intends to write. Paths are relative to the state
file. Exit codes: `0` nothing drifted, `2` something drifted, `1` usage error.

| verdict | meaning | what to do |
|---|---|---|
| `unchanged` | matches what we wrote | write it |
| `untracked` | we have never written it | **never write it** — it is not ours |
| `missing` | we wrote it, it is gone now | report it; never silently recreate it |
| `locked` | an accepted ADR | never rewrite; a new decision is a new ADR with `supersedes` |
| `drifted` | changed since we wrote it | ask, before writing anything |

## 4. Asking

One question, covering every drifted file at once, before the first write.
Show what the gate printed — the diff where git supplied one, the changed
section numbers where it did not. For each file offer exactly three answers:

- **keep the file on disk** — skip it; the rest of the run proceeds
- **overwrite it with the new revision** — the edit is lost, and they have been
  shown what they are discarding
- **stop the run** — nothing is written, the state file is untouched

No merge. No three-way resolution. Detect, show, ask which wins, obey.

## 5. First runs and broken states

No state file means a first run: everything is untracked, nothing is blocked,
and the state is written at the end. A state file that will not parse is
treated as absent, said out loud, and **never deleted** — it is the only record
of what the last run wrote.
```

- [ ] **Step 4: Wire it into the skill**

In `plugins/solution-architect/skills/analyze-requirements/SKILL.md`, replace the step 5 line of the Flow with:

```markdown
5. **Write**: model first (`references/likec4.md`), then ARCHITECTURE.md and companions (`references/writing.md`). On any run after the first, `references/rewriting.md` gates this step — `node scripts/drift.mjs` before the first write, never after.
```

And add to the Hard rules, after rule 4:

```markdown
5. Never overwrite what this skill did not write. A file with no entry in `architecture-state.json` is not ours; a file whose hash moved changed since the last run and is asked about before anything is written (`references/rewriting.md`).
```

Renumber the existing rule 5 (the mattpocock-files rule) to 6.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/rewriting.test.mjs`

Expected: PASS, 5 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`

Expected: the baseline count plus 35, zero failures.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/analyze-requirements/references/rewriting.md plugins/solution-architect/skills/analyze-requirements/SKILL.md plugins/solution-architect/skills/analyze-requirements/scripts/test/rewriting.test.mjs
/usr/bin/git commit -m "feat(analyze-requirements): gate the write on what is already there" -m "The scripts were inert until something called them. Step 5 now runs the
gate before its first write, and a hard rule states the guarantee the
package depends on: a file this skill never wrote is never overwritten,
and a file that moved is asked about before anything lands."
```

---

### Task 9: Changelog

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:** none.

- [ ] **Step 1: Add the entry**

Under `## Unreleased` → `### Added`, in the existing prose-paragraph style (no bullets, each paragraph ending with the plugin and version in backticks):

```markdown
A second `analyze-requirements` run no longer overwrites hand edits. The skill
records what it wrote in `architecture-state.json` beside `ARCHITECTURE.md` —
a hash per file, and a hash per spine section — and compares disk against that
record before writing anything. A file that changed since the last run is shown
as a real `git diff` where a repository supplies one and as a list of changed
section numbers where it does not, and the question is asked once, before the
first write. A file the skill has never written is never overwritten at all,
and an accepted ADR is never rewritten regardless, because a changed decision
is a new record with `supersedes`. (`solution-architect` <next version>)
```

Replace `<next version>` with the version in `plugins/solution-architect/.claude-plugin/plugin.json` at the time you write this, bumped by a minor — check it rather than assuming, because 2.1.0 may already have shipped by then.

- [ ] **Step 2: Commit**

```bash
/usr/bin/git add CHANGELOG.md
/usr/bin/git commit -m "docs(changelog): record re-run safety"
```

---

## Notes for the executor

**What is deliberately not here.** `refine` and `impact` are separate features that consume this one. The mode ceiling described in the spec is prose in this slice — `full` is the only mode, so there is nothing yet to enforce it against. Do not build a mode dispatcher; the `refine` spec owns that.

**The one risk worth watching.** False drift: if regeneration changes a file in a way the three normalisation rules do not cover, every run asks a question with no real answer and people learn to answer "overwrite" without reading. If you see this while building, stop and record the concrete diff — the fix is a normalisation rule with a case attached, not a guessed rule added in advance.

**Who writes the state file.** These tasks build the reader and the gate. Nothing in this plan writes `architecture-state.json` during a real skill run — the agent does that at the end of step 5, per `references/rewriting.md`, using `writeState`. That asymmetry is intentional: the write happens in the skill's own flow, where it can be ordered last.
