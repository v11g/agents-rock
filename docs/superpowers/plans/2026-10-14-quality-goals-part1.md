# Top-3 Quality Goals (Part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `analyze-requirements` proposes the top 3 quality goals from evidence, records which gives way first, writes §4 Solution Strategy as a table whose every decision names the goal it serves, and the validator enforces the tie.

**Architecture:** One new pure validator lib (`validate-strategy.mjs`) reads the parsed tables plus the raw ARCHITECTURE.md text, wired into `validate.mjs` with a new non-blocking `WARN` finding level. Everything else is skill instructions (references, section explainers, SKILL.md) and eval assertions — the model follows them, the validator checks the output.

**Tech Stack:** Node ≥ 20 ESM, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` — Part 1 only (D1–D8, D15). Part 2 (citations, D9–D14) is a separate plan.

## Global Constraints

- Node ≥ 20; no new npm dependencies.
- Quality gates: ≤ 20 lines per function, ≤ 3 parameters, nesting ≤ 2, ≤ 200 lines and ≤ 10 functions per file.
- TDD: every test runs and fails before its code exists.
- Commits: Conventional Commits, subject ≤ 50 chars, no AI attribution trailers of any kind.
- Plugin version `3.0.1` → `3.1.0` in both `plugins/solution-architect/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
- Full suite: `npm test` from the repo root must pass at the end of every task.
- Do not merge to `main`. The branch stops at Task 6 for the human to test.

## Review Focus

1. **A set written before this change** (§13 `Requirement | Target | src`, §4 bullets) re-validated after the user declines a rewrite → must exit 0 with `WARN` lines, never block the viewer. Pinned in Task 1 (legacy tests) and Task 2 (CLI test).
2. **User declines quality questions on thin input** → §13 has `Not provided — …` Goal rows; validator must not demand they be served or marked. Pinned in Task 1.
3. **Serves cell copies the §13 label verbatim**, e.g. `Speed (gives way first)` or different case → must match. Pinned in Task 1.
4. **§13 or §4 rendered `Not applicable — <reason>`** (no table) → no strategy findings at all. Pinned in Task 1.
5. **A `### ` subheading inside §4** must not end the §4 body early, so bullets under it still warn. Pinned in Task 1.

---

### Task 1: `validate-strategy` lib

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/validate-strategy.mjs`
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy.test.mjs`

**Interfaces:**
- Consumes: table objects from `scripts/lib/md-tables.mjs` `parseTables` — `{ section: string, headers: string[], rows: string[][] }`; `section` is the nearest heading text without `#` (e.g. `13 Quality Requirements and SLOs`).
- Produces: `validateStrategy({ tables, archMd }) → Array<{ check: 'strategy', message: string, level?: 'warn' }>`. A finding with no `level` is a failure.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStrategy } from '../lib/validate-strategy.mjs';

const GOALS = '13 Quality Requirements and SLOs';
const STRATEGY = '4 Solution Strategy';
const goals = (...cells) => ({
  section: GOALS, headers: ['Goal', 'Target', 'Brief says', 'src'],
  rows: cells.map((c) => [c, 't', 'q', 'stated']),
});
const strategy = (...serves) => ({
  section: STRATEGY, headers: ['Decision', 'Serves', 'ADR', 'src'],
  rows: serves.map((s, i) => [`decision ${i}`, s, 'ADR-001', 'proposed']),
});
const THREE = goals('Uptime', 'Integration', 'Speed (gives way first)');
const run = (tables, archMd = '') => validateStrategy({ tables, archMd });
const fails = (fs) => fs.filter((f) => f.level !== 'warn');

test('passes three goals, one giving way, every goal served', () => {
  assert.deepEqual(run([THREE, strategy('Uptime, Integration', 'Speed')]), []);
});

test('fails when §13 does not have exactly three rows', () => {
  const out = run([goals('Uptime', 'Speed (gives way first)'), strategy('Uptime, Speed')]);
  assert.match(out[0].message, /2 goal rows, expected 3/);
});

test('fails when no goal or two goals give way first', () => {
  assert.equal(run([goals('A', 'B', 'C'), strategy('A, B, C')]).length, 1);
  const two = goals('A (gives way first)', 'B (gives way first)', 'C');
  assert.match(run([two, strategy('A, B, C')])[0].message, /marks 2 goals/);
});

