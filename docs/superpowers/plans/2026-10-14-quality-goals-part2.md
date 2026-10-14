# Cited `stated` Facts (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `stated` fact in an `analyze-requirements` set cites where it came from — an exact quote from a client input file, or a saved interview answer — and the validator checks the quotes word for word.

**Architecture:** One pure lib (`validate-quotes.mjs`) does quote matching for two callers: `validate.mjs` (citations in ARCHITECTURE.md) and a new `check-quotes.mjs` CLI (facts coming out of extraction). A new workflow `extract.js` reads each input file in its own subagent so raw transcripts never enter the main context. `validate-provenance.mjs` warns on a bare `stated`. The rest is skill instructions.

**Tech Stack:** Node ≥ 20 ESM, `node:test`, Workflow script API (`agent`, `parallel`, `phase`, `log`, `args`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` — Part 2 only (D9–D14). Part 1 is `docs/superpowers/plans/2026-10-14-quality-goals-part1.md`.

## Global Constraints

- **Starts after Part 1 is merged into `feat/quality-goals`.** Depends on Part 1's `WARN` finding level (`level: 'warn'` printed as `WARN [...]`, never changes the exit code) and `buildInputs` returning `archMd`.
- Node ≥ 20; no new npm dependencies.
- Quality gates: ≤ 20 lines per function, ≤ 3 parameters, nesting ≤ 2, ≤ 200 lines and ≤ 10 functions per file.
- TDD: every test runs and fails before its code exists.
- Commits: Conventional Commits, subject ≤ 50 chars, no AI attribution trailers of any kind.
- Citation formats, verbatim from the spec (D9):
  - transcript: `stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "exact quote"`
  - interview: `stated [Q3 · 2026-10-14](interview-log.md#q3)`
- Input IDs (D11): `C` call, `E` email, `N` note, `D` other document; files named `<ID>-<slug>.<txt|md>`.
- Bare `stated` → `WARN` in this release, never `FAIL`.
- Plugin version `3.1.0` → `3.2.0` in `plugins/solution-architect/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
- `npm test` from the repo root passes at the end of every task. Do not merge; stop at Task 8.

## Review Focus

1. **Curly quotes and apostrophes** in exported transcripts (`“…”`, `don’t`) against a straight-quoted citation → must match. Pinned in Task 1.
2. **A quote that wraps across lines** in the source file → whitespace is normalised, must match. Pinned in Task 1.
3. **The brief arrived in chat, no input files** → `Brief says` quotes have nothing to check against; no `FAIL`. Pinned in Task 1.
4. **ARCHITECTURE.md in a subdirectory** (`docs/ARCHITECTURE.md`) → citation paths resolve relative to it, not to the root. Pinned in Task 3.
5. **An input path in the facts file that does not exist** → `check-quotes` reports it as a miss, never crashes. Pinned in Task 4.

---

### Task 1: `validate-quotes` lib

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/validate-quotes.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes.test.mjs`

**Interfaces:**
- Consumes: table objects from `md-tables.mjs` `parseTables` — `{ section, headers: string[], rows: string[][] }`.
- Produces:
  - `normalize(text: string) → string` — curly quotes → straight, whitespace runs → one space, trimmed.
  - `parseCitations(md: string) → Array<{ label: string, path: string, quote: string|null }>` — `path` is the href as written, fragment removed.
  - `closestSentence(text: string, quote: string) → string`
  - `briefQuotesOf(tables) → string[]` — the §13 `Brief says` cells, surrounding quotes stripped, empty / `—` / `Not provided…` cells skipped.
  - `validateQuotes({ citations, briefQuotes, sources }) → Array<{ check: 'quotes', message }>` — `sources` is a `Map<rootRelativePath, text>`; `citations[].path` must already be root-relative.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize, parseCitations, closestSentence, briefQuotesOf, validateQuotes,
} from '../lib/validate-quotes.mjs';

const C1 = 'Maya: We open sales at 10am sharp. For a headline act we get ten times the orders\nin the first five minutes.\nMaya: We don’t want to touch card data.';
const sources = new Map([['inputs/C1-kickoff-call.txt', C1]]);
const cite = (quote) => ({ label: 'C1 · 2026-09-10', path: 'inputs/C1-kickoff-call.txt', quote });

test('normalize folds curly quotes and whitespace', () => {
  assert.equal(normalize('  don’t  “x”\n y '), 'don\'t "x" y');
});

test('parseCitations reads label, path without fragment, and quote', () => {
  const md = '| a | stated [C1 · 2026-09-10](inputs/C1.txt) "ten times" |\n| b | stated [Q3 · 2026-10-14](interview-log.md#q3) |';
  assert.deepEqual(parseCitations(md), [
    { label: 'C1 · 2026-09-10', path: 'inputs/C1.txt', quote: 'ten times' },
    { label: 'Q3 · 2026-10-14', path: 'interview-log.md', quote: null },
  ]);
});

test('passes an exact quote, a wrapped quote, and a straight-quoted apostrophe', () => {
  const citations = [
    cite('We open sales at 10am sharp.'),
    cite('ten times the orders in the first five minutes'),
    cite("We don't want to touch card data."),
  ];
  assert.deepEqual(validateQuotes({ citations, briefQuotes: [], sources }), []);
});

test('fails a reworded quote and names the closest sentence', () => {
  const out = validateQuotes({ citations: [cite('ten times more orders in five minutes')], briefQuotes: [], sources });
  assert.equal(out.length, 1);
  assert.equal(out[0].check, 'quotes');
  assert.match(out[0].message, /not found in inputs\/C1-kickoff-call\.txt; closest: "For a headline act/);
});

test('is case-sensitive', () => {
  assert.equal(validateQuotes({ citations: [cite('we open sales at 10am sharp.')], briefQuotes: [], sources }).length, 1);
});

test('skips interview citations and citations to files not loaded', () => {
  const citations = [
    { label: 'Q3', path: 'interview-log.md', quote: null },
    { label: 'E9', path: 'inputs/E9.md', quote: 'anything' },
  ];
  assert.deepEqual(validateQuotes({ citations, briefQuotes: [], sources }), []);
});

test('Brief says quotes must appear in some input, and are skipped with no inputs', () => {
  assert.deepEqual(validateQuotes({ citations: [], briefQuotes: ['10am sharp'], sources }), []);
  const out = validateQuotes({ citations: [], briefQuotes: ['sold out in seconds'], sources });
  assert.match(out[0].message, /Brief says "sold out in seconds" is in no input file/);
  assert.deepEqual(validateQuotes({ citations: [], briefQuotes: ['anything'], sources: new Map() }), []);
});

test('briefQuotesOf reads the §13 Brief says column', () => {
  const t = {
    section: '13 Quality Requirements and SLOs',
    headers: ['Goal', 'Target', 'Brief says', 'src'],
    rows: [['Speed', 't', '"10am sharp"', 'stated'], ['Uptime', 't', '—', 'stated'], ['Not provided — x', '', '', 'stated']],
  };
  assert.deepEqual(briefQuotesOf([t]), ['10am sharp']);
  assert.deepEqual(briefQuotesOf([]), []);
});

test('closestSentence picks the sentence sharing most words', () => {
  assert.match(closestSentence(C1, 'orders in five minutes'), /^For a headline act/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes.test.mjs`
Expected: FAIL — `Cannot find module '../lib/validate-quotes.mjs'`.

- [ ] **Step 3: Write the implementation**

```js
// A `stated` fact that quotes a source must quote it word for word: a model
// that paraphrases and still says "the client said" is what citations exist
// to catch. Matching text is free and deterministic, so no agent checks it.
// Exact apart from whitespace and curly quotes — transcripts wrap lines and
// Word exports curl apostrophes; neither changes what was said.
const CITATION = /stated \[([^\]]+)\]\(([^)\s#]+)(?:#[^)\s]*)?\)(?: "([^"]+)")?/g;
const EMPTY = /^(—|-|Not provided.*)?$/;

export function normalize(text) {
  return text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ').trim();
}

export function parseCitations(md) {
  return [...md.matchAll(CITATION)].map((m) => ({ label: m[1], path: m[2], quote: m[3] ?? null }));
}

export function closestSentence(text, quote) {
  const words = new Set(normalize(quote).toLowerCase().split(' '));
  const score = (s) => s.toLowerCase().split(' ').filter((w) => words.has(w)).length;
  const sentences = normalize(text).split(/(?<=[.!?])\s+/);
  return sentences.reduce((best, s) => (score(s) > score(best) ? s : best), sentences[0] ?? '');
}

export function briefQuotesOf(tables) {
  const t = tables.find((x) => /Quality Requirements/i.test(x.section));
  const col = (t?.headers ?? []).findIndex((h) => /^brief says$/i.test(h));
  if (col === -1) return [];
  return t.rows.map((r) => (r[col] ?? '').trim().replace(/^"|"$/g, ''))
    .filter((q) => !EMPTY.test(q));
}

// sources maps root-relative path → text. A citation to a file not in the map
// is left to the links check, which already fails a missing target.
export function validateQuotes({ citations, briefQuotes, sources }) {
  return [...citationFindings(citations, sources), ...briefFindings(briefQuotes, sources)];
}

function citationFindings(citations, sources) {
  return citations.filter((c) => c.quote && sources.has(c.path))
    .filter((c) => !normalize(sources.get(c.path)).includes(normalize(c.quote)))
    .map((c) => ({
      check: 'quotes',
      message: `"${c.quote}" not found in ${c.path}; closest: "${closestSentence(sources.get(c.path), c.quote)}"`,
    }));
}

// A Brief says quote names no file, so any input may hold it. With no inputs
// at all (the brief arrived in chat) there is nothing to check it against.
function briefFindings(quotes, sources) {
  if (!sources.size) return [];
  const all = [...sources.values()].map(normalize);
  return quotes.filter((q) => !all.some((t) => t.includes(normalize(q))))
    .map((q) => ({ check: 'quotes', message: `Brief says "${q}" is in no input file` }));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes.test.mjs`
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/validate-quotes.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes.test.mjs
git commit -m "feat(analyze-requirements): quote matching lib"
```

---

### Task 2: Warn on a bare `stated`

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/validate-provenance.mjs` (`checkTable`)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-provenance.test.mjs` (append)

**Interfaces:**
- Produces: `validateProvenance({ tables })` additionally returns `{ check: 'provenance', message: '"<section>" row "<first cell>": stated has no citation', level: 'warn' }` for each row whose `src` starts with `stated` and holds no `[label](href)`. Existing failure messages unchanged.

- [ ] **Step 1: Write the failing tests** (append)

```js
test('warns, never fails, on a stated row with no citation', () => {
  const t = { section: 'Constraints', headers: ['C', 'src'], rows: [['azure', 'stated']] };
  const out = validateProvenance({ tables: [t] });
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'warn');
  assert.match(out[0].message, /"Constraints" row "azure": stated has no citation/);
});

test('accepts a cited stated row, with or without a quote', () => {
  const t = {
    section: 'Constraints', headers: ['C', 'src'],
    rows: [
      ['azure', 'stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "it has to run there"'],
      ['owner', 'stated [Q2 · 2026-10-14](interview-log.md#q2)'],
    ],
  };
  assert.deepEqual(validateProvenance({ tables: [t] }), []);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-provenance.test.mjs`
Expected: the first new test FAILS (no finding returned); the second passes already.

- [ ] **Step 3: Replace `checkTable` and add `checkCell`**

```js
const CITED = /\[[^\]]+\]\([^)\s]+\)/;

function checkTable(t) {
  const col = t.headers.indexOf('src');
  if (col === -1) {
    return [{ check: 'provenance', message: `table in "${t.section}" has no src column` }];
  }
  return t.rows.flatMap((r) => checkCell(t.section, r[0], r[col] ?? ''));
}

// Bare `stated` only warns: every set written before citations existed has it
// in every table, and failing them all would block every re-render at once.
function checkCell(section, name, cell) {
  if (!ALLOWED.some((a) => cell.startsWith(a))) {
    return [{ check: 'provenance', message: `"${section}" row "${name}": bad src "${cell}"` }];
  }
  if (cell.startsWith('stated') && !CITED.test(cell)) {
    return [{ check: 'provenance', message: `"${section}" row "${name}": stated has no citation`, level: 'warn' }];
  }
  return [];
}
```

- [ ] **Step 4: Run the file's tests and the full suite**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-provenance.test.mjs && npm test`
Expected: PASS. Part 1's `validate-strategy-cli.test.mjs` uses bare `stated` and now also prints `WARN [provenance]` lines; its assertions (exit code, `^WARN \[strategy\]`, `^FAIL \[strategy\]`) still hold.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/validate-provenance.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-provenance.test.mjs
git commit -m "feat(analyze-requirements): warn on uncited stated"
```

---

### Task 3: Inputs and quote checks in `validate.mjs`

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/inputs.mjs` (`buildInputs`, new `citationsOf`)
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs` (`parseArgs`, `buildInputs` call, `findings`)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes-cli.test.mjs`

**Interfaces:**
- Consumes: `parseCitations`, `briefQuotesOf`, `validateQuotes` (Task 1).
- Produces: `buildInputs({ root, archPath, modelPath, docPaths = [], inputPaths = [] })` also returns `sources: Map<rootRelPath, text>` and `citations: Array<{ label, path /* root-relative */, quote }>`; input paths join `files`, so the links check accepts citations to them. CLI flag `--inputs <file…>` (same list form as `--docs`).

- [ ] **Step 1: Write the failing CLI tests**

```js
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes-cli.test.mjs`
Expected: FAIL — first test exits 1 (`target file missing`, inputs not yet in `files`); nested test fails on `inputs.citations` undefined.

- [ ] **Step 3: Implement `buildInputs`**

In `scripts/lib/inputs.mjs`, change the import line for `node:path` to `import { dirname, join, relative } from 'node:path';`, add `import { parseCitations } from './validate-quotes.mjs';`, and make `buildInputs`:

```js
export async function buildInputs({ root, archPath, modelPath, docPaths = [], inputPaths = [] }) {
  const arch = await readFile(archPath, 'utf8');
  const docs = await readDocs(root, [archPath, ...docPaths]);
  const sources = await readDocs(root, inputPaths);
  return {
    archMd: arch,
    frontmatter: parseFrontmatter(arch).data ?? {},
    tables: parseTables(arch),
    erNames: erEntities(arch),
    model: extractModel(JSON.parse(await readFile(modelPath, 'utf8'))),
    links: docs.flatMap((d) => extractLinks(d.md).map((l) => ({ fromDoc: d.path, href: l.href }))),
    files: [...docs, ...sources].map((d) => d.path),
    anchors: Object.fromEntries(docs.map((d) => [d.path, headingSlugs(d.md)])),
    sources: new Map(sources.map((d) => [d.path, d.md])),
    citations: citationsOf(root, archPath, arch),
  };
}

// Citations are written relative to ARCHITECTURE.md; sources are keyed
// relative to the root. Same frame as validate-links, or a nested set fails.
function citationsOf(root, archPath, md) {
  return parseCitations(md).map((c) => ({ ...c, path: relative(root, join(dirname(archPath), c.path)) }));
}
```

(Keep `archMd` exactly as Part 1 added it; only `files`, `sources`, `citations`, the new parameter and `citationsOf` are new.)

- [ ] **Step 4: Wire `validate.mjs`**

Add the import:

```js
import { validateQuotes, briefQuotesOf } from './lib/validate-quotes.mjs';
```

In `parseArgs`, initialise `{ root: process.cwd(), docs: [], inputs: [] }` and replace the `if (flag === '--docs')` branch with:

```js
    if (flag === '--docs' || flag === '--inputs') {
      i = consumeDocs(argv, i, args[flag.slice(2)]);
    } else if (flag.startsWith('--')) {
```

Pass `inputPaths: args.inputs` to `buildInputs`, and add to `findings` after `validateStrategy(...)`:

```js
  ...validateQuotes({ citations: inputs.citations, briefQuotes: briefQuotesOf(inputs.tables), sources: inputs.sources }),
```

- [ ] **Step 5: Run the new tests and the full suite**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes-cli.test.mjs && npm test`
Expected: all 4 PASS; suite PASS (`inputs.test.mjs` checks `files` for a set with no inputs, unchanged).

- [ ] **Step 6: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/inputs.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-quotes-cli.test.mjs
git commit -m "feat(analyze-requirements): check cited quotes"
```

---

### Task 4: `check-quotes.mjs` CLI for extracted facts

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/check-quotes.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/check-quotes-cli.test.mjs`

**Interfaces:**
- Consumes: `normalize`, `closestSentence` (Task 1); the `facts` array `extract.js` returns (Task 5): `{ fact, quote, section, src, date, path }`, `path` absolute.
- Produces: `node scripts/check-quotes.mjs --facts <in.json> --out <out.json>`. Input `{ facts: [...] }`. Writes `{ facts: <verified>, misses: [<fact + closest>] }`. Prints `MISS [<src>] "<quote>" — closest: "<sentence>"` per miss, then `ok <n> quotes verified, <m> missed`. Exit 1 when any miss, else 0.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/check-quotes.mjs';

function check(facts) {
  const dir = mkdtempSync(join(tmpdir(), 'check-quotes-'));
  const call = join(dir, 'C1.txt');
  writeFileSync(call, 'Maya: We pay for Azure already, so it has to run there.\n');
  const withPath = facts.map((f) => ({ section: 'constraints', src: 'C1', date: '2026-09-10', path: call, ...f }));
  writeFileSync(join(dir, 'in.json'), JSON.stringify({ facts: withPath }));
  const r = spawnSync('node', [CLI, '--facts', join(dir, 'in.json'), '--out', join(dir, 'out.json')], { encoding: 'utf8' });
  return { r, out: JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8')) };
}

test('all quotes found: exit 0, every fact kept', () => {
  const { r, out } = check([{ fact: 'must run on Azure', quote: 'it has to run there' }]);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(out.facts.length, 1);
  assert.deepEqual(out.misses, []);
});

test('a reworded quote is a miss with the closest sentence; the rest are kept', () => {
  const { r, out } = check([
    { fact: 'Azure', quote: 'it has to run there' },
    { fact: 'Azure', quote: 'it must run on Azure' },
  ]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^MISS \[C1\] "it must run on Azure" — closest: "Maya: We pay for Azure/m);
  assert.equal(out.facts.length, 1);
  assert.equal(out.misses[0].closest.startsWith('Maya: We pay'), true);
});

test('an unreadable input file is a miss, not a crash', () => {
  const { r, out } = check([{ fact: 'x', quote: 'y', path: '/nonexistent/C9.txt', src: 'C9' }]);
  assert.equal(r.status, 1);
  assert.match(out.misses[0].closest, /file not readable/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/check-quotes-cli.test.mjs`
Expected: FAIL — `Cannot find module` for the CLI.

- [ ] **Step 3: Write the CLI**

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { normalize, closestSentence } from './lib/validate-quotes.mjs';

// Gate between extraction and the interview (references/extract.md): a fact
// whose quote is not in its file never reaches the main agent as `stated`.
// Misses go back to their extract agent once; what still misses is dropped.

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].slice(2)] = argv[i + 1];
  return args;
}

function readSource(path, cache) {
  if (!cache.has(path)) {
    try { cache.set(path, readFileSync(path, 'utf8')); } catch { cache.set(path, null); }
  }
  return cache.get(path);
}

function missOf(fact, cache) {
  const text = readSource(fact.path, cache);
  if (text === null) return { ...fact, closest: `file not readable: ${fact.path}` };
  if (normalize(text).includes(normalize(fact.quote))) return null;
  return { ...fact, closest: closestSentence(text, fact.quote) };
}

const args = parseArgs(process.argv.slice(2));
const { facts } = JSON.parse(readFileSync(args.facts, 'utf8'));
const cache = new Map();
const checked = facts.map((f) => ({ fact: f, miss: missOf(f, cache) }));
const kept = checked.filter((c) => !c.miss).map((c) => c.fact);
const misses = checked.filter((c) => c.miss).map((c) => c.miss);

for (const m of misses) console.log(`MISS [${m.src}] "${m.quote}" — closest: "${m.closest}"`);
console.log(`ok ${kept.length} quotes verified, ${misses.length} missed`);
writeFileSync(args.out, JSON.stringify({ facts: kept, misses }, null, 2));
process.exit(misses.length ? 1 : 0);
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/check-quotes-cli.test.mjs`
Expected: all 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/check-quotes.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/check-quotes-cli.test.mjs
git commit -m "feat(analyze-requirements): check extracted quotes"
```

---

### Task 5: `extract.js` workflow

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/workflows/extract.js`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/extract-workflow.test.mjs`

**Interfaces:**
- Consumes: Workflow globals `agent`, `parallel`, `phase`, `log`, `args` (same as `workflows/research.js`).
- Produces: `args = { files: [{ id: 'C1', path: '<absolute path>', date: '2026-09-10', fix?: [{ fact, quote, closest }] }], question?: string }` → returns `{ facts: [{ fact, quote, section, src, date, path }], dropped: [{ item, reason }] }`. `src`, `date`, `path` are copied from the file entry, never from the agent.

- [ ] **Step 1: Write the failing tests** (harness copied from `research-workflow.test.mjs`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../workflows/extract.js', import.meta.url), 'utf8')
  .replace(/^export const meta =/m, 'const meta =');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

function run({ agentImpl, args }) {
  const calls = { prompts: [], logs: [] };
  const agent = (p, o) => { calls.prompts.push(p); return agentImpl(p, o); };
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', src);
  const parallel = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)));
  return fn(agent, parallel, null, () => {}, (m) => calls.logs.push(m), args,
    { total: null, spent: () => 0, remaining: () => Infinity }).then((result) => ({ result, calls }));
}

const FILES = [
  { id: 'C1', path: '/set/inputs/C1-kickoff-call.txt', date: '2026-09-10' },
  { id: 'E1', path: '/set/inputs/E1-intro-email.md', date: '2026-09-08' },
];
const okAgent = async () => ({ facts: [{ fact: 'runs on Azure', quote: 'it has to run there', section: 'deployment and hosting' }] });

test('one agent per file; facts tagged with the file id, date and path', async () => {
  const { result, calls } = await run({ agentImpl: okAgent, args: { files: FILES } });
  assert.equal(calls.prompts.length, 2);
  assert.deepEqual(result.facts.map((f) => [f.src, f.date, f.path]), [
    ['C1', '2026-09-10', '/set/inputs/C1-kickoff-call.txt'],
    ['E1', '2026-09-08', '/set/inputs/E1-intro-email.md'],
  ]);
});

test('default prompt names the file, the exact-quote rule and the checklist', async () => {
  const { calls } = await run({ agentImpl: okAgent, args: { files: [FILES[0]] } });
  assert.match(calls.prompts[0], /\/set\/inputs\/C1-kickoff-call\.txt/);
  assert.match(calls.prompts[0], /character for character/);
  assert.match(calls.prompts[0], /deployment and hosting/);
});

test('question mode asks only the question', async () => {
  const { calls } = await run({ agentImpl: okAgent, args: { files: [FILES[0]], question: 'what about hosting?' } });
  assert.match(calls.prompts[0], /Answer only this: what about hosting\?/);
  assert.doesNotMatch(calls.prompts[0], /users and actors/);
});

test('fix mode hands back the missed quotes', async () => {
  const fix = [{ fact: 'Azure', quote: 'it must run on Azure', closest: 'We pay for Azure already' }];
  const { calls } = await run({ agentImpl: okAgent, args: { files: [{ ...FILES[0], fix }] } });
  assert.match(calls.prompts[0], /it must run on Azure/);
  assert.match(calls.prompts[0], /not found in the file/);
});

test('a failed agent lands in dropped; other files still return facts', async () => {
  const flaky = async (p) => (p.includes('E1-intro') ? null : okAgent());
  const { result, calls } = await run({ agentImpl: flaky, args: { files: FILES } });
  assert.deepEqual(result.dropped, [{ item: 'E1', reason: 'agent returned nothing' }]);
  assert.equal(result.facts.length, 1);
  assert.ok(calls.logs.some((l) => l.includes('DROPPED E1')));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/extract-workflow.test.mjs`
Expected: FAIL — `ENOENT` reading `workflows/extract.js`.

- [ ] **Step 3: Write the workflow**

```js
export const meta = {
  name: 'arch-docs-extract',
  description: 'One agent per client input file: facts backed by exact quotes',
  phases: [{ title: 'Extract', detail: 'one agent per input file' }],
}

const FACTS = { type: 'object', required: ['facts'], properties: { facts: { type: 'array', items: {
  type: 'object', required: ['fact', 'quote', 'section'],
  properties: { fact: { type: 'string' }, quote: { type: 'string' }, section: { type: 'string' } },
} } } }

// The spine sections a client input can speak to; the agent hunts each one so
// a fact is missed by omission less often (references/extract.md).
const CHECKLIST = [
  'goals and scope',
  'users and actors',
  'constraints: budget, deadline, mandated tech, compliance',
  'quality: speed, load spikes, uptime, data loss, reliability, security, running cost',
  'external systems and integrations',
  'data and its sensitivity',
  'deployment and hosting',
]

const RULES = 'Read the file with the Read tool. Every fact carries a quote copied character for character from the file: no rewording, no joining separate sentences, no fixing typos. A fact you cannot quote is left out. Small talk is left out.'

function promptFor(file) {
  const head = `${RULES}\nFile: ${file.path}\n`
  if (file.fix) return `${head}These quotes were not found in the file. For each, return the fact again with a quote copied exactly from the file, or leave it out:\n${JSON.stringify(file.fix)}`
  if (args.question) return `${head}Answer only this: ${args.question}`
  return `${head}Work through each topic and return every fact the file states about it, with section set to the topic:\n- ${CHECKLIST.join('\n- ')}`
}

const dropped = []
const tag = (file) => (r) => {
  if (r) return r.facts.map((f) => ({ ...f, src: file.id, date: file.date, path: file.path }))
  dropped.push({ item: file.id, reason: 'agent returned nothing' })
  log(`DROPPED ${file.id}: agent returned nothing`)
  return []
}

phase('Extract')
const facts = (await parallel(args.files.map((file) => () =>
  agent(promptFor(file), { label: `extract-${file.id}`, phase: 'Extract', schema: FACTS }).then(tag(file))
))).flat()

log(`extract done: ${facts.length} facts from ${args.files.length} files, ${dropped.length} dropped`)
return { facts, dropped }
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/extract-workflow.test.mjs`
Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/workflows/extract.js \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/extract-workflow.test.mjs
git commit -m "feat(analyze-requirements): extract workflow"
```

---

### Task 6: Skill instructions

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/references/extract.md`
- Modify: `plugins/solution-architect/skills/analyze-requirements/SKILL.md` (hard rule 1, Flow)
- Modify: `plugins/solution-architect/skills/analyze-requirements/references/writing.md` (§3 Table format rules)
- Modify: `plugins/solution-architect/skills/analyze-requirements/references/interview.md` (hard rule 4; new "Interview log" section)

No code; Task 7's eval assertions check this wording.

- [ ] **Step 1: Create `references/extract.md`**

````markdown
# Extract — client inputs to quoted facts

Read at SKILL.md step 3, before the interview, whenever the user supplies
client material (call transcripts, emails, notes, documents).

## 1. Inputs

- Client files live in `inputs/` beside ARCHITECTURE.md, unless the user
  points elsewhere — then cite them where they are.
- Each file has an ID: `C` call, `E` email, `N` note, `D` other document,
  numbered per kind in date order (`C1`, `C2`, `E1`). Named
  `<ID>-<slug>.<txt|md>` when the skill files them; an existing name is
  kept and the ID recorded in `interview-log.md`'s header instead.
- The skill reads inputs, never edits them (hard rule 5: not ours).

## 2. Run

1. Invoke `workflows/extract.js` with
   `args = { files: [{ id, path: <absolute>, date: 'YYYY-MM-DD' }] }`.
   **Never read an input file into the main context yourself.**
2. Save the returned `facts` as `{ "facts": [...] }` to a temp file and run
   `node scripts/check-quotes.mjs --facts <tmp>/facts.json --out <tmp>/checked.json`.
3. Exit 1: re-invoke `extract.js` once, with only the files that missed and
   `fix: <that file's misses>` on each. Append the returned facts to
   `checked.json`'s `facts`, run `check-quotes` again on them, and stop.
   Whatever still misses is dropped.
4. Surface `dropped` (from `extract.js`) and the dropped misses to the user
   before the interview, as research does (`research.md` §4).

## 3. Follow-up questions

When writing needs something the facts do not cover ("what does C1 say
about hosting?"), invoke `extract.js` with that one file and
`question: '<the question>'`, then `check-quotes` its facts. One file, one
question — never re-extract everything.

## 4. Using the facts

- A verified fact is `stated`, cited
  `stated [<src> · <date>](<path relative to ARCHITECTURE.md>) "<quote>"`.
- Quality-goal candidates (`quality-goals.md`) come from facts whose
  `section` is `quality…`; the quote becomes the `Brief says` cell.
- Research (`research.md`) gets `statedFacts: [{ claim: fact }]` as before;
  keep each fact's citation yourself and write it back — research never
  changes a citation.
````

- [ ] **Step 2: SKILL.md**

Hard rule 1 — append one sentence:

```
`stated` always cites its source: an input quote or an interview-log entry (`references/writing.md` §3).
```

Flow — replace steps 3–7 (the block starting `3. **Interview**`, which Part 1 already edited) with:

```
3. **Extract** (when the user supplied client files): follow `references/extract.md` — `workflows/extract.js`, then `node scripts/check-quotes.mjs`. Never read input files into the main context.
4. **Interview**: follow `references/interview.md`; §13 quality goals per `references/quality-goals.md` (propose top 3 from evidence, never ask cold). Record every answer in `interview-log.md` as it arrives. Detect project type per `references/project-types.md`.
5. **Research**: run `workflows/research.js` per `references/research.md`. Surface dropped items before writing.
6. **Write**: on every run, `node scripts/drift.mjs` gates this step — before the first write, never after (`references/rewriting.md`). Then the model (`references/likec4.md`), then ARCHITECTURE.md and companions (`references/writing.md`). Last, once every document is on disk, record what was written, `interview-log.md` included: `node scripts/record.mjs --state ... --files ...`.
7. **Validate**: export the model with `node scripts/likec4-export.mjs --dir ... --out ...`, then `node scripts/validate.mjs --arch ... --model ... --docs interview-log.md ... --inputs <input files>` (add `--mode brownfield --clusters ...` when applicable). Fix every `FAIL`; a `WARN` is reported to the user, not blocking. Re-run until no `FAIL`.
8. **Render + serve**: follow `references/viewer.md`, passing `interview-log.md` in `--docs`; report the URL.
```

- [ ] **Step 3: `references/writing.md` §3** — replace the bullet starting `- Values are one of the four provenance words` with:

```markdown
- Values are one of the four provenance words: `observed` · `stated` ·
  `researched` · `proposed`. `researched` is always followed by a bracketed
  source: `researched [source]`.
- `stated` is always followed by its citation:
  - from a client input: `stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "exact quote"` —
    the quote copied from a fact `check-quotes.mjs` verified, in straight
    double quotes (use single quotes inside it);
  - from the interview: `stated [Q3 · 2026-10-14](interview-log.md#q3)` — no quote.
  The path is relative to ARCHITECTURE.md. `validate.mjs` checks the quote
  word for word; a bare `stated` is a `WARN`.
- In the viewer an interview citation links to the log; an input citation
  shows as text with its path on hover (inputs are not part of the page).
```

- [ ] **Step 4: `references/interview.md`**

Replace hard rule 4 with:

```markdown
4. Every answer is recorded with provenance `stated` — including confirmations
   of a detected default — and written to `interview-log.md` the moment the
   card returns (see "Interview log").
```

Append a section:

```markdown
## Interview log

`interview-log.md` sits beside ARCHITECTURE.md. One entry per answer,
written as soon as the card returns:

    # Interview log

    ### Q3
    **Asked** 2026-10-14 · **Answered by** Truong Vu (PO), on behalf of Trellis
    **Card** Quality goals — "Recommended top 3: Uptime, Integration, Speed"
    **Answer** Confirm top 3

- Numbering continues across runs; an existing entry is never edited or
  renumbered — other documents cite it.
- **Answered by** names the person and role; "on behalf of <client>" when
  the PO answers for the client. An answer given in the user's opening
  message is logged too, with **Card** `— (in the request)`.
- A declined question is logged with **Answer** `declined`, so the
  `Not provided — …` cell that follows can cite it.
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/references/extract.md \
        plugins/solution-architect/skills/analyze-requirements/SKILL.md \
        plugins/solution-architect/skills/analyze-requirements/references/writing.md \
        plugins/solution-architect/skills/analyze-requirements/references/interview.md
git commit -m "docs(analyze-requirements): cite stated facts"
```

---

### Task 7: Transcript eval

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/evals/fixtures/transcript-citations/C1-kickoff-call.txt`
- Create: `plugins/solution-architect/skills/analyze-requirements/evals/fixtures/transcript-citations/E1-intro-email.md`
- Modify: `plugins/solution-architect/skills/analyze-requirements/evals/evals.json` (append eval id 3)

- [ ] **Step 1: Create the fixtures** (fictional client; no real data)

`C1-kickoff-call.txt`:

```
Kickoff call - Lumen Tickets - 2026-09-10
Participants: Maya Chen (founder, Lumen Tickets), Sam (PO, Code Engine Studio)

Sam: Tell me what happens when a big show goes on sale.
Maya: We open sales at 10am sharp. For a headline act we get ten times the orders in the first five minutes, and last spring the old site just fell over.
Sam: What did that cost you?
Maya: About forty thousand dollars in refunds and a lot of angry fans.
Sam: How do customers pay?
Maya: Payments go through Stripe, we don't want to touch card data ourselves.
Sam: Any hosting preference?
Maya: We pay for Azure already, so it has to run there.
Maya: Sorry, the cafe downstairs is playing jazz again, ignore that.
Sam: Anything on speed?
Maya: Checkout must be fast. People abandon if it hangs.
Sam: Budget?
Maya: We are small. Running costs need to stay under two thousand dollars a month outside sale days.
```

`E1-intro-email.md`:

```
From: Maya Chen
Date: 2026-09-08
Subject: Ticketing rebuild

Hi Sam,

As discussed, our box office staff still reconcile sales in a spreadsheet every night. We want seat inventory to be the single source of truth so we never sell the same seat twice.

Maya
```

- [ ] **Step 2: Append eval 3** to the `evals` array:

```json
{
  "id": 3,
  "name": "transcript-citations",
  "prompt": "greenfield - new ticketing platform for Lumen Tickets, no code yet. The kickoff call transcript (C1-kickoff-call.txt, 2026-09-10) and Maya's intro email (E1-intro-email.md, 2026-09-08) are in this folder - treat them as the client inputs. I'm Sam, the PO. Don't ask me anything: take your recommended option on every card and log it. Write ARCHITECTURE.md and ADRs; don't start the viewer.",
  "expected_output": "The skill extracts facts from both files with workflows/extract.js and verifies them with check-quotes.mjs before writing, never reading the files wholesale into its own reasoning. ARCHITECTURE.md cites every stated fact: input facts as stated [C1 · 2026-09-10](...) \"exact quote\", answers as stated [Qn · date](interview-log.md#qn). interview-log.md exists. validate.mjs prints no FAIL and no 'stated has no citation' warning.",
  "files": [
    "plugins/solution-architect/skills/analyze-requirements/evals/fixtures/transcript-citations/C1-kickoff-call.txt",
    "plugins/solution-architect/skills/analyze-requirements/evals/fixtures/transcript-citations/E1-intro-email.md"
  ],
  "assertions": [
    "extract-then-check: the run invokes workflows/extract.js on both input files and runs scripts/check-quotes.mjs on its output before any interview card or document is written",
    "spike-goal-quoted: §13 includes Spike handling with a 'Brief says' quote copied exactly from C1 ('ten times the orders in the first five minutes')",
    "seat-reliability-from-email: Reliability is a §13 goal or an 'Also considered' line, backed by the E1 quote 'never sell the same seat twice'",
    "vague-speed-not-invented: no numeric speed target is attributed to C1; 'Checkout must be fast' leads to a Speed target that is proposed, logged as an interview answer, or 'Not provided - ...'",
    "azure-constraint-cited: §2 lists Azure hosting as stated [C1 · 2026-09-10](...) with the quote 'We pay for Azure already, so it has to run there'",
    "stripe-not-top3: Security is not in the §13 top 3; it appears under 'Also considered' with Stripe handling card data as the reason",
    "noise-absent: nothing about jazz or the cafe appears in any written document",
    "every-stated-cites: every stated src cell in ARCHITECTURE.md carries a [label](path) citation, and interview-log.md has a ### Qn entry for each answer cited"
  ]
}
```

- [ ] **Step 3: Check the JSON parses and the suite passes**

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/solution-architect/skills/analyze-requirements/evals/evals.json','utf8'))" && npm test`
Expected: no parse output; suite PASS.

- [ ] **Step 4: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/evals
git commit -m "test(analyze-requirements): transcript citation eval"
```

---

### Task 8: Version bump and hand-off for human test

**Files:**
- Modify: `plugins/solution-architect/.claude-plugin/plugin.json` (`"version": "3.1.0"` → `"3.2.0"`)
- Modify: `.claude-plugin/marketplace.json` (the `solution-architect` entry, `"3.1.0"` → `"3.2.0"`)

- [ ] **Step 1: Bump both versions** to `3.2.0`.

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add plugins/solution-architect/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore(solution-architect): release 3.2.0"
```

- [ ] **Step 4: Stop.** Do not merge or push. Report the branch, commits and test count, with this manual check for the human: put a real call transcript and email in `inputs/` of a lead folder, run `/analyze-requirements`, confirm the main session never shows the raw transcript, quality-goal candidates carry quotes, `interview-log.md` fills as cards are answered, every `stated` in ARCHITECTURE.md cites C/E/Q, and `validate.mjs` shows no `FAIL`.
