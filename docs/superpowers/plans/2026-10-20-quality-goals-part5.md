# Business-Analyst Package as Input (Part 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** analyze-requirements reads a business-analyst package as client material. It prefers `requirements.json` and falls back to `requirements.md`. Only rows the BA confirmed become `stated`, and each is cited by its row id.

**Architecture:**
- A new lib, `scripts/lib/ba-package.mjs`, turns a package into rows `{ id, fact, label, source, section, cite }` and checks citations against those rows.
- A new CLI, `scripts/ba-facts.mjs`, writes the rows as `{ facts, proposed }`, so no agent reads the json.
- `inputs.mjs` recognises a package passed with `--inputs`, and `validate.mjs` adds the id/label check.
- The md fallback reuses `extract.js` with a `ba: true` rule in the prompt.
- The docs say when each path applies.

**Tech Stack:** Node ≥ 20 ESM, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md`. This plan implements D22–D25 and the section "Part 5 — business-analyst package as input".

## Global Constraints

- **Where it lands.** Worktree `.claude/worktrees/quality-goals-part5` on new branch `feat/quality-goals-ba-package`, cut from `feat/quality-goals` HEAD.
- **No release steps.** Do not merge, do not push, and do not bump the version. 3.2.0 is unreleased.
- Node ≥ 20; no new npm dependencies.
- **Quality gates** (`scripts/test/quality-gates.test.mjs`): ≤ 20 lines per function, ≤ 3 params, nesting ≤ 2, ≤ 200 lines and ≤ 10 functions per file.
- TDD for code: every new test runs and fails before its code exists.
- **Commits:** Conventional Commits, subject ≤ 50 chars, no AI attribution trailers.
- **Citation format (D24):** `stated [<id> · <BA source>](<path relative to ARCHITECTURE.md>)`, with no quote. When a row has no `source`, the label is `<id> · <package updated date>`.
- **Statable rows (D23):** `label === 'confirmed'`, or no `label` but a `source` (constraints, business rules). Everything else is `proposed`.
- **Pair rule (D22):** if both `requirements.json` and `requirements.md` are present, read only the json. The md is read only when there is no json.
- `npm test` passes at the end of every task. Known flake: `estimate/workflow-based/scripts/test/browser.test.mjs` "opening a system switches the cards". If it is the only failure, re-run that file alone and report both runs.

All paths below are relative to `plugins/solution-architect/skills/analyze-requirements/` unless they start with `plugins/` or `docs/`.

## Review Focus

1. **A `.json` input that is not a BA package** (a random config, or invalid JSON) must not crash `validate.mjs`; it is checked as plain text. Pinned in Task 2 (CLI test).
2. **A citation to an `assumed` row** must FAIL with the row's label in the message, not pass because the id exists. Pinned in Task 1 (lib test) and Task 2 (CLI test).
3. **A json citation that carries a quote anyway.** The quote is checked against the package's row texts by the existing quote check. A reworded quote fails once, not twice. Pinned in Task 2 (CLI test).
4. **A `Brief says` quote taken from a package row** must pass the brief check. Package text is the joined row facts, not raw JSON with `\"` escapes. Pinned in Task 2 (CLI test).
5. **ARCHITECTURE.md in a subfolder** (`docs/ARCHITECTURE.md` citing `../requirements.json`) must resolve to the same package. Pinned in Task 2 (CLI test).

---

### Task 1: `ba-package` lib

**Files:**
- Create: `scripts/lib/ba-package.mjs`
- Test: `scripts/test/ba-package.test.mjs`

**Interfaces:**
- Produces:
  - `isPackage(value: unknown) → boolean`: true when the value has `schemaVersion` and an array `requirements`.
  - `baRows(pkg) → Array<{ id, fact, label, source, section, cite }>`. `label` is `'confirmed' | 'assumed' | 'recommended'`. Rows with no id, or with neither a label nor a source, are skipped.
  - `isStated(row) → boolean`, i.e. `row.label === 'confirmed'`.
  - `validateBaCitations({ citations, packages }) → Finding[]`. `citations` come from `parseCitations` with root-relative paths; `packages` is a `Map<rootRelPath, rows>`. Findings are `{ check: 'quotes', message }`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test/ba-package.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPackage, baRows, isStated, validateBaCitations } from '../lib/ba-package.mjs';