test('Not provided rows count as rows but not as goals', () => {
  const t = goals('Reliability', 'Simplicity (gives way first)', 'Not provided — user declined');
  assert.deepEqual(run([t, strategy('Reliability', 'Simplicity')]), []);
  const one = goals('Reliability', 'Not provided — a', 'Not provided — b');
  assert.deepEqual(run([one, strategy('Reliability')]), []);
});

test('fails a decision serving a non-goal, and one serving nothing', () => {
  const out = run([THREE, strategy('Uptime, Integration, Speed', 'Growth', '')]);
  assert.equal(out.length, 2);
  assert.match(out[0].message, /"growth", not a §13 goal/);
  assert.match(out[1].message, /serves no goal/);
});

test('fails a goal no decision serves', () => {
  const out = run([THREE, strategy('Uptime, Integration')]);
  assert.match(out[0].message, /goal "speed" is served by no §4 decision/);
});

test('matches serves names case-insensitively and with the gives-way label', () => {
  assert.deepEqual(run([THREE, strategy('uptime, INTEGRATION', 'Speed (gives way first)')]), []);
});

test('fails a §4 table with no Serves column', () => {
  const t = { section: STRATEGY, headers: ['Decision', 'ADR', 'src'], rows: [['d', 'a', 'proposed']] };
  assert.match(run([THREE, t])[0].message, /no Serves column/);
});

test('legacy §13 (no Goal column) warns once and skips serves checks', () => {
  const legacy = { section: GOALS, headers: ['Requirement', 'Target', 'src'], rows: [['r', 't', 'stated']] };
  const out = run([legacy, strategy('anything')]);
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'warn');
  assert.match(out[0].message, /predates top-3 goals/);
});

test('§4 written as bullets warns, even under a ### subheading', () => {
  const md = '## 4 Solution Strategy\n\n### Notes\n\n- Single app → ADR-001\n\n## 5 Architecture Model\n';
  const out = run([THREE], md);
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'warn');
  assert.match(out[0].message, /§4 is a list/);
});

test('no findings when §4 and §13 are absent or Not applicable', () => {
  assert.deepEqual(run([], '## Core Components\n'), []);
  const md = '## 4 Solution Strategy\n\nNot applicable — single script\n\n## 13 Quality Requirements\n\nNot applicable — x\n';
  assert.deepEqual(run([], md), []);
});

test('fails never carry the warn level', () => {
  assert.equal(fails(run([THREE, strategy('Uptime')])).length, 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy.test.mjs`
Expected: FAIL — `Cannot find module '../lib/validate-strategy.mjs'`.

- [ ] **Step 3: Write the implementation**

```js
// Ties §4 Solution Strategy to §13's top-3 quality goals: every decision names
// a goal it serves, every goal is served by some decision. A set written before
// top-3 goals existed (§13 with no Goal column, §4 as bullets) warns instead of
// failing, so a rewrite the user declined never blocks the viewer.
const GIVES_WAY = /\(gives way first\)/i;
const NOT_PROVIDED = /^Not provided/i;

const fail = (message) => ({ check: 'strategy', message });
const nameOf = (cell) => cell.replace(GIVES_WAY, '').trim().toLowerCase();

export function validateStrategy({ tables, archMd }) {
  const goals = tables.find((t) => /Quality Requirements/i.test(t.section));
  const strategy = tables.find((t) => /Solution Strategy/i.test(t.section));
  const cells = goalCells(goals);
  return [
    ...checkGoals(goals, cells),
    ...checkStrategyShape(strategy, sectionBody(archMd, /Solution Strategy/i)),
    ...(cells && strategy ? checkServes(cells, strategy) : []),
  ];
}

// `^## ` never matches `### `, so a subheading stays inside its section.
function sectionBody(md, title) {
  const chunk = md.split(/^## /m).find((c) => title.test(c.split('\n')[0]));
  return chunk ? chunk.slice(chunk.indexOf('\n') + 1) : '';
}

function goalCells(t) {
  const col = (t?.headers ?? []).findIndex((h) => /^goal$/i.test(h));
  return col === -1 ? null : t.rows.map((r) => r[col] ?? '');
}

function checkGoals(t, cells) {
  if (!t) return [];
  if (!cells) return [{ ...fail('§13 predates top-3 goals (no Goal column); rewrite as Goal · Target · Brief says · src'), level: 'warn' }];
  const out = cells.length === 3 ? [] : [fail(`§13 has ${cells.length} goal rows, expected 3`)];
  const marked = cells.filter((c) => GIVES_WAY.test(c)).length;
  const needOne = cells.filter((c) => !NOT_PROVIDED.test(c)).length >= 2;
  if (needOne ? marked !== 1 : marked > 1) {
    out.push(fail(`§13 marks ${marked} goals "(gives way first)", expected ${needOne ? 'exactly 1' : 'at most 1'}`));
  }
  return out;
}

function checkStrategyShape(strategy, body) {
  if (strategy || !/^\s*[-*] /m.test(body)) return [];
  return [{ ...fail('§4 is a list; rewrite as a Decision · Serves · ADR · src table'), level: 'warn' }];
}

function checkServes(cells, strategy) {
  const col = strategy.headers.findIndex((h) => /^serves$/i.test(h));
  if (col === -1) return [fail('§4 table has no Serves column')];
  const goals = cells.filter((c) => !NOT_PROVIDED.test(c)).map(nameOf);
  const rows = strategy.rows.map((r) => ({
    decision: r[0],
    serves: (r[col] ?? '').split(',').map(nameOf).filter(Boolean),
  }));
  return [...rowFindings(rows, goals), ...unservedFindings(rows, goals)];
}

function rowFindings(rows, goals) {
  return rows.flatMap(({ decision, serves }) => {
    if (!serves.length) return [fail(`§4 "${decision}" serves no goal`)];
    return serves.filter((s) => !goals.includes(s))
      .map((s) => fail(`§4 "${decision}" serves "${s}", not a §13 goal`));
  });
}

function unservedFindings(rows, goals) {
  const served = new Set(rows.flatMap((r) => r.serves));
  return goals.filter((g) => !served.has(g))
    .map((g) => fail(`§13 goal "${g}" is served by no §4 decision`));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy.test.mjs`
Expected: all 12 tests PASS. The file holds 10 functions (8 declared + `fail`, `nameOf`) — the cap.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/validate-strategy.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy.test.mjs
git commit -m "feat(analyze-requirements): validate strategy serves goals"
```

---

### Task 2: Wire into `validate.mjs` with a `WARN` level

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/inputs.mjs` (return object in `buildInputs`)
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs` (imports; the `findings` block and the print/exit lines at the end)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy-cli.test.mjs`

**Interfaces:**
- Consumes: `validateStrategy({ tables, archMd })` from Task 1.
- Produces: `buildInputs(...)` now also returns `archMd: string` (raw ARCHITECTURE.md). CLI prints `WARN [check] message` for `level: 'warn'` findings, `FAIL [check] message` for the rest, `ok all checks passed` when there are no failures; exit code 1 only on failures.

- [ ] **Step 1: Write the failing CLI tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs';
const FRONT = '---\nelectedDocs: [{"name":"threat-model","elected":false,"reason":"r"},{"name":"interface-contract","elected":false,"reason":"r"},{"name":"estimation","elected":false,"reason":"r"},{"name":"domain-overview","elected":false,"reason":"r"}]\n---\n\n';
const GOALS = '## 13 Quality Requirements and SLOs\n\n| Goal | Target | Brief says | src |\n| --- | --- | --- | --- |\n| Uptime | 99.9% | "q" | stated |\n| Integration | 5 min | "q" | stated |\n| Speed (gives way first) | 2s | "q" | stated |\n';

function validate(body) {
  const dir = mkdtempSync(join(tmpdir(), 'strategy-cli-'));
  writeFileSync(join(dir, 'ARCHITECTURE.md'), FRONT + body);
  writeFileSync(join(dir, 'model.json'), JSON.stringify({ elements: {} }));
  return spawnSync('node', [CLI, '--root', dir,
    '--arch', join(dir, 'ARCHITECTURE.md'), '--model', join(dir, 'model.json')], { encoding: 'utf8' });
}

test('§4 bullets: WARN printed, exit 0', () => {
  const r = validate('## 4 Solution Strategy\n\n- Single app → ADR-001\n\n' + GOALS);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^WARN \[strategy\] §4 is a list/m);
  assert.match(r.stdout, /all checks passed/);
});

test('unserved goal: FAIL printed, exit 1', () => {
  const strategy = '## 4 Solution Strategy\n\n| Decision | Serves | ADR | src |\n| --- | --- | --- | --- |\n| Single app | Uptime, Integration | ADR-001 | proposed |\n\n';
  const r = validate(strategy + GOALS);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL \[strategy\] §13 goal "speed"/m);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy-cli.test.mjs`
Expected: both FAIL — no `WARN`/`strategy` output yet.

- [ ] **Step 3: Implement**

In `scripts/lib/inputs.mjs`, add `archMd: arch,` as the first property of the object `buildInputs` returns.

In `scripts/validate.mjs`, add the import beside the other validators:

```js
import { validateStrategy } from './lib/validate-strategy.mjs';
```

add to the `findings` array, after `validateProvenance(...)`:

```js
  ...validateStrategy({ tables: inputs.tables, archMd: inputs.archMd }),
```

and replace the last three lines (the print loop, the `ok` line, `process.exit`) with:

```js
// A warn finding marks a set written before a rule existed: printed so the
// next rewrite fixes it, never blocking — rule 4 makes validation gate rendering.
const fails = findings.filter((f) => f.level !== 'warn');
for (const f of findings.filter((x) => x.level === 'warn')) console.log(`WARN [${f.check}] ${f.message}`);
for (const f of fails) console.log(`FAIL [${f.check}] ${f.message}`);
if (!fails.length) console.log('ok all checks passed');
process.exit(fails.length ? 1 : 0);
```

- [ ] **Step 4: Run the new tests and the full suite**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy-cli.test.mjs && npm test`
Expected: both new tests PASS; full suite PASS (the `docs-pass` fixture has no §4/§13, so its CLI test is unaffected).

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/inputs.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/validate-strategy-cli.test.mjs
git commit -m "feat(analyze-requirements): strategy check, warn level"
```

---

### Task 3: Quality-goal catalogue and the interview

**Files:**
- Create: `plugins/solution-architect/skills/analyze-requirements/references/quality-goals.md`
- Modify: `plugins/solution-architect/skills/analyze-requirements/references/interview.md:24-26` (the three §13 rows) and its "Card batching" section
- Modify: `plugins/solution-architect/skills/analyze-requirements/SKILL.md` (Flow step 3)

No code, so no test cycle; Task 5's eval assertions are the check on this wording.

- [ ] **Step 1: Create `references/quality-goals.md`**

```markdown
# Quality goals — catalogue, filter, top 3

Read during the interview (SKILL.md step 3), before any §13 card. Defines
which quality goals may be proposed, how a candidate earns a place, and how
the top 3 are confirmed. Method from *Fundamentals of Software Architecture*
(Richards & Ford, ch. 4–5), in our own words.

## 1. Catalogue

Propose only these names, spelled exactly as here — §4 `Serves` and the
validator match on them.

| Goal | Book term | Changes the design when… |
| --- | --- | --- |
| Speed | performance | a user waits on a step with a number attached |
| Spike handling | elasticity | load jumps by a stated multiple in a short window |
| Growth | scalability | users or data grow steadily past one machine |
| Uptime | availability | an outage window costs money or trust |
| Data recovery | recoverability (RPO/RTO) | lost or late data has a stated cost |
| Reliability | reliability | a failure must never leave wrong or half-written state |
| Security | security | data or actions need protection beyond standard login |
| Integration | interoperability | a named external system is the source of record |
| Low cost | cost | a budget or running-cost ceiling is stated |
| Ease of change | evolvability | rules, partners or products change often |
| Simplicity | simplicity | a small team or short timeline must maintain it |

## 2. Filter — what makes a candidate

A goal is a candidate only when both hold:

1. **The input shows it** — an exact quote from the user's message, a
   document they supplied, or the code scan. No quote, no candidate.
2. **It changes the design** — something must be built differently for it.
   A goal every system has but that needs nothing special (card payments
   handled by the payment provider → Security) is not a candidate; it goes
   to "Also considered" with that reason.

Show 4–6 candidates, never the whole catalogue. Recommend 3, unranked.

## 3. Cards

Round 1 — one `AskUserQuestion` call, two cards:

- **Quality goals.** Question text lists each candidate with its quote, ★ on
  the recommended 3. Options: `Confirm top 3 (Recommended)` · `Swap in
  <strongest runner-up>` · `Swap in <second runner-up>`. Further runners-up
  stay in the question text; the user reaches them through Other.
- **Trade-off.** "If budget forces it, which gives way first?" Options: the
  three picks, the one with the weakest quote first and `(Recommended)`.

Round 2 — one call, one card per pick (≤ 3): "<Goal> target?" Options: two
measurable targets drawn from the input (recommended first), then `No
target yet`.

## 4. Thin input and pre-answered goals

- Fewer than 3 candidates: fill each empty slot with the open question
  "Which quality matters most for this system, and what is its measurable
  target?" (one card).
- A goal the user already named in their message is answered — no card for
  it (interview.md hard rule 3); its row is `stated`.
- A slot still empty (declined, or the user said not to ask) renders its
  Goal cell as `Not provided — <who declined/why>`. Never invent a goal to
  fill a row.
- `No target yet` renders the Target cell `Not provided — no target set`.

## 5. Provenance

A goal confirmed by a card is `stated`; a goal the agent picked that the
user never confirmed (they said not to ask) is `proposed`; the trade-off
follows the same rule.
```

- [ ] **Step 2: Replace the three §13 rows in `references/interview.md`**

Replace lines 24–26 (the rows starting `| §13 Quality Requirements & SLOs |`) with:

```markdown
| §13 Quality Requirements & SLOs | Quality goals: confirm the proposed top 3 (candidates with quotes, per `quality-goals.md`) | both | never — proposed from evidence, confirmed by the user; skip only goals the user already named |
| §13 Quality Requirements & SLOs | Trade-off: which of the three gives way first? | both | fewer than 2 goals |
| §13 Quality Requirements & SLOs | Target for each picked goal (one card per goal, ≤ 3) | both | the user already gave a measurable target for that goal |
```

Then append to the "Card batching" section:

```markdown
- §13 is two calls (`quality-goals.md` §3): round 1 = goals + trade-off
  cards, round 2 = one target card per pick. Together ≤ 5 cards of the
  12-question cap.
```

- [ ] **Step 3: Point SKILL.md at the catalogue**

In `SKILL.md`, Flow step 3, replace:

```
3. **Interview**: follow `references/interview.md`. Detect project type per `references/project-types.md`.
```

with:

```
3. **Interview**: follow `references/interview.md`; §13 quality goals per `references/quality-goals.md` (propose top 3 from evidence, never ask cold). Detect project type per `references/project-types.md`.
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS (no test reads these files' wording; `rewriting.test.mjs` and `section-help.test.mjs` check other files).

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/references/quality-goals.md \
        plugins/solution-architect/skills/analyze-requirements/references/interview.md \
        plugins/solution-architect/skills/analyze-requirements/SKILL.md
git commit -m "feat(analyze-requirements): propose top-3 quality goals"
```

---

### Task 4: Writing contract and section explainers

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/references/writing.md` (spine lines for §4 and §13; new subsection after "## 3. Table format rules")
- Modify: `plugins/solution-architect/skills/analyze-requirements/assets/section-help.json` (`Solution Strategy`, `Quality Requirements & SLOs`)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/section-help.test.mjs` (add one test)

**Interfaces:**
- Consumes: catalogue names from Task 3; validator rules from Task 1 (the contract below must match them exactly).

- [ ] **Step 1: Write the failing test** (append to `section-help.test.mjs`; `help` is the file's existing top-level `const help = sectionHelp();`)

```js
test('§4 and §13 explainers describe the top-3 tie', () => {
  assert.match(help.spine['Solution Strategy'].good, /goal it serves/);
  assert.match(help.spine['Quality Requirements & SLOs'].what, /top three quality goals/);
  assert.match(help.spine['Quality Requirements & SLOs'].good, /gives way first/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/section-help.test.mjs`
Expected: FAIL on the new test only.

- [ ] **Step 3: Update `assets/section-help.json`**

```json
    "Solution Strategy": {
      "what": "The handful of decisions that shaped everything else, each naming the quality goal it serves and pointing at the decision record that argued it.",
      "why": "This is what a reader consults to learn why the system is like this at all, before spending an hour in the detail.",
      "good": "Five rows or fewer, each naming the top-3 goal it serves and linking a decision record, none restating the rationale."
    },
```

```json
    "Quality Requirements & SLOs": {
      "what": "The top three quality goals for this system, each with a measurable target and the evidence it was picked from.",
      "why": "Fast, reliable and scalable are unfalsifiable, and wanting all of them sinks the design. Three goals with numbers say what to build for and what to trade.",
      "good": "Exactly three goals, no adjectives, each with a value; one marked as the one that gives way first."
    },
```

- [ ] **Step 4: Update `references/writing.md`**

Spine block — replace the §4 and §13 lines:

```
 4  Solution Strategy            table, ≤5 rows: Decision · Serves · ADR · src; never restates rationale
...
13  Quality Requirements & SLOs  table, 3 rows: Goal · Target · Brief says · src; + "Also considered" list
```

Add after "## 3. Table format rules":

```markdown
## 3a. §4 and §13 — the top-3 tie

- **§13** has exactly 3 rows, columns `Goal · Target · Brief says · src`.
  Goal names come from `quality-goals.md` §1, spelled exactly. One Goal cell
  ends ` (gives way first)` when there are 2+ goals. An empty slot is a row
  whose Goal is `Not provided — <reason>`. `Brief says` is the quote the goal
  was picked from; `src` is the source of the Target.
- Under the table, `Also considered:` — one bullet per runner-up or rejected
  candidate, with the reason, ending in its backticked provenance word.
- **§4** is a table, ≤ 5 rows, `Decision · Serves · ADR · src`. `Serves`
  lists one or more §13 goals, comma-separated, spelled as in §13. Every
  §13 goal appears in at least one `Serves`. The reasoning lives in the ADR;
  `Serves` is a pointer, not a rationale.
- `validate.mjs` enforces all of this (`validate-strategy.mjs`); a set
  written before it (bullets in §4, no Goal column in §13) only warns.

    | Decision | Serves | ADR | src |
    | --- | --- | --- | --- |
    | Single web app + one database | Uptime, Low cost | [ADR-001](docs/adr/0001-single-app.md) | proposed |
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, including the new section-help test.

- [ ] **Step 6: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/references/writing.md \
        plugins/solution-architect/skills/analyze-requirements/assets/section-help.json \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/section-help.test.mjs
git commit -m "docs(analyze-requirements): §4 and §13 top-3 contract"
```

---

### Task 5: Eval assertions

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/evals/evals.json` (evals 0, 1, 2)

- [ ] **Step 1: Eval 0** — replace the assertion starting `asks-the-never-skippable-questions:` with:

```
"asks-quality-goals-from-evidence: the questions include the target deployment environment AND a §13 quality-goals card; with this thin prompt the card either proposes candidates each backed by a quote from the prompt (e.g. \"compliance audit\") or, lacking 3 quoted candidates, asks the open 'which quality matters most, with a measurable target' question - it never asks a fixed availability or RPO/RTO question for a goal nobody raised"
```

and in `expected_output` replace `the quality attribute + measurable target, and the availability/RPO-RTO questions the interview bank marks as never-skippable` with `the top-3 quality goals card (or its open-question fallback on thin input)`.

- [ ] **Step 2: Eval 1** — add an assertion:

```
"top3-from-preanswered-prompt: §13 has columns Goal · Target · Brief says · src and exactly 3 rows; 'Reliability' (zero partial installs across 100 interrupted runs) is a stated goal with that target; no availability or RPO/RTO row is presented as a goal (the user said n/a); any slot the prompt does not support is either a 'proposed' goal with a quote from the prompt or 'Not provided - <reason>'; no AskUserQuestion card is shown"
```

- [ ] **Step 3: Eval 2** — add two assertions:

```
"top3-from-spec: §13 has exactly 3 goal rows from the quality-goals catalogue, each with a 'Brief says' quote found in triage-service-spec.md, exactly one marked '(gives way first)', and an 'Also considered' list naming at least one rejected candidate with its reason"
```

```
"strategy-serves-goals: §4 is a Decision · Serves · ADR · src table; every Serves name is one of the §13 goals; every §13 goal is served by at least one row; node scripts/validate.mjs prints no 'FAIL [strategy]' line"
```

- [ ] **Step 4: Check the JSON parses and the suite passes**

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/solution-architect/skills/analyze-requirements/evals/evals.json','utf8'))" && npm test`
Expected: no output from the parse, suite PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/evals/evals.json
git commit -m "test(analyze-requirements): evals for top-3 goals"
```

---

### Task 6: Version bump and hand-off for human test

**Files:**
- Modify: `plugins/solution-architect/.claude-plugin/plugin.json` (`"version": "3.0.1"` → `"3.1.0"`)
- Modify: `.claude-plugin/marketplace.json` (the `solution-architect` entry's `"version": "3.0.1"` → `"3.1.0"`)

- [ ] **Step 1: Bump both versions** to `3.1.0`.

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add plugins/solution-architect/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore(solution-architect): release 3.1.0"
```

- [ ] **Step 4: Stop.** Do not merge. Report the branch and the commits to the human, with this manual check for them to run: run `/analyze-requirements` on a short greenfield brief (e.g. the Trellis lead), confirm the round-1 card shows candidates with quotes and ★ top 3, the trade-off card appears, §4 renders as a table with `Serves`, §13 as a 3-row table, and the viewer opens with no `FAIL` lines.