const PKG = {
  schemaVersion: '1.0', updated: '2026-10-01',
  requirements: [
    { id: 'FR-001', text: 'Members book up to 4 courts per week.', label: 'confirmed', source: 'kickoff call 2026-09-20' },
    { id: 'FR-002', text: 'Members pay a deposit online.', label: 'recommended' },
  ],
  nfrs: [{ id: 'NFR-001', area: 'availability', text: 'The booking page is up 99.95% of the time.', label: 'assumed' }],
  integrations: [{ id: 'INT-001', system: 'Stripe', direction: 'write', label: 'confirmed', source: 'PO brief' }],
  data: [{ id: 'DAT-001', entity: 'Booking', sensitivity: 'personal', volume: 'about 900 per week', label: 'confirmed' }],
  constraints: [{ id: 'CON-001', text: 'Must run in AWS eu-west-1.', source: 'client IT policy' }],
  assumptions: [{ id: 'ASM-001', text: 'Members log in with email.', impact: 'high', status: 'unconfirmed' }],
};
const rows = baRows(PKG);
const byId = (id) => rows.find((r) => r.id === id);

test('isPackage needs schemaVersion and a requirements array', () => {
  assert.equal(isPackage(PKG), true);
  assert.equal(isPackage({ name: 'x' }), false);
  assert.equal(isPackage(null), false);
});

test('baRows reads each section with its fact text and section', () => {
  assert.deepEqual(byId('FR-001'), {
    id: 'FR-001', fact: 'Members book up to 4 courts per week.', label: 'confirmed',
    source: 'kickoff call 2026-09-20', section: 'goals and scope', cite: 'FR-001 · kickoff call 2026-09-20',
  });
  assert.equal(byId('NFR-001').section, 'quality');
  assert.equal(byId('INT-001').fact, 'Stripe (write)');
  assert.equal(byId('DAT-001').fact, 'Booking, personal, about 900 per week');
});

test('a row with no source cites the package date', () => {
  assert.equal(byId('DAT-001').cite, 'DAT-001 · 2026-10-01');
});

test('a constraint with a source and no label counts as confirmed', () => {
  assert.equal(byId('CON-001').label, 'confirmed');
  assert.equal(isStated(byId('CON-001')), true);
});

test('assumptions are never rows; assumed and recommended are not stated', () => {
  assert.equal(byId('ASM-001'), undefined);
  assert.equal(isStated(byId('NFR-001')), false);
  assert.equal(isStated(byId('FR-002')), false);
});

const packages = new Map([['requirements.json', rows]]);
const cite = (label) => ({ label, path: 'requirements.json', quote: null });

test('a citation to a confirmed row passes', () => {
  assert.deepEqual(validateBaCitations({ citations: [cite('FR-001 · kickoff call 2026-09-20')], packages }), []);
});

test('a citation to an unknown id fails', () => {
  assert.deepEqual(validateBaCitations({ citations: [cite('FR-009 · x')], packages }), [
    { check: 'quotes', message: 'FR-009 is not in requirements.json' },
  ]);
});

test('a citation to an assumed row fails with its label', () => {
  assert.deepEqual(validateBaCitations({ citations: [cite('NFR-001 · 2026-10-01')], packages }), [
    { check: 'quotes', message: 'NFR-001 is assumed in requirements.json; only confirmed rows are stated' },
  ]);
});

test('citations to other files are ignored', () => {
  const other = { label: 'C1 · 2026-09-10', path: 'inputs/C1.txt', quote: 'x' };
  assert.deepEqual(validateBaCitations({ citations: [other], packages }), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-package.test.mjs`
Expected: FAIL with `Cannot find module '../lib/ba-package.mjs'`

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib/ba-package.mjs
// A business-analyst package (requirements.json) arrives already sourced:
// each row has an id, a label and where it came from. A script reads it, so
// no extract agent and no quote matching: the id is the anchor. Only a row
// the BA confirmed may become `stated` (references/extract.md §2.2).
const SECTIONS = {
  requirements: 'goals and scope',
  systems: 'goals and scope',
  features: 'goals and scope',
  businessRules: 'goals and scope',
  constraints: 'constraints',
  nfrs: 'quality',
  integrations: 'external systems and integrations',
  data: 'data and its sensitivity',
};
const FACT = {
  integrations: (r) => `${r.system} (${r.direction})`,
  data: (r) => [r.entity, r.sensitivity, r.volume].filter(Boolean).join(', '),
};
const textOf = (r) => r.text ?? r.rule ?? r.purpose ?? r.name ?? '';

export function isPackage(value) {
  return Boolean(value && value.schemaVersion && Array.isArray(value.requirements));
}

// Constraints and business rules carry a source but no label: the BA records
// them only once confirmed (business-analyst references/writing.md).
function rowOf(row, key, updated) {
  const label = row.label ?? (row.source ? 'confirmed' : null);
  const fact = (FACT[key] ?? textOf)(row);
  const source = row.source ?? null;
  return { id: row.id, fact, label, source, section: SECTIONS[key], cite: `${row.id} · ${source ?? updated}` };
}

export function baRows(pkg) {
  return Object.keys(SECTIONS).flatMap((key) => (pkg[key] ?? [])
    .map((row) => rowOf(row, key, pkg.updated))
    .filter((r) => r.id && r.label));
}

export function isStated(row) {
  return row.label === 'confirmed';
}

// packages maps root-relative path → baRows. A citation's label starts with
// the row id (`FR-001 · kickoff call`); any quote it carries is checked by
// validate-quotes against the package's row texts, not here.
export function validateBaCitations({ citations, packages }) {
  return citations.filter((c) => packages.has(c.path)).flatMap((c) => {
    const id = c.label.split('·')[0].trim();
    const row = packages.get(c.path).find((r) => r.id === id);
    if (!row) return [{ check: 'quotes', message: `${id} is not in ${c.path}` }];
    if (isStated(row)) return [];
    return [{ check: 'quotes', message: `${id} is ${row.label} in ${c.path}; only confirmed rows are stated` }];
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-package.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/ba-package.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-package.test.mjs
git commit -m "feat(analyze-requirements): read BA package rows"
```

---

### Task 2: Package inputs in `validate.mjs`

**Files:**
- Modify: `scripts/lib/inputs.mjs` (`buildInputs`; new `packagesOf`, `parseJson`)
- Modify: `scripts/validate.mjs` (import + one findings line)
- Test: `scripts/test/ba-package-cli.test.mjs`

**Interfaces:**
- Consumes: `isPackage`, `baRows`, `validateBaCitations` (Task 1); `parseCitations`, `validateQuotes` (existing).
- Produces: `buildInputs(...)` now returns `packages: Map<rootRelPath, rows>`. For a package path, `sources` holds the package's row facts joined by `\n` instead of the raw JSON.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test/ba-package-cli.test.mjs
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

test('a Brief says quote from a package row passes', () => {
  const q13 = '## 13 Quality Requirements\n\n| Goal | Target | Brief says | src |\n| --- | --- | --- | --- |\n| Uptime | 99.95% | "The booking page is up 99.95% of the time." | proposed |\n';
  const dir = setUp('ARCHITECTURE.md', q13);
  const r = run(dir, 'ARCHITECTURE.md');
  assert.doesNotMatch(r.stdout, /Brief says/);
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
```

The Brief-says test asserts only that no brief finding fires. The §13 table has one row, so the strategy check may FAIL on its own row count; that is unrelated and is why the test does not assert the exit code.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-package-cli.test.mjs`
Expected: FAIL. "assumed row" exits 0 (no package check yet); "Brief says" prints `Brief says "…" is in no input file` (raw JSON escapes); "not a package" passes already.

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/inputs.mjs`, add the import:

```js
import { isPackage, baRows } from './ba-package.mjs';
```

Replace the `sources` line in `buildInputs` and add `packages` to the returned object:

```js
  const sources = await readDocs(root, inputPaths);
  const packages = packagesOf(sources);
```

```js
    sources: new Map(sources.map((d) => [d.path, packages.has(d.path)
      ? packages.get(d.path).map((r) => r.fact).join('\n') : d.md])),
    packages,
```

Add below `citationsOf`:

```js
// A requirements.json is cited by row id (ba-package.mjs). Its row texts stand
// in for its source text, so a quote or Brief says from a row still matches.
// A .json that is not a BA package stays plain text.
function packagesOf(docs) {
  return new Map(docs.filter((d) => d.path.endsWith('.json'))
    .map((d) => [d.path, parseJson(d.md)])
    .filter(([, pkg]) => isPackage(pkg))
    .map(([path, pkg]) => [path, baRows(pkg)]));
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
```

In `scripts/validate.mjs`, add the import:

```js
import { validateBaCitations } from './lib/ba-package.mjs';
```

and add one line right after the `validateQuotes` line in `findings`:

```js
  ...validateBaCitations({ citations: inputs.citations, packages: inputs.packages }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-package-cli.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/inputs.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes-cli.test.mjs`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/inputs.mjs plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-package-cli.test.mjs
git commit -m "feat(analyze-requirements): check BA package citations"
```

---

### Task 3: `ba-facts.mjs` CLI

**Files:**
- Create: `scripts/ba-facts.mjs`
- Test: `scripts/test/ba-facts-cli.test.mjs`

**Interfaces:**
- Consumes: `isPackage`, `baRows`, `isStated` (Task 1).
- Produces: `node scripts/ba-facts.mjs --json <path> --out <file>` writes `{ facts: Row[], proposed: Row[] }`. Each row also carries `path` (the `--json` argument). It prints `ok <n> confirmed facts, <m> not confirmed` and exits 0. If the file is not a BA package it prints `FAIL <path> is not a requirements package` and exits 1.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test/ba-facts-cli.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/ba-facts.mjs';
const PKG = {
  schemaVersion: '1.0', updated: '2026-10-01',
  requirements: [
    { id: 'FR-001', text: 'Members book up to 4 courts per week.', label: 'confirmed', source: 'kickoff call 2026-09-20' },
    { id: 'FR-002', text: 'Members pay a deposit online.', label: 'recommended' },
  ],
};

function run(content) {
  const dir = mkdtempSync(join(tmpdir(), 'ba-facts-'));
  writeFileSync(join(dir, 'requirements.json'), content);
  const out = join(dir, 'ba.json');
  const r = spawnSync('node', [CLI, '--json', join(dir, 'requirements.json'), '--out', out], { encoding: 'utf8' });
  return { r, out, dir };
}

test('splits confirmed facts from proposed rows', () => {
  const { r, out, dir } = run(JSON.stringify(PKG));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^ok 1 confirmed facts, 1 not confirmed/m);
  const { facts, proposed } = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(facts.map((f) => [f.id, f.cite, f.path]), [
    ['FR-001', 'FR-001 · kickoff call 2026-09-20', join(dir, 'requirements.json')],
  ]);
  assert.deepEqual(proposed.map((f) => [f.id, f.label]), [['FR-002', 'recommended']]);
});

test('a file that is not a package fails', () => {
  const { r } = run('{"port": 8080}');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL .* is not a requirements package/m);
});

test('invalid JSON fails the same way', () => {
  const { r } = run('{"port": ');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /is not a requirements package/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-facts-cli.test.mjs`
Expected: FAIL (`Cannot find module …/ba-facts.mjs`)

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/ba-facts.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { isPackage, baRows, isStated } from './lib/ba-package.mjs';

// Reads a business-analyst requirements.json into facts, split by the BA's
// label: `facts` may be cited `stated`, `proposed` never is
// (references/extract.md §2.2). No agent reads the package.

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].slice(2)] = argv[i + 1];
  return args;
}

function readPackage(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

const args = parseArgs(process.argv.slice(2));
const pkg = readPackage(args.json);
if (!isPackage(pkg)) {
  console.log(`FAIL ${args.json} is not a requirements package`);
  process.exit(1);
}
const rows = baRows(pkg).map((r) => ({ ...r, path: args.json }));
const facts = rows.filter(isStated);
const proposed = rows.filter((r) => !isStated(r));
writeFileSync(args.out, JSON.stringify({ facts, proposed }, null, 2));
console.log(`ok ${facts.length} confirmed facts, ${proposed.length} not confirmed (assumed or recommended)`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-facts-cli.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/ba-facts.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/ba-facts-cli.test.mjs
git commit -m "feat(analyze-requirements): ba-facts script"
```

---

### Task 4: `extract.js` BA rule for the md fallback

**Files:**
- Modify: `workflows/extract.js` (`promptFor`, new `BA` const)
- Test: `scripts/test/extract-workflow.test.mjs` (add one test)

**Interfaces:**
- Consumes: a file entry `{ id, path, date, ba?: true }`.
- Produces: for a `ba: true` entry, the prompt contains the BA rule. Every other file gets the same prompt as before.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test/extract-workflow.test.mjs`. It uses the file's existing `run` and `okAgent` helpers:

```js
test('a BA package file gets the confirmed-only rule; other files do not', async () => {
  const files = [
    { id: 'D1', path: '/set/requirements.md', date: '2026-10-01', ba: true },
    { id: 'C1', path: '/set/inputs/C1-kickoff-call.txt', date: '2026-09-10' },
  ];
  const { calls } = await run({ agentImpl: okAgent, args: { files } });
  assert.match(calls.prompts[0], /only rows labelled confirmed/);
  assert.doesNotMatch(calls.prompts[1], /labelled confirmed/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/extract-workflow.test.mjs`
Expected: FAIL on the new test (no BA rule in the prompt)

- [ ] **Step 3: Write minimal implementation**

In `workflows/extract.js`, add below `RULES`:

```js
// requirements.md read without its json (references/extract.md §2.2): the BA
// already labelled every row, and only a confirmed one is the client's word.
const BA = 'This file is a business-analyst requirements package. Take only rows labelled confirmed, plus constraints and business rules that name a source. Skip rows labelled assumed or recommended, the assumptions register and open questions: the client did not confirm them.'
```

and change the first line of `promptFor`:

```js
  const head = `${RULES}${file.ba ? `\n${BA}` : ''}\nFile: ${file.path}\n`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/extract-workflow.test.mjs`
Expected: PASS (all, including the existing 5)

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/workflows/extract.js plugins/solution-architect/skills/analyze-requirements/scripts/test/extract-workflow.test.mjs
git commit -m "feat(analyze-requirements): BA rule for md fallback"
```

---

### Task 5: Skill instructions

**Files:**
- Modify: `references/extract.md` (§2 card note; new §2.2; §5 bullet)
- Modify: `references/writing.md` (the `stated` citation bullets, around line 119)
- Modify: `SKILL.md` (flow step 3)

No code. The check is to grep for the new text, then run `npm test`.

- [ ] **Step 1: `references/extract.md`**

In §2, after the line `- If option 1 is picked but `inputs/` is still empty, say so and continue as option 3.`, add:

```markdown
- A business-analyst package beside ARCHITECTURE.md (§2.2) is client material:
  the card still asks for raw files, with these options instead —
  1. `BA package only — continue (Recommended)` → §2.2 only.
  2. `Added raw client files to inputs/ — use both` → §2.2, then §3 on `inputs/`.
```

After §2.1 (before `## 3. Run`), add:

```markdown
### 2.2 A business-analyst package

The business-analyst skill writes `requirements.json` (for machines) and
`requirements.md` (for people) into the lead folder. Look for them beside
ARCHITECTURE.md.

- **Both present → read the json only.** Run
  `node scripts/ba-facts.mjs --json <path> --out <tmp>/ba.json`. Never extract
  `requirements.md` too: it is the same package, and every fact would arrive twice.
- **Only `requirements.md` → fallback.** Treat it as input `D<n>` at its own path
  (§1) and run §3 with `ba: true` on its file entry.
- `ba.json` holds `facts` (the BA marked them `confirmed`) and `proposed`
  (`assumed` or `recommended`). Only `facts` may be `stated` (§5). A `proposed`
  row is written `proposed`, or asked in the interview when it would change a
  decision. The package's assumptions and open questions are never `stated`.
- Pass the package file to `validate.mjs --inputs` like any input.
```

In §5, after the first bullet (`- A verified fact is `stated`, cited …`), add:

```markdown
- A `ba-facts` fact is cited by its row id, with no quote:
  `stated [<cite>](<path relative to ARCHITECTURE.md>)`, where `cite` is
  given (`FR-001 · kickoff call 2026-08-20`). A confirmed `quality` row can
  back a quality-goal candidate; its `fact` becomes the `Brief says` cell.
```

- [ ] **Step 2: `references/writing.md`**

In the `stated` citation list, after the `- from the interview: …` line, add:

```markdown
  - from a business-analyst package: `stated [FR-001 · kickoff call 2026-08-20](requirements.json)` —
    row id and the BA's source, no quote. `validate.mjs` fails an id that is not
    in the package or a row the BA did not mark confirmed.
```

- [ ] **Step 3: `SKILL.md` step 3**

Append this sentence to the end of flow step 3:

```markdown
 A business-analyst package beside ARCHITECTURE.md is read per §2.2: `requirements.json` by `scripts/ba-facts.mjs`, `requirements.md` only when there is no json.
```

- [ ] **Step 4: Verify**

Run: `grep -n "2.2" plugins/solution-architect/skills/analyze-requirements/SKILL.md plugins/solution-architect/skills/analyze-requirements/references/extract.md && grep -n "requirements.json" plugins/solution-architect/skills/analyze-requirements/references/writing.md && npm test`
Expected: each grep hits; `npm test` passes.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/SKILL.md plugins/solution-architect/skills/analyze-requirements/references/extract.md plugins/solution-architect/skills/analyze-requirements/references/writing.md
git commit -m "docs(analyze-requirements): BA package as input"
```

---

### Task 6: BA package eval

**Files:**
- Create: `evals/fixtures/ba-package-citations/requirements.json`
- Create: `evals/fixtures/ba-package-citations/requirements.md`
- Modify: `evals/evals.json` (append eval id 4)

The client is fictional (Courtside Club, padel court booking). It has three planted traps:
- an `assumed` 99.95% uptime NFR;
- a `recommended` deposit FR;
- a requirements.md that also holds the uptime line.

- [ ] **Step 1: Write `requirements.json`**

```json
{
  "schemaVersion": "1.0",
  "lead": "courtside-club",
  "status": "READY_FOR_ARCHITECTURE",
  "depth": "QUICK",
  "updated": "2026-10-01",
  "mode": "new",
  "context": { "problem": "Members book padel courts by phone; the front desk double-books at peak hours.", "goals": [{ "id": "G-001", "goal": "Members book courts themselves without double-booking" }] },
  "actors": [{ "id": "ACT-001", "name": "Member", "type": "human", "goal": "book a court in under a minute", "painPoints": ["phone line busy at 6pm"] }],
  "workflows": [],
  "requirements": [
    { "id": "FR-001", "text": "Members book up to 4 courts per week.", "label": "confirmed", "source": "kickoff call 2026-09-20", "scope": "in" },
    { "id": "FR-002", "text": "Two members can never hold the same court and hour.", "label": "confirmed", "source": "kickoff call 2026-09-20", "scope": "in" },
    { "id": "FR-003", "text": "Members pay a deposit online when booking.", "label": "recommended", "scope": "in" }
  ],
  "businessRules": [],
  "scenarios": [],
  "nfrs": [
    { "id": "NFR-001", "area": "availability", "text": "The booking page is up 99.95% of the time.", "label": "assumed" },
    { "id": "NFR-002", "area": "load", "text": "Bookings for the week open Monday 7am and most members book in the first ten minutes.", "label": "confirmed", "source": "kickoff call 2026-09-20" }
  ],
  "integrations": [{ "id": "INT-001", "system": "Club membership spreadsheet", "direction": "read", "label": "confirmed", "source": "PO brief" }],
  "data": [{ "id": "DAT-001", "entity": "Booking", "sensitivity": "personal", "volume": "about 900 per week", "label": "confirmed", "source": "PO brief" }],
  "constraints": [{ "id": "CON-001", "text": "Must run in AWS eu-west-1.", "source": "client IT policy" }],
  "assumptions": [{ "id": "ASM-001", "text": "Members log in with their email address.", "impact": "medium", "status": "unconfirmed" }],
  "openQuestions": [],
  "conflicts": [],
  "scope": { "out": ["coaching sessions"], "future": [], "unconfirmed": [] },
  "ai": null,
  "readiness": { "overall": 80, "areas": {}, "blockers": [] }
}
```

- [ ] **Step 2: Write `requirements.md`**

```markdown
# Courtside Club — requirements

## Part 1 — Context

Members book padel courts by phone; the front desk double-books at peak hours.

## Part 3 — Requirements

| ID | Requirement | Label | Scope |
| --- | --- | --- | --- |
| FR-001 | Members book up to 4 courts per week. | confirmed | in |
| FR-002 | Two members can never hold the same court and hour. | confirmed | in |
| FR-003 | Members pay a deposit online when booking. | recommended | in |

NFR-001 (assumed): The booking page is up 99.95% of the time.
NFR-002 (confirmed): Bookings for the week open Monday 7am and most members book in the first ten minutes.
CON-001: Must run in AWS eu-west-1.
```

- [ ] **Step 3: Append eval 4 to `evals/evals.json`**

```json
{
  "id": 4,
  "name": "ba-package-citations",
  "prompt": "greenfield - court booking app for Courtside Club, no code yet. The business-analyst package (requirements.json and requirements.md) is in this folder; write ARCHITECTURE.md beside it. I'm Sam, the PO. Don't ask me anything: take your recommended option on every card and log it. Write ARCHITECTURE.md and ADRs; don't start the viewer.",
  "expected_output": "The skill reads requirements.json with scripts/ba-facts.mjs, never extracts requirements.md, cites confirmed rows as stated [<id> · <source>](requirements.json), keeps assumed and recommended rows out of stated, and validates with requirements.json in --inputs with no FAIL.",
  "files": [
    "plugins/solution-architect/skills/analyze-requirements/evals/fixtures/ba-package-citations/requirements.json",
    "plugins/solution-architect/skills/analyze-requirements/evals/fixtures/ba-package-citations/requirements.md"
  ],
  "assertions": [
    "json-by-script: the run invokes scripts/ba-facts.mjs on requirements.json and never invokes workflows/extract.js on requirements.md",
    "md-never-cited: no citation in any written document points at requirements.md",
    "confirmed-cited-by-id: the double-booking rule is cited stated [FR-002 · kickoff call 2026-09-20](requirements.json) with no quote",
    "constraint-cited: AWS eu-west-1 appears in §2 cited stated [CON-001 · client IT policy](requirements.json)",
    "assumed-not-stated: the 99.95% uptime figure is never on a stated row or citation; it is proposed, asked, or absent",
    "recommended-not-stated: the online deposit is never cited stated [FR-003 ...]",
    "spike-goal-from-package: §13 includes Spike handling backed by the NFR-002 text about Monday 7am",
    "validate-clean: validate.mjs runs with requirements.json in --inputs and prints no FAIL"
  ]
}
```

- [ ] **Step 4: Verify**

Run: `node -e 'const e=JSON.parse(require("fs").readFileSync("plugins/solution-architect/skills/analyze-requirements/evals/evals.json"));console.log(e.evals.map(x=>x.id))' && node plugins/solution-architect/skills/analyze-requirements/scripts/ba-facts.mjs --json plugins/solution-architect/skills/analyze-requirements/evals/fixtures/ba-package-citations/requirements.json --out /tmp/ba-eval.json && npm test`
Expected: `[ 0, 1, 2, 3, 4 ]`; `ok 6 confirmed facts, 2 not confirmed (assumed or recommended)`; `npm test` passes.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/evals
git commit -m "test(analyze-requirements): BA package eval"
```

- [ ] **Step 6: Stop for the human test**

Report:
- the worktree path, the branch, the commit list and the `npm test` count;
- the manual check: run the skill with `claude --plugin-dir plugins/solution-architect` in a copy of `evals/fixtures/ba-package-citations/`;
- the single-case eval command `--case ba-package-citations`.

Do not merge, push or bump the version.
