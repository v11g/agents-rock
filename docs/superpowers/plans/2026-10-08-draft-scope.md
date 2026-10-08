# draft-scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone `draft-scope` skill in the `business-analyst` plugin that turns raw client emails, call transcripts and notes into an editable `draft-scope.docx` in the SinKowaWorkflows shape.

**Architecture:** The model does Discover → Define → Draft by following step files, and writes `draft.json`. `check.py` checks the draft and loops with the model until clean; `build_docx.py` turns the clean draft into a DOCX with Python's standard library. Node tests run the Python scripts so `npm test` covers them; two plugin evals judge the drafting on a fictional client.

**Tech Stack:** Python 3 standard library (json, re, difflib, zipfile, os, sys); Node 22 `node:test` for tests; Claude plugin evals (`claude plugin eval`).

**Spec:** `docs/superpowers/specs/2026-10-08-draft-scope-design.md`

## Global Constraints

- Skill folder: `plugins/business-analyst/skills/draft-scope/`. Standalone: reads no file of the `business-analyst` skill, and no test imports from it.
- Scripts: Python 3 standard library only; no third-party package, no Node at runtime.
- Workflows in the docx are text lines; no images.
- The skill never asks the user a question; gaps become "Questions for the client".
- Every quote in the draft is the source's exact words.
- At most 6 problems, at most 8 assumptions.
- Size gates per Python file: ≤ 200 lines, ≤ 10 functions, ≤ 20 lines per function, ≤ 3 parameters.
- Conventional Commits, no AI attribution lines. `/usr/bin/git`, one command per call, never `git stash`.
- Fictional eval/test client only ("Riverside Bakery", "Bloom & Co"). No Sin Kowa data in fixtures.
- `business-analyst` plugin version 0.4.0 → 0.5.0 (Task 6 only).

## Deviations from the spec, recorded during planning

- **Word limits.** The spec says 2–5 words for steps and feature names. The PO's real document has one-word steps ("Pack", "Shipped") and six-word feature names ("Ad hoc / local purchase logging"). Plan: steps 1–5 words, feature names 2–6 words.
- **Problem count.** The spec says 3–6 problems. A thin input (the `draft-scope-thin` eval) may honestly hold one. A minimum of 3 would push the model to invent. Plan: 1–6.
- **Manual claude.ai check.** The spec makes it task 1, but there is nothing to upload yet. Plan: Task 1 builds the skill's text files, then asks the user to run the upload check while Tasks 2–6 continue; Task 7 records the result.
- **Triggering.** The `business-analyst` description also claims raw emails and transcripts. The spec forbids changing the BA, so draft-scope's description says "draft … for the PO to edit, before the business-analyst skill", and the evals name the skill. Listed in Review Focus.

## Review Focus

1. A request that does not name the skill ("draft the scope from these emails") may load `business-analyst` instead. Expected: draft-scope loads. No automated test can pin this; check it in the manual claude.ai run (Task 1, Step 6).
2. A quote copied with a line break or doubled spaces where the source has one space, or only part of a sentence. Expected: it still counts as exact. Curly quote marks are normalised in code too but not pinned by a test. Pinned in Task 3 (`normalised quotes match`).
3. A client question that quotes a vague word ("You wrote 'fast'…"). Expected: not flagged. Pinned in Task 3 (`vague word inside quotes is allowed`).
4. A draft with no exclusions, no assumptions or no features in a system. Expected: the docx says "None." instead of an empty table. Pinned in Task 4 (`empty sections say None`).
5. A source text with `&`, `<` or control characters. Expected: a valid docx. Pinned in Task 4 (`special characters are escaped`).

---

## File Structure

```
plugins/business-analyst/skills/draft-scope/
├── SKILL.md                          the flow, which file to read when, how to run the scripts
├── steps/discover.md                 step 1: one note per source
├── steps/draft.md                    steps 2–3: problems, systems, step lines, features, scope, questions
├── steps/assumptions.md              step 3d: per-feature sweep + 2×2 grid
├── steps/check.md                    steps 4–5: check.py loop, model checks, build
├── references/rules.md               writing rules + banned words (mirrored in draft_rules.py)
├── references/draft-schema.md        draft.json fields (mirrored in draft_schema.py)
├── references/credits.md             phuryn/pm-skills (MIT)
├── scripts/check.py                  CLI: --draft draft.json → "draft clean" or findings
├── scripts/draft_schema.py           shape_findings(draft)
├── scripts/draft_rules.py            ref/coverage/limit/word findings
├── scripts/draft_quotes.py           quote_findings(draft, base)
├── scripts/build_docx.py             CLI: --draft draft.json --out draft-scope.docx
├── scripts/docx_xml.py               para, bullets, table
├── scripts/docx_body.py              document_xml(draft)
├── scripts/docx_package.py           package parts + write_docx(path, document)
└── scripts/test/
    ├── helpers.mjs                   py(), stage()
    ├── skill-files.test.mjs
    ├── check-shape.test.mjs
    ├── check-rules.test.mjs
    ├── build-docx.test.mjs
    ├── gates.test.mjs
    └── fixtures/draft-pass.json, fixtures/sources/E1.txt, fixtures/sources/C1.txt
plugins/business-analyst/evals/draft-scope-rich/   case.yaml, fixture.sh, prompt.md, inputs/, graders/
plugins/business-analyst/evals/draft-scope-thin/   case.yaml, fixture.sh, prompt.md, inputs/, graders/
```

`npm test` already globs `plugins/*/skills/*/scripts/test/*.test.mjs`, so the new tests run without config changes.

Set `S=plugins/business-analyst/skills/draft-scope` in every shell step below.

---

### Task 1: Skill text files

**Files:**
- Create: `$S/SKILL.md`, `$S/steps/discover.md`, `$S/steps/draft.md`, `$S/steps/assumptions.md`, `$S/steps/check.md`, `$S/references/rules.md`, `$S/references/draft-schema.md`, `$S/references/credits.md`
- Test: `$S/scripts/test/skill-files.test.mjs`

**Interfaces:**
- Produces: the draft.json field names every later task uses (from `references/draft-schema.md`), and the CLI commands `python3 scripts/check.py --draft <dir>/draft.json` and `python3 scripts/build_docx.py --draft <dir>/draft.json --out <dir>/draft-scope.docx`.

- [ ] **Step 1: Write the failing test**

`$S/scripts/test/skill-files.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const skill = () => readFileSync(at('SKILL.md'), 'utf8');
const FILES = ['steps/discover.md', 'steps/draft.md', 'steps/assumptions.md', 'steps/check.md',
  'references/rules.md', 'references/draft-schema.md', 'references/credits.md'];

test('SKILL.md front matter names the skill and its trigger', () => {
  const head = skill().split('---')[1];
  assert.match(head, /^name: draft-scope$/m);
  assert.match(head, /^description: .*emails.*call transcripts.*DOCX.*business-analyst/m);
});

test('SKILL.md points at every step and reference file, and each exists', () => {
  for (const f of FILES) {
    assert.ok(skill().includes(f), `SKILL.md does not mention ${f}`);
    assert.ok(existsSync(at(f)), `${f} missing`);
  }
});

test('SKILL.md names both script commands', () => {
  assert.match(skill(), /python3 scripts\/check\.py --draft /);
  assert.match(skill(), /python3 scripts\/build_docx\.py --draft .* --out /);
});

test('credits name the borrowed repo and its licence', () => {
  const credits = readFileSync(at('references/credits.md'), 'utf8');
  assert.match(credits, /phuryn\/pm-skills/);
  assert.match(credits, /MIT/);
});

test('the skill reads nothing from the business-analyst skill', () => {
  for (const f of ['SKILL.md', ...FILES]) {
    assert.doesNotMatch(readFileSync(at(f), 'utf8'), /skills\/business-analyst\//, f);
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test $S/scripts/test/skill-files.test.mjs`
Expected: FAIL, `ENOENT … SKILL.md`.

- [ ] **Step 3: Write the files**

`$S/SKILL.md`:

~~~~markdown
---
name: draft-scope
description: Draft a workflow-based scope document (problems, systems, workflow steps, features, assumptions, client questions) from raw client emails, call transcripts or notes, as an editable DOCX the PO corrects before using the business-analyst skill. Use when the user has only raw client material, no scope document yet, and asks to draft the scope, systems, workflows or features from it.
---

# draft-scope

Turns raw client material into a first draft of the scope document a PO
would otherwise write by hand: systems, their workflow steps, features,
assumptions and exclusions, plus the problems heard and the questions to
ask the client. The PO edits the DOCX in Word or Google Docs, then uses it
with the business-analyst skill.

## Rules that hold in every step

1. Ask the user nothing. Every gap becomes a client question (step 3f).
2. Every line cites a source id (E1, C1, N1). Quotes are the source's exact
   words. Anything you cannot source, cut.
3. One draft only. No alternative drafts, no ranking of features.
4. Follow `references/rules.md` for every text you write.

## Flow

0. **Intake.** Number every source: emails E1, E2…, calls C1…, other notes
   N1…, in date order. Save each source's text as `sources/<id>.txt` in the
   working folder (pasted text included), so quotes can be checked.
1. **Discover.** Read `steps/discover.md`. One note per source.
2. **Define** and 3. **Draft.** Read `steps/draft.md`, and
   `steps/assumptions.md` for the assumptions. Write `draft.json` in the
   shape of `references/draft-schema.md`.
4. **Check** and 5. **Build.** Read `steps/check.md`:
   `python3 scripts/check.py --draft <dir>/draft.json` until it prints
   `draft clean`, then
   `python3 scripts/build_docx.py --draft <dir>/draft.json --out <dir>/draft-scope.docx`.

No shell or no Python (some sandboxes): skip the scripts, run the checks in
`steps/check.md` yourself, and show the draft in your reply in the same
section order as the docx.

## Finish

claude.ai: present `draft-scope.docx` and `discover-notes.md`. Claude Code:
give their paths. Then one line: "Edit it in Word or Google Docs, then use
it with the business-analyst skill."

Credits: `references/credits.md`.
~~~~

`$S/steps/discover.md`:

~~~~markdown
# Step 1 — Discover

One note per source, in source order. Fill every field; write `–` when the
source says nothing. Copy quotes exactly, word for word.

```
Source: C1 · call · 2026-09-10 · Dana Lee (owner), Sam (our PO)
Background:              who the client is, in the source's terms
Current way of working:  the steps they follow today, in order
What stays as-is:        what they want to keep ("orders come by WhatsApp, that stays")
Who else owns what:      parties that own part of the work ("the courier handles routes")
Problems:                each pain; importance / satisfaction only if they said it, else –
Steps & rules mentioned: stages, hand-offs, rules, numbers ("about 30% of orders")
Quotes:                  "…" exact words, one per line
Open points:             what is unclear or contradicts another source
```

Skip what is not about the work (small talk, music, weather). An email
that only says "can we talk" still gets a note; most fields are `–`.

Save all notes, in order, as `discover-notes.md` next to `draft.json`.
~~~~

`$S/steps/draft.md`:

~~~~markdown
# Steps 2–3 — Define and Draft

Work from the notes in `discover-notes.md`. Write `draft.json`
(`references/draft-schema.md`). Rules for every text: `references/rules.md`.

## 2 Define — problems

Merge the notes' problems into 1–6 problems. One sentence each, in the
client's terms ("We run out of flour before we notice"), never a solution
("build an app"). Each carries the exact quotes behind it. A goal line goes
into `scope.covered` only if someone stated a goal.

## 3a Systems

1. List every request and problem from the notes.
2. Group related ones. Name each group as the business area the client
   would name ("Orders", "Stock"), never a technical part ("backend").
3. Check: every request sits in exactly one group. One that fits none
   means regroup; do not force it in.
4. Purpose: one sentence, the area plus the problem it closes; `problem`
   holds that problem's id.

## 3b Step lines

Only steps a source gives, as `workflows` on the system:
- `main`: the to-be steps in order, 1–5 words each.
- `side`: a branch, with `returnsTo` when it goes back.
- `sub`: a sub-workflow with `name`, `startsAt`, `rejoinsAt`, and `share`
  when the client gave one ("~30% of orders").
A system no source gives steps for has `workflows: []`, and the missing
steps become a client question.

## 3c Features

Per system, what the client asked for or what closes a problem. Name: 2–6
words. `does`: one sentence starting with a verb: who it is for, the
client's number if any, what changes against today. `problem`: the problem
it closes.

## 3d Assumptions

Read `steps/assumptions.md`.

## 3e Scope

`covered`: one or two sentences on what the draft covers. `pillars` only
when a source lists the client's own programme pillars. `exclusions`: each
with `reason` `owned-elsewhere`, `later-phase` or `no-detail` and its source.

## 3f Client questions

From the notes' open points, gaps (a system with no steps), conflicts and
vague words:
- Ask about a real past case: "Last time … what happened?"
- A vague word is quoted and made measurable: "You wrote \"fast\": by
  what time of day?"
- Sources that disagree: one question quoting both.
- `why`: what changes in the scope with the answer. `assume`: what the draft
  assumes if there is no answer. `refs`: the problem and source ids.
~~~~

`$S/steps/assumptions.md`:

~~~~markdown
# Step 3d — Assumptions

For each feature, ask what must be true for it to work, under four checks:

- **Value** — does the client gain what the problem says?
- **Usability** — can the people named actually use it where they work?
- **Viability** — will the client's customers, partners or rules accept it?
- **Feasibility** — does what it needs exist (devices, data, connections)?

Sort each answer:

|  | a source supports it | no source says |
| --- | --- | --- |
| changes the price if wrong | assumption | assumption + client question |
| small | drop | client question only |

Keep at most 8 assumptions in the whole draft, the biggest price effect
first. Each names its `feature` and a `source`: the source that supports
it, or the feature's own source when none does.

Example: feature "Order board" (C1). Usability: staff copy WhatsApp orders
onto the board. A source supports it ("Orders come in by WhatsApp, that
stays") and it changes the price → assumption, source C1.
~~~~

`$S/steps/check.md`:

~~~~markdown
# Steps 4–5 — Check and Build

## 4 Check

Run `python3 scripts/check.py --draft <dir>/draft.json`.
- Prints `draft clean` → go on.
- Prints findings → fix each in `draft.json`, run again. A quote finding
  shows the closest sentence in the source; copy that sentence exactly or
  pick another quote.

Then check what the script cannot:
- Every number the client gave survives as written ("~30%", "twice").
- Every problem sits in some system's purpose or feature.
- The systems read as the client's business areas.
- Nothing in the draft comes from small talk.

## 5 Build

`python3 scripts/build_docx.py --draft <dir>/draft.json --out <dir>/draft-scope.docx`

The docx holds, in order: title and note, Sources, Problems we heard,
Scope (exclusions), one section per system (purpose, step lines, features),
Assumptions, Questions for the client.
~~~~

`$S/references/rules.md`:

~~~~markdown
# Writing rules

- **Problems**: 1–6, one sentence each, client's terms, never a solution.
  At least one exact quote each.
- **Systems**: business areas the client would name; purpose = area + the
  problem it closes.
- **Steps**: to-be only, 1–5 words each.
- **Features**: name 2–6 words; `does` = one verb-first sentence: who, the
  client's number, what changes against today.
- **Assumptions**: at most 8; each names its feature and a source.
- **Exclusions**: each has a reason (owned by someone else, later phase, no
  process detail yet) and a source.
- **Client questions**: about a real past case; say why it matters and what
  to assume without an answer; conflicting sources quoted together.
- **Quotes**: exact words. Never reword, never shorten inside the quote.
- **Numbers**: keep the client's numbers as written; never round them away.
- **Banned words** outside quotes (checked by `check.py`): fast, quick,
  easy, simple, user-friendly, intuitive, flexible, robust, seamless,
  efficient, optimal, appropriate, various, etc, some, many, several,
  as needed. Say the measurable thing instead.
- **Ids**: only source ids (E1, C1, N1) and problem ids (P1…) appear in the
  draft.
~~~~

`$S/references/draft-schema.md`:

~~~~markdown
# draft.json

All fields required unless marked optional. `check.py` enforces this file.

```json
{
  "client": "Riverside Bakery",
  "date": "2026-10-08",
  "sources": [
    { "id": "E1", "kind": "email", "date": "2026-09-02", "who": "Dana Lee — Running out of flour", "file": "sources/E1.txt" }
  ],
  "problems": [
    { "id": "P1", "text": "We run out of flour before we notice",
      "quotes": [{ "source": "E1", "text": "exact words from E1" }] }
  ],
  "scope": {
    "covered": "…",
    "pillars": [{ "system": "Stock", "pillar": "…" }],
    "exclusions": [{ "text": "Delivery routes", "reason": "owned-elsewhere", "source": "C1" }]
  },
  "systems": [
    { "name": "Stock", "purpose": "…; closes P1", "problem": "P1",
      "workflows": [
        { "kind": "main", "steps": ["Order In", "Bake"], "source": "C1" },
        { "kind": "side", "steps": ["Pack", "Short-pack alert"], "returnsTo": "Order In", "source": "C1" },
        { "kind": "sub", "name": "Custom cake", "steps": ["Quote", "Confirm Design"],
          "startsAt": "Order In", "rejoinsAt": "Bake", "share": "~30% of orders", "source": "C1" }
      ],
      "features": [{ "name": "Low-flour alert", "does": "Warns …", "problem": "P1", "source": "E1" }] }
  ],
  "assumptions": [{ "text": "…", "feature": "Low-flour alert", "source": "E1" }],
  "questions": [{ "text": "…", "why": "…", "assume": "…", "refs": ["P1", "E1"] }]
}
```

- `sources[].id`: `E`, `C` or `N` and a number. `kind`: `email`, `call`
  or `note`. `file`: path relative to `draft.json`.
- `problems[].id`: `P` and a number.
- `scope.pillars`: optional. `exclusions[].reason`: `owned-elsewhere`,
  `later-phase` or `no-detail`.
- `workflows[].kind`: `main`, `side` or `sub`. `returnsTo`, `name`,
  `startsAt`, `rejoinsAt`, `share`: optional.
- `assumptions[].feature`: a feature `name` in the draft.
- `questions[].refs`: problem and source ids.
~~~~

`$S/references/credits.md`:

~~~~markdown
# Credits

Ideas adapted, in our own words, from phuryn/pm-skills
(https://github.com/phuryn/pm-skills, MIT licence, Paweł Huryn):

- `summarize-interview` → the per-source note template (steps/discover.md).
- `analyze-feature-requests` → grouping requests into named themes (steps/draft.md 3a).
- `identify-assumptions-existing` → the four checks per feature (steps/assumptions.md).
- `prioritize-assumptions` → the impact × uncertainty grid (steps/assumptions.md).

No text was copied.
~~~~

- [ ] **Step 4: Run it to see it pass**

Run: `node --test $S/scripts/test/skill-files.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/draft-scope
/usr/bin/git commit -m "feat(business-analyst): draft-scope skill instructions"
```

- [ ] **Step 6: Ask the user for the claude.ai check (runs in parallel)**

Ask the user, then carry on with Task 2 without waiting:

> "Could you zip `plugins/business-analyst/skills/draft-scope/`, upload it on claude.ai (Settings → Capabilities → Skills), open a new chat and say: *I'm the PO for Riverside Bakery. All I have is this email — draft the scope from it.* and paste the text of `plugins/business-analyst/evals/draft-scope-thin/inputs/E1.txt` (created in Task 5; until then any short client email works). Tell me: (1) did draft-scope load, or business-analyst? (2) did it read the step files? (3) the scripts will be missing until Task 4 — did it fall back to showing the draft in the reply?"

A second run after Task 4 (same chat steps, re-upload) answers: do both scripts run, does the docx open in Google Docs? Record both answers in Task 7.

---

### Task 2: check.py — shape and references

**Files:**
- Create: `$S/scripts/check.py`, `$S/scripts/draft_schema.py`, `$S/scripts/draft_rules.py`
- Create: `$S/scripts/test/helpers.mjs`, `$S/scripts/test/check-shape.test.mjs`
- Create: `$S/scripts/test/fixtures/draft-pass.json`, `$S/scripts/test/fixtures/sources/E1.txt`, `$S/scripts/test/fixtures/sources/C1.txt`

**Interfaces:**
- Consumes: the draft.json shape from Task 1.
- Produces: `py(script, args) → { code, out, err }`, `stage(mutate) → dir` (helpers.mjs); `shape_findings(draft) → list[str]` (draft_schema.py); `ref_findings(draft) → list[str]` (draft_rules.py); `check.py` exit codes 0 clean / 1 findings / 2 usage, findings on stderr one per line, `draft clean` on stdout.

- [ ] **Step 1: Write the fixtures**

`$S/scripts/test/fixtures/sources/E1.txt`:

```
From: Dana Lee, owner, Riverside Bakery
Date: 2026-09-02
Subject: Running out of flour

Hi, can you build us an app so we stop running out of flour? Last month we ran out twice on a Saturday and had to close the cake counter by noon.
```

`$S/scripts/test/fixtures/sources/C1.txt`:

```
Call 2026-09-10 · Dana Lee (owner), Sam (our PO)

Dana: Orders come in by WhatsApp, that stays. About 30% of orders are custom cakes.
Dana: We write each order on a paper ticket, bake, pack and hand it to the courier.
Dana: When a ticket gets lost the customer calls us and we have no idea where the cake is.
Sam: Who plans the delivery routes?
Dana: The courier company handles routes, not us.
```

`$S/scripts/test/fixtures/draft-pass.json`:

```json
{
  "client": "Riverside Bakery",
  "date": "2026-10-08",
  "sources": [
    { "id": "E1", "kind": "email", "date": "2026-09-02", "who": "Dana Lee — Running out of flour", "file": "sources/E1.txt" },
    { "id": "C1", "kind": "call", "date": "2026-09-10", "who": "Dana Lee (owner)", "file": "sources/C1.txt" }
  ],
  "problems": [
    { "id": "P1", "text": "We run out of flour before we notice",
      "quotes": [{ "source": "E1", "text": "Last month we ran out twice on a Saturday and had to close the cake counter by noon." }] },
    { "id": "P2", "text": "We lose track of an order once its paper ticket is gone",
      "quotes": [{ "source": "C1", "text": "When a ticket gets lost the customer calls us and we have no idea where the cake is." }] }
  ],
  "scope": {
    "covered": "Order tracking from the WhatsApp order to the courier handoff, and flour stock.",
    "exclusions": [{ "text": "Delivery routes", "reason": "owned-elsewhere", "source": "C1" }]
  },
  "systems": [
    { "name": "Orders", "purpose": "Tracks each order from WhatsApp to the courier handoff; closes P2", "problem": "P2",
      "workflows": [
        { "kind": "main", "steps": ["Order In", "Bake", "Pack", "Courier Handoff"], "source": "C1" },
        { "kind": "sub", "name": "Custom cake", "steps": ["Quote", "Confirm Design"],
          "startsAt": "Order In", "rejoinsAt": "Bake", "share": "~30% of orders", "source": "C1" }
      ],
      "features": [
        { "name": "Order board", "does": "Shows every order and its stage, so staff answer a customer's call without searching paper tickets", "problem": "P2", "source": "C1" }
      ] },
    { "name": "Stock", "purpose": "Keeps flour on hand for weekend baking; closes P1", "problem": "P1",
      "workflows": [],
      "features": [
        { "name": "Low-flour alert", "does": "Warns the owner when flour drops below a set level, before a Saturday runs out", "problem": "P1", "source": "E1" }
      ] }
  ],
  "assumptions": [
    { "text": "Orders keep arriving by WhatsApp; staff copy each one onto the board", "feature": "Order board", "source": "C1" }
  ],
  "questions": [
    { "text": "Last time you ran out of flour, how much was left the day before?", "why": "Sets the alert level", "assume": "Alert at 2 bags", "refs": ["P1", "E1"] }
  ]
}
```

- [ ] **Step 2: Write the helpers and the failing test**

`$S/scripts/test/helpers.mjs`:

```js
// Runs the draft-scope Python scripts and stages a draft with its sources.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = fileURLToPath(new URL('..', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));

export function py(script, args) {
  try {
    const out = execFileSync('python3', [join(scripts, script), ...args], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? '', err: e.stderr ?? '' };
  }
}

// A temp folder holding draft.json (the pass fixture, changed by mutate) and sources/.
export function stage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'draft-scope-'));
  cpSync(join(fixtures, 'sources'), join(dir, 'sources'), { recursive: true });
  const draft = JSON.parse(readFileSync(join(fixtures, 'draft-pass.json'), 'utf8'));
  if (mutate) mutate(draft);
  writeFileSync(join(dir, 'draft.json'), JSON.stringify(draft, null, 2));
  return dir;
}

export const check = (dir) => py('check.py', ['--draft', join(dir, 'draft.json')]);
```

`$S/scripts/test/check-shape.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, py, stage } from './helpers.mjs';

test('the pass fixture is clean', () => {
  const r = check(stage());
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^draft clean$/m);
});

test('wrong arguments print usage and exit 2', () => {
  const r = py('check.py', ['--nope']);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage: check\.py --draft <draft\.json>/);
});

test('a file that is not JSON exits 1', () => {
  const dir = stage();
  writeFileSync(join(dir, 'draft.json'), '{ nope');
  const r = check(dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /draft\.json: /);
});

test('missing or mistyped fields are named with their place', () => {
  const r = check(stage((d) => { delete d.client; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^draft: client missing or not str$/m);
  const f = check(stage((d) => { delete d.systems[0].features[0].does; }));
  assert.match(f.err, /^systems\[0\]\.features\[0\]: does missing or not str$/m);
  const q = check(stage((d) => { d.questions[0].refs = 'P1'; }));
  assert.match(q.err, /^questions\[0\]: refs missing or not list$/m);
});

test('ids and kinds outside their lists are reported', () => {
  const r = check(stage((d) => {
    d.sources[0].kind = 'fax';
    d.problems[0].id = 'Problem1';
    d.systems[0].workflows[0].kind = 'loop';
    d.scope.exclusions[0].reason = 'nope';
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^sources: E1 kind fax is not email, call or note$/m);
  assert.match(r.err, /^problems: bad id Problem1$/m);
  assert.match(r.err, /^systems\[0\]\.workflows\[0\]: kind loop is not main, side or sub$/m);
  assert.match(r.err, /^scope\.exclusions\[0\]: reason nope is not owned-elsewhere, later-phase or no-detail$/m);
});

test('references to unknown sources, problems and features are reported', () => {
  const r = check(stage((d) => {
    d.systems[0].features[0].source = 'E9';
    d.systems[1].problem = 'P7';
    d.assumptions[0].feature = 'Nope';
    d.questions[0].refs = ['P1', 'X3'];
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^systems\[0\]\.features\[0\]: unknown source E9$/m);
  assert.match(r.err, /^systems\[1\]: unknown problem P7$/m);
  assert.match(r.err, /^assumptions\[0\]: unknown feature Nope$/m);
  assert.match(r.err, /^questions\[0\]: unknown ref X3$/m);
});

test('duplicate source and problem ids are reported', () => {
  const r = check(stage((d) => { d.sources[1].id = 'E1'; d.problems[1].id = 'P1'; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^sources: duplicate id E1$/m);
  assert.match(r.err, /^problems: duplicate id P1$/m);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test $S/scripts/test/check-shape.test.mjs`
Expected: FAIL, every test: `can't open file '…/check.py'`.

- [ ] **Step 4: Write the scripts**

`$S/scripts/draft_schema.py`:

```python
"""Shape of draft.json (references/draft-schema.md): required fields, types, ids and kinds."""
import re

SOURCE_ID = re.compile(r'^[ECN][1-9][0-9]*$')
PROBLEM_ID = re.compile(r'^P[1-9][0-9]*$')
KINDS = ('email', 'call', 'note')
FLOW_KINDS = ('main', 'side', 'sub')
REASONS = ('owned-elsewhere', 'later-phase', 'no-detail')

TOP = [('client', str), ('date', str), ('sources', list), ('problems', list),
       ('scope', dict), ('systems', list), ('assumptions', list), ('questions', list)]
SCOPE = [('covered', str), ('exclusions', list)]
ITEMS = {
    'sources': [('id', str), ('kind', str), ('date', str), ('who', str), ('file', str)],
    'problems': [('id', str), ('text', str), ('quotes', list)],
    'systems': [('name', str), ('purpose', str), ('problem', str), ('workflows', list), ('features', list)],
    'assumptions': [('text', str), ('feature', str), ('source', str)],
    'questions': [('text', str), ('why', str), ('assume', str), ('refs', list)],
}
NESTED = {
    'quotes': [('source', str), ('text', str)],
    'workflows': [('kind', str), ('steps', list), ('source', str)],
    'features': [('name', str), ('does', str), ('problem', str), ('source', str)],
    'exclusions': [('text', str), ('reason', str), ('source', str)],
}


def missing(obj, fields, where):
    if not isinstance(obj, dict):
        return [f'{where}: not an object']
    return [f'{where}: {key} missing or not {kind.__name__}'
            for key, kind in fields if not isinstance(obj.get(key), kind)]


def nested_items(draft):
    """(where, item, fields) for every item inside problems, systems and scope."""
    for i, p in enumerate(draft['problems']):
        for j, q in enumerate(p['quotes']):
            yield f'problems[{i}].quotes[{j}]', q, NESTED['quotes']
    for i, s in enumerate(draft['systems']):
        for key in ('workflows', 'features'):
            for j, x in enumerate(s[key]):
                yield f'systems[{i}].{key}[{j}]', x, NESTED[key]
    for j, x in enumerate(draft['scope']['exclusions']):
        yield f'scope.exclusions[{j}]', x, NESTED['exclusions']


def outer_findings(draft):
    out = missing(draft, TOP, 'draft')
    if out:
        return out
    out = missing(draft['scope'], SCOPE, 'scope')
    for name, fields in ITEMS.items():
        for i, item in enumerate(draft[name]):
            out += missing(item, fields, f'{name}[{i}]')
    return out


def id_findings(draft):
    out = []
    for name, pattern in (('sources', SOURCE_ID), ('problems', PROBLEM_ID)):
        ids = [x['id'] for x in draft[name]]
        out += [f'{name}: bad id {i}' for i in ids if not pattern.match(i)]
        out += [f'{name}: duplicate id {i}' for i in sorted(set(ids)) if ids.count(i) > 1]
    return out


def enum_findings(draft):
    out = [f"sources: {s['id']} kind {s['kind']} is not email, call or note"
           for s in draft['sources'] if s['kind'] not in KINDS]
    for i, s in enumerate(draft['systems']):
        out += [f"systems[{i}].workflows[{j}]: kind {w['kind']} is not main, side or sub"
                for j, w in enumerate(s['workflows']) if w['kind'] not in FLOW_KINDS]
    out += [f"scope.exclusions[{j}]: reason {x['reason']} is not owned-elsewhere, later-phase or no-detail"
            for j, x in enumerate(draft['scope']['exclusions']) if x['reason'] not in REASONS]
    return out


def shape_findings(draft):
    out = outer_findings(draft)
    if out:
        return out
    for where, item, fields in nested_items(draft):
        out += missing(item, fields, where)
    if out:
        return out
    return id_findings(draft) + enum_findings(draft)
```

`$S/scripts/draft_rules.py`:

```python
"""Rules check.py applies to a well-shaped draft: references (this task); coverage,
limits and banned words are added in Task 3."""


def source_refs(draft):
    """(where, id) for every field that must name a source."""
    for i, p in enumerate(draft['problems']):
        for j, q in enumerate(p['quotes']):
            yield f'problems[{i}].quotes[{j}]', q['source']
    for j, x in enumerate(draft['scope']['exclusions']):
        yield f'scope.exclusions[{j}]', x['source']
    for i, s in enumerate(draft['systems']):
        for key in ('workflows', 'features'):
            for j, x in enumerate(s[key]):
                yield f'systems[{i}].{key}[{j}]', x['source']
    for i, a in enumerate(draft['assumptions']):
        yield f'assumptions[{i}]', a['source']


def problem_refs(draft):
    """(where, id) for every field that must name a problem."""
    for i, s in enumerate(draft['systems']):
        yield f'systems[{i}]', s['problem']
        for j, f in enumerate(s['features']):
            yield f'systems[{i}].features[{j}]', f['problem']


def ref_findings(draft):
    sources = {s['id'] for s in draft['sources']}
    problems = {p['id'] for p in draft['problems']}
    features = {f['name'] for s in draft['systems'] for f in s['features']}
    out = [f'{w}: unknown source {r}' for w, r in source_refs(draft) if r not in sources]
    out += [f'{w}: unknown problem {r}' for w, r in problem_refs(draft) if r not in problems]
    out += [f"assumptions[{i}]: unknown feature {a['feature']}"
            for i, a in enumerate(draft['assumptions']) if a['feature'] not in features]
    for i, q in enumerate(draft['questions']):
        out += [f'questions[{i}]: unknown ref {r}' for r in q['refs'] if r not in sources | problems]
    return out
```

`$S/scripts/check.py`:

```python
#!/usr/bin/env python3
"""Checks draft.json before the docx is built (steps/check.md).

  python3 check.py --draft <dir>/draft.json

Source files are read relative to the draft's folder. Prints `draft clean`
and exits 0, or prints one finding per line on stderr and exits 1.
"""
import json
import os
import sys

from draft_rules import ref_findings
from draft_schema import shape_findings

USAGE = 'usage: check.py --draft <draft.json>'
RULES = [ref_findings]


def findings_for(draft, base):
    out = shape_findings(draft)
    if out:
        return out
    for rule in RULES:
        out += rule(draft)
    return out


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def main(argv):
    if len(argv) != 2 or argv[0] != '--draft':
        print(USAGE, file=sys.stderr)
        return 2
    try:
        draft = load(argv[1])
    except (OSError, ValueError) as e:
        print(f'{os.path.basename(argv[1])}: {e}', file=sys.stderr)
        return 1
    out = findings_for(draft, os.path.dirname(os.path.abspath(argv[1])))
    if out:
        print('\n'.join(out), file=sys.stderr)
        return 1
    print('draft clean')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 5: Run it to see it pass**

Run: `node --test $S/scripts/test/check-shape.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/draft-scope/scripts
/usr/bin/git commit -m "feat(business-analyst): check a draft's shape and references"
```

---

### Task 3: check.py — quotes, coverage, limits, banned words

**Files:**
- Create: `$S/scripts/draft_quotes.py`, `$S/scripts/test/check-rules.test.mjs`
- Modify: `$S/scripts/draft_rules.py` (append), `$S/scripts/check.py` (imports, `RULES`, quote check)

**Interfaces:**
- Consumes: `shape_findings`, `ref_findings`, `check.py` from Task 2; `stage`, `check` from helpers.mjs.
- Produces: `coverage_findings(draft)`, `limit_findings(draft)`, `word_findings(draft)` (draft_rules.py); `quote_findings(draft, base)` (draft_quotes.py).

- [ ] **Step 1: Write the failing test**

`$S/scripts/test/check-rules.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { check, stage } from './helpers.mjs';

const quote = (d) => d.problems[1].quotes[0];

test('a reworded quote is reported with the closest source sentence', () => {
  const r = check(stage((d) => { quote(d).text = 'When a ticket is lost the customer calls us.'; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^problems\[1\]\.quotes\[0\]: not word for word in C1; closest: "Dana: When a ticket gets lost the customer calls us and we have no idea where the cake is\."$/m);
});

test('normalised quotes match: line breaks, extra spaces, part of a sentence', () => {
  const r = check(stage((d) => {
    quote(d).text = 'When a ticket gets lost   the customer\ncalls us and we have no idea where the cake is.';
    d.problems[0].quotes[0].text = 'Last month we ran out twice on a Saturday';
  }));
  assert.equal(r.code, 0, r.err);
  const c = check(stage((d) => { quote(d).text = 'the customer calls us'; }));
  assert.equal(c.code, 0, c.err);
});

test('a missing source file is reported once', () => {
  const dir = stage();
  rmSync(join(dir, 'sources', 'C1.txt'));
  const r = check(dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /^sources: C1 file sources\/C1\.txt not found$/m);
});

test('a problem no feature or question points at is reported', () => {
  const r = check(stage((d) => {
    d.problems.push({ id: 'P3', text: 'We cannot see which cakes are custom', quotes: [{ source: 'C1', text: 'About 30% of orders are custom cakes.' }] });
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^P3: no feature or client question points at it$/m);
});

test('a client question alone covers a problem', () => {
  const r = check(stage((d) => {
    d.problems.push({ id: 'P3', text: 'We cannot see which cakes are custom', quotes: [{ source: 'C1', text: 'About 30% of orders are custom cakes.' }] });
    d.questions.push({ text: 'Last time a custom cake was late, where did it wait?', why: 'Shapes the custom-cake steps', assume: 'Same steps as other orders', refs: ['P3'] });
  }));
  assert.equal(r.code, 0, r.err);
});

test('limits: 7 problems, 9 assumptions, a 6-word step, 1- and 7-word feature names', () => {
  const r = check(stage((d) => {
    for (let n = 3; n <= 7; n++) d.problems.push({ id: `P${n}`, text: 'x', quotes: [quote(d)] });
    d.questions[0].refs = d.problems.map((p) => p.id);
    d.assumptions = Array.from({ length: 9 }, () => d.assumptions[0]);
    d.systems[0].workflows[0].steps[0] = 'Take the order in from WhatsApp';
    d.systems[0].features[0].name = 'Board';
    d.systems[1].features[0].name = 'Alert for flour when it drops low';
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^problems: 7, at most 6$/m);
  assert.match(r.err, /^assumptions: 9, at most 8$/m);
  assert.match(r.err, /^systems\[0\]\.workflows\[0\]: step "Take the order in from WhatsApp" has 6 words, at most 5$/m);
  assert.match(r.err, /^systems\[0\]\.features\[0\]: name "Board" has 1 words, 2 to 6$/m);
  assert.match(r.err, /^systems\[1\]\.features\[0\]: name "Alert for flour when it drops low" has 7 words, 2 to 6$/m);
});

test('no problems at all is reported', () => {
  const r = check(stage((d) => { d.problems = []; d.systems.forEach((s) => { s.problem = 'P1'; s.features = []; }); d.assumptions = []; d.questions = []; }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^problems: 0, at least 1$/m);
});

test('a banned word outside quotes is reported with its place', () => {
  const r = check(stage((d) => {
    d.systems[0].purpose = 'A seamless way to track orders; closes P2';
    d.questions[0].assume = 'Some bags left';
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /^systems\[0\]\.purpose: vague word "seamless"$/m);
  assert.match(r.err, /^questions\[0\]\.assume: vague word "some"$/m);
});

test('vague word inside quotes is allowed', () => {
  const r = check(stage((d) => {
    d.questions[0].text = 'You wrote "deliveries must be fast": by what time of day?';
    d.questions[0].why = 'Sets the promise in “quick” terms';
  }));
  assert.equal(r.code, 0, r.err);
});

test('banned words match whole words only', () => {
  const r = check(stage((d) => { d.systems[1].purpose = 'Keeps flour on hand for breakfast baking; closes P1'; }));
  assert.equal(r.code, 0, r.err);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test $S/scripts/test/check-rules.test.mjs`
Expected: FAIL. The tests that expect findings exit 0 (no rule yet); `normalised quotes match`, `a client question alone covers a problem`, `vague word inside quotes is allowed` and `banned words match whole words only` already PASS.

- [ ] **Step 3: Write the code**

`$S/scripts/draft_quotes.py`:

```python
"""Every problem quote must appear word for word in its source file."""
import difflib
import os
import re

MARKS = str.maketrans({'“': '"', '”': '"', '‘': "'", '’': "'"})
SENTENCE = re.compile(r'(?<=[.!?])\s+|\n+')


def norm(text):
    return ' '.join(text.translate(MARKS).split())


def read_sources(draft, base):
    """{id: text} for every source file found, plus findings for the missing ones."""
    texts, out = {}, []
    for s in draft['sources']:
        path = os.path.join(base, s['file'])
        if os.path.isfile(path):
            with open(path, encoding='utf-8') as f:
                texts[s['id']] = f.read()
        else:
            out.append(f"sources: {s['id']} file {s['file']} not found")
    return texts, out


def closest(quote, raw):
    sentences = [norm(s) for s in SENTENCE.split(raw) if s.strip()]
    best = difflib.get_close_matches(norm(quote), sentences, n=1, cutoff=0)
    return best[0] if best else ''


def quote_findings(draft, base):
    texts, out = read_sources(draft, base)
    for i, p in enumerate(draft['problems']):
        for j, q in enumerate(p['quotes']):
            raw = texts.get(q['source'])
            if raw is None or norm(q['text']) in norm(raw):
                continue
            hint = closest(q['text'], raw)
            out.append(f"problems[{i}].quotes[{j}]: not word for word in {q['source']}; closest: \"{hint}\"")
    return out
```

Append to `$S/scripts/draft_rules.py`:

```python
import re

MAX_PROBLEMS = 6
MAX_ASSUMPTIONS = 8
BANNED = ['fast', 'quick', 'easy', 'simple', 'user-friendly', 'intuitive', 'flexible', 'robust',
          'seamless', 'efficient', 'optimal', 'appropriate', 'various', 'etc', 'some', 'many',
          'several', 'as needed']
QUOTED = re.compile(r'"[^"]*"|“[^”]*”')


def words(text):
    return len([w for w in text.split() if any(c.isalnum() for c in w)])


def coverage_findings(draft):
    hit = {f['problem'] for s in draft['systems'] for f in s['features']}
    hit |= {r for q in draft['questions'] for r in q['refs']}
    return [f"{p['id']}: no feature or client question points at it"
            for p in draft['problems'] if p['id'] not in hit]


def count_findings(draft):
    n, a = len(draft['problems']), len(draft['assumptions'])
    out = [f'problems: {n}, at least 1'] if n < 1 else []
    out += [f'problems: {n}, at most {MAX_PROBLEMS}'] if n > MAX_PROBLEMS else []
    return out + ([f'assumptions: {a}, at most {MAX_ASSUMPTIONS}'] if a > MAX_ASSUMPTIONS else [])


def limit_findings(draft):
    out = count_findings(draft)
    for i, s in enumerate(draft['systems']):
        for j, w in enumerate(s['workflows']):
            out += [f'systems[{i}].workflows[{j}]: step "{st}" has {words(st)} words, at most 5'
                    for st in w['steps'] if not 1 <= words(st) <= 5]
        out += [f"systems[{i}].features[{j}]: name \"{f['name']}\" has {words(f['name'])} words, 2 to 6"
                for j, f in enumerate(s['features']) if not 2 <= words(f['name']) <= 6]
    return out


def text_fields(draft):
    """(where, text) for every field the PO reads that is not a quote."""
    yield 'scope.covered', draft['scope']['covered']
    for i, p in enumerate(draft['problems']):
        yield f'problems[{i}].text', p['text']
    for j, x in enumerate(draft['scope']['exclusions']):
        yield f'scope.exclusions[{j}].text', x['text']
    for i, s in enumerate(draft['systems']):
        yield f'systems[{i}].name', s['name']
        yield f'systems[{i}].purpose', s['purpose']
        for j, f in enumerate(s['features']):
            yield f'systems[{i}].features[{j}].name', f['name']
            yield f'systems[{i}].features[{j}].does', f['does']
    for i, a in enumerate(draft['assumptions']):
        yield f'assumptions[{i}].text', a['text']
    for i, q in enumerate(draft['questions']):
        for key in ('text', 'why', 'assume'):
            yield f'questions[{i}].{key}', q[key]


def word_findings(draft):
    out = []
    for where, text in text_fields(draft):
        plain = QUOTED.sub(' ', text)
        out += [f'{where}: vague word "{w}"' for w in BANNED
                if re.search(rf'(?<![\w-]){re.escape(w)}(?![\w-])', plain, re.IGNORECASE)]
    return out
```

Move the `import re` line to the top of `draft_rules.py`, under the module docstring, and change the docstring to:

```python
"""Rules check.py applies to a well-shaped draft: references, coverage, limits, banned words."""
```

In `$S/scripts/check.py`, replace:

```python
from draft_rules import ref_findings
from draft_schema import shape_findings

USAGE = 'usage: check.py --draft <draft.json>'
RULES = [ref_findings]
```

with:

```python
from draft_quotes import quote_findings
from draft_rules import coverage_findings, limit_findings, ref_findings, word_findings
from draft_schema import shape_findings

USAGE = 'usage: check.py --draft <draft.json>'
RULES = [ref_findings, coverage_findings, limit_findings, word_findings]
```

and replace:

```python
    for rule in RULES:
        out += rule(draft)
    return out
```

with:

```python
    for rule in RULES:
        out += rule(draft)
    return out + quote_findings(draft, base)
```

- [ ] **Step 4: Run both check tests to see them pass**

Run: `node --test $S/scripts/test/check-shape.test.mjs $S/scripts/test/check-rules.test.mjs`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/draft-scope/scripts
/usr/bin/git commit -m "feat(business-analyst): check quotes, coverage, limits and wording"
```

---

### Task 4: build_docx.py

**Files:**
- Create: `$S/scripts/build_docx.py`, `$S/scripts/docx_xml.py`, `$S/scripts/docx_body.py`, `$S/scripts/docx_package.py`
- Test: `$S/scripts/test/build-docx.test.mjs`

**Interfaces:**
- Consumes: the draft.json shape; `py`, `stage` from helpers.mjs.
- Produces: `build_docx.py --draft <draft.json> --out <file.docx>` (exit 0 and prints the out path; 2 on usage); `document_xml(draft) → str`; `write_docx(path, document) → None`.

- [ ] **Step 1: Write the failing test**

`$S/scripts/test/build-docx.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { py, stage } from './helpers.mjs';

const READ = 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); print("\\n".join(z.namelist())); print("@@"); print(z.read("word/document.xml").decode())';

function built(mutate) {
  const dir = stage(mutate);
  const out = join(dir, 'draft-scope.docx');
  const r = py('build_docx.py', ['--draft', join(dir, 'draft.json'), '--out', out]);
  assert.equal(r.code, 0, r.err);
  const [names, xml] = execFileSync('python3', ['-c', READ, out], { encoding: 'utf8' }).split('@@\n');
  return { names: names.trim().split('\n'), xml, text: xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
}

test('the package holds the Word parts, content types first', () => {
  const { names } = built();
  assert.equal(names[0], '[Content_Types].xml');
  for (const p of ['_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml']) {
    assert.ok(names.includes(p), p);
  }
});

test('sections come in the document order of the spec', () => {
  const { text } = built();
  const order = ['Riverside Bakery — Scope draft', 'Sources', 'Problems we heard', 'Scope', 'Exclusions',
    'System 1: Orders', 'System 2: Stock', 'Assumptions', 'Questions for the client'];
  let at = -1;
  for (const h of order) {
    const i = text.indexOf(h, at + 1);
    assert.ok(i > at, `${h} missing or out of order`);
    at = i;
  }
});

test('step lines are plain text', () => {
  const { text } = built();
  assert.match(text, /Main workflow: Order In → Bake → Pack → Courier Handoff/);
  assert.match(text, /Custom cake \(starts at Order In, rejoins at Bake, ~30% of orders\): Quote → Confirm Design/);
  const side = built((d) => { d.systems[0].workflows.push({ kind: 'side', steps: ['Pack', 'Missing item'], returnsTo: 'Order In', source: 'C1' }); });
  assert.match(side.text, /Side path: Pack → Missing item → back to Order In/);
});

test('tables carry their columns and rows', () => {
  const { text } = built();
  assert.match(text, /Feature What it does From Order board Shows every order/);
  assert.match(text, /Exclusion Reason From Delivery routes Owned by someone else C1/);
  assert.match(text, /Question Why it matters If no answer, assume About Last time you ran out of flour/);
  assert.match(text, /"Last month we ran out twice on a Saturday and had to close the cake counter by noon\." \(E1\)/);
});

test('empty sections say None', () => {
  const { text } = built((d) => { d.scope.exclusions = []; d.assumptions = []; d.systems[1].features = []; });
  assert.match(text, /Exclusions None\./);
  assert.match(text, /System 2: Stock Keeps flour on hand for weekend baking; closes P1 None\./);
  assert.match(text, /Assumptions None\./);
});

test('special characters are escaped', () => {
  const { xml } = built((d) => { d.client = 'Bread & <Butter>\u0001'; });
  assert.match(xml, /Bread &amp; &lt;Butter&gt; — Scope draft/);
  assert.doesNotMatch(xml, /\u0001/);
});

test('wrong arguments print usage and exit 2', () => {
  const r = py('build_docx.py', ['--draft']);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage: build_docx\.py --draft <draft\.json> --out <draft-scope\.docx>/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test $S/scripts/test/build-docx.test.mjs`
Expected: FAIL, every test: `can't open file '…/build_docx.py'`.

- [ ] **Step 3: Write the code**

`$S/scripts/docx_xml.py`:

```python
"""WordprocessingML pieces: paragraphs, bullet lists, tables (styles in docx_package.py)."""
import re

TEXT_WIDTH = 9638  # twips: A4 width less two 2 cm margins
CONTROL = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f]')
BULLET = ('<w:pPr><w:pStyle w:val="ListParagraph"/>'
          '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>')


def xml_text(text):
    clean = CONTROL.sub('', str(text))
    return clean.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def run(text, bold=False):
    props = '<w:rPr><w:b/></w:rPr>' if bold else ''
    return f'<w:r>{props}<w:t xml:space="preserve">{xml_text(text)}</w:t></w:r>'


def para(text, style=None):
    if not text:
        return ''
    props = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return f'<w:p>{props}{run(text)}</w:p>'


def bullets(items):
    return ''.join(f'<w:p>{BULLET}{run(t)}</w:p>' for t in items)


def row(cells, head):
    props = '<w:trPr><w:tblHeader/></w:trPr>' if head else ''
    tcs = ''.join(f'<w:tc><w:p>{run(c, head)}</w:p></w:tc>' for c in cells)
    return f'<w:tr>{props}{tcs}</w:tr>'


def table(head, rows):
    """A bordered table, or a 'None.' line when there are no rows."""
    if not rows:
        return para('None.')
    grid = ''.join(f'<w:gridCol w:w="{TEXT_WIDTH // len(head)}"/>' for _ in head)
    body = row(head, True) + ''.join(row(r, False) for r in rows)
    return ('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>'
            f'<w:tblGrid>{grid}</w:tblGrid>{body}</w:tbl><w:p/>')
```

`$S/scripts/docx_body.py`:

```python
"""document.xml for draft-scope.docx, in the order of the spec's 'Document shape'."""
from docx_xml import bullets, para, table

NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
SECTION = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" '
           'w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>')
NOTE = ('Drafted from the sources below. It holds only what the client said; '
        'the PO adds value-add features while editing.')
REASONS = {'owned-elsewhere': 'Owned by someone else', 'later-phase': 'Later phase',
           'no-detail': 'No process detail yet'}
ARROW = ' → '


def head_xml(d):
    rows = [[s['id'], s['kind'], s['date'], s['who']] for s in d['sources']]
    return (para(f"{d['client']} — Scope draft", 'Title') + para(d['date'], 'Subtitle') + para(NOTE)
            + para('Sources', 'Heading1') + table(['Source', 'Kind', 'Date', 'Who / subject'], rows))


def problems_xml(d):
    out = para('Problems we heard', 'Heading1')
    for p in d['problems']:
        heard = ', '.join(sorted({q['source'] for q in p['quotes']}))
        out += para(f"{p['id']} {p['text']}", 'Heading3')
        out += bullets([f'"{q["text"]}" ({q["source"]})' for q in p['quotes']])
        out += para(f'Heard in: {heard}')
    return out


def scope_xml(scope):
    out = para('Scope', 'Heading1') + para(scope['covered'])
    pillars = scope.get('pillars') or []
    if pillars:
        out += table(['System', 'Client pillar'], [[x['system'], x['pillar']] for x in pillars])
    rows = [[x['text'], REASONS[x['reason']], x['source']] for x in scope['exclusions']]
    return out + para('Exclusions', 'Heading2') + table(['Exclusion', 'Reason', 'From'], rows)


def flow_line(w):
    steps = ARROW.join(w['steps'])
    if w['kind'] == 'main':
        return f'Main workflow: {steps}'
    if w['kind'] == 'side':
        back = f" → back to {w['returnsTo']}" if w.get('returnsTo') else ''
        return f'Side path: {steps}{back}'
    parts = [f"starts at {w['startsAt']}" if w.get('startsAt') else '',
             f"rejoins at {w['rejoinsAt']}" if w.get('rejoinsAt') else '', w.get('share') or '']
    where = ', '.join(p for p in parts if p)
    name = w.get('name') or 'Sub-workflow'
    return f'{name} ({where}): {steps}' if where else f'{name}: {steps}'


def system_xml(s, n):
    rows = [[f['name'], f['does'], f['source']] for f in s['features']]
    flows = ''.join(para(flow_line(w)) for w in s['workflows'])
    return (para(f"System {n}: {s['name']}", 'Heading1') + para(s['purpose']) + flows
            + table(['Feature', 'What it does', 'From'], rows))


def closing_xml(d):
    a = [[x['text'], x['feature'], x['source']] for x in d['assumptions']]
    q = [[x['text'], x['why'], x['assume'], ', '.join(x['refs'])] for x in d['questions']]
    return (para('Assumptions', 'Heading1') + table(['Assumption', 'For feature', 'From'], a)
            + para('Questions for the client', 'Heading1')
            + table(['Question', 'Why it matters', 'If no answer, assume', 'About'], q))


def document_xml(d):
    systems = ''.join(system_xml(s, i + 1) for i, s in enumerate(d['systems']))
    body = head_xml(d) + problems_xml(d) + scope_xml(d['scope']) + systems + closing_xml(d)
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            f'<w:document {NS}><w:body>{body}{SECTION}</w:body></w:document>')
```

`$S/scripts/docx_package.py`:

```python
"""The DOCX package around document.xml: content types, relationships, the
built-in styles the body uses, one bullet list. Standard Word styles only."""
import zipfile

XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml'

CONTENT_TYPES = (f'{XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                 '<Default Extension="xml" ContentType="application/xml"/>'
                 f'<Override PartName="/word/document.xml" ContentType="{MAIN}.document.main+xml"/>'
                 f'<Override PartName="/word/styles.xml" ContentType="{MAIN}.styles+xml"/>'
                 f'<Override PartName="/word/numbering.xml" ContentType="{MAIN}.numbering+xml"/></Types>')
ROOT_RELS = (f'{XML}<Relationships xmlns="{PKG_REL}">'
             f'<Relationship Id="rId1" Type="{REL}/officeDocument" Target="word/document.xml"/></Relationships>')
DOC_RELS = (f'{XML}<Relationships xmlns="{PKG_REL}">'
            f'<Relationship Id="rIdStyles" Type="{REL}/styles" Target="styles.xml"/>'
            f'<Relationship Id="rIdNumbering" Type="{REL}/numbering" Target="numbering.xml"/></Relationships>')


def p_style(sid, name, props):
    return (f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{name}"/>'
            f'<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>{props}</w:style>')


def heading(level, size):
    before = 360 if level == 1 else 240
    return p_style(f'Heading{level}', f'heading {level}',
                   f'<w:pPr><w:keepNext/><w:spacing w:before="{before}" w:after="120"/>'
                   f'<w:outlineLvl w:val="{level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="{size}"/></w:rPr>')


BORDER = ''.join(f'<w:{b} w:val="single" w:sz="4" w:space="0" w:color="D9DDE3"/>'
                 for b in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
STYLES = (f'{XML}<w:styles {W}><w:docDefaults><w:rPrDefault><w:rPr>'
          '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>'
          '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
          '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
          + p_style('Title', 'Title', '<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr>')
          + p_style('Subtitle', 'Subtitle', '<w:rPr><w:color w:val="5C6470"/><w:sz w:val="24"/></w:rPr>')
          + heading(1, 32) + heading(2, 24) + heading(3, 22)
          + p_style('ListParagraph', 'List Paragraph', '<w:pPr><w:ind w:left="720"/></w:pPr>')
          + f'<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>{BORDER}</w:tblBorders>'
          '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
          '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>')
NUMBERING = (f'{XML}<w:numbering {W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>'
             '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>'
             '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>'
             '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')


def write_docx(path, document):
    """[Content_Types].xml first, as Word expects; deflate-compressed."""
    parts = [('[Content_Types].xml', CONTENT_TYPES), ('_rels/.rels', ROOT_RELS),
             ('word/document.xml', document), ('word/_rels/document.xml.rels', DOC_RELS),
             ('word/styles.xml', STYLES), ('word/numbering.xml', NUMBERING)]
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, xml in parts:
            z.writestr(name, xml.encode('utf-8'))
```

`$S/scripts/build_docx.py`:

```python
#!/usr/bin/env python3
"""Builds draft-scope.docx from a draft.json that check.py passed.

  python3 build_docx.py --draft <dir>/draft.json --out <dir>/draft-scope.docx

Standard library only. Run check.py first: this script trusts the shape.
"""
import json
import sys

from docx_body import document_xml
from docx_package import write_docx

USAGE = 'usage: build_docx.py --draft <draft.json> --out <draft-scope.docx>'


def parse(argv):
    if len(argv) != 4 or argv[0] != '--draft' or argv[2] != '--out':
        return None
    return argv[1], argv[3]


def main(argv):
    args = parse(argv)
    if args is None:
        print(USAGE, file=sys.stderr)
        return 2
    with open(args[0], encoding='utf-8') as f:
        draft = json.load(f)
    write_docx(args[1], document_xml(draft))
    print(args[1])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test $S/scripts/test/build-docx.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Open the docx by hand once**

Run: `node -e "import('./$S/scripts/test/helpers.mjs').then(({ stage, py }) => { const d = stage(); console.log(py('build_docx.py', ['--draft', d + '/draft.json', '--out', d + '/draft-scope.docx']).out); })"`
Then: `soffice --headless --convert-to pdf --outdir /tmp <printed path>` (or open it in Word).
Expected: converts without error; the PDF shows the title, the tables with borders, the bullet quotes. If LibreOffice is not installed, say so in the Task 7 report.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/draft-scope/scripts
/usr/bin/git commit -m "feat(business-analyst): build the draft-scope docx"
```

---

### Task 5: Evals on a fictional client

**Files:**
- Create: `plugins/business-analyst/evals/draft-scope-rich/{case.yaml,fixture.sh,prompt.md}`, `inputs/{E1.txt,E2.txt,E3.txt,C1.txt}`, `graders/*.md`
- Create: `plugins/business-analyst/evals/draft-scope-thin/{case.yaml,fixture.sh,prompt.md}`, `inputs/E1.txt`, `graders/*.md`

**Interfaces:**
- Consumes: the skill from Tasks 1–4. Same case format as `plugins/business-analyst/evals/ba-review-page` (`schema_version "1.1"`, `context.scaffold_script`).

- [ ] **Step 1: Write the rich case**

`plugins/business-analyst/evals/draft-scope-rich/case.yaml`:

```yaml
schema_version: "1.1"
name: draft-scope-rich
context:
  scaffold_script: fixture.sh
```

`plugins/business-analyst/evals/draft-scope-rich/fixture.sh`:

```bash
#!/usr/bin/env bash
# Seeds the workspace with Riverside Bakery's raw material: three emails and
# one call transcript, each holding one planted trap the graders look for.
set -euo pipefail
cp "$(cd "$(dirname "$0")" && pwd)"/inputs/*.txt .
```

`plugins/business-analyst/evals/draft-scope-rich/prompt.md`:

```markdown
---
max_turns: 25
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite]
---

Use the draft-scope skill. I'm the PO for Riverside Bakery. All I have are
the emails and the call transcript in this folder (E1.txt, E2.txt, E3.txt,
C1.txt). Draft the scope document from them. If you cannot run the
scripts or write files here, show the full draft in your reply.
```

`inputs/E1.txt`:

```
From: Dana Lee, owner, Riverside Bakery
Date: 2026-09-02
Subject: Running out of flour

Hi, can you build us an app so we stop running out of flour? Last month we ran out twice on a Saturday and had to close the cake counter by noon.
```

`inputs/E2.txt`:

```
From: Dana Lee, owner, Riverside Bakery
Date: 2026-09-04
Subject: Deliveries

Deliveries must be fast. We promise next-morning delivery for every cake order.
```

`inputs/E3.txt`:

```
From: Dana Lee, owner, Riverside Bakery
Date: 2026-09-05
Subject: Custom cakes

About 30% of our orders are custom cakes. Those need the customer to approve the design before we bake.
```

`inputs/C1.txt`:

```
Call 2026-09-10 · Dana Lee (owner), Sam (our PO)

Dana: Orders come in by WhatsApp, that stays. Customers like it.
Dana: We write each order on a paper ticket, bake, pack and hand it to the courier.
Dana: When a ticket gets lost the customer calls us and we have no idea where the cake is.
Sam: How quickly do cakes go out?
Dana: Same day, if the order is in before 10am.
Sam: Who plans the delivery routes?
Dana: The courier company handles routes, not us.
Dana: By the way, we changed the café playlist last week, everyone loves the new jazz mix.
```

`graders/skill-fired.md`:

```markdown
---
type: tool_used
tool: Skill
min: 1
---

The skill must actually be invoked, not merely described.
```

`graders/problem-not-solution.md`:

```markdown
---
type: llm
focus: last_message
---

E1 asks "can you build us an app so we stop running out of flour?". The
sandbox has no Bash; judge the draft shown in the final reply.

PASS if running out of flour appears as a problem in the client's terms
(e.g. "we run out of flour before we notice"), backed by a quote from E1,
and no feature is named or described simply as "an app" or "flour app".
FAIL if the draft states the problem as "build an app", or has no
flour-related problem.
```

`graders/vague-word.md`:

```markdown
---
type: llm
focus: last_message
---

E2 says "Deliveries must be fast."

PASS if the word "fast" appears nowhere in the draft's problems, system
purposes, feature names, "What it does" text or assumptions, except inside
a quotation of the client's words, AND a client question asks what "fast"
means in measurable terms (hours, a cut-off time) or quotes it.
FAIL if a feature, purpose or assumption says "fast" in its own words, or
no question asks for the measurable meaning.
```

`graders/share-kept.md`:

```markdown
---
type: llm
focus: last_message
---

E3 says "About 30% of our orders are custom cakes. Those need the customer
to approve the design before we bake."

PASS if the draft shows custom cakes as a sub-workflow or side path whose
line or description keeps the 30% (as "30%", "~30%" or "about 30%").
FAIL if custom cakes are missing, or the 30% is dropped or changed.
```

`graders/keep-and-exclude.md`:

```markdown
---
type: llm
focus: last_message
---

C1 says "Orders come in by WhatsApp, that stays." and "The courier company
handles routes, not us."

PASS if both hold:
- WhatsApp ordering is kept as-is: an assumption, an exclusion, or a scope
  line saying ordering stays on WhatsApp; no feature replaces WhatsApp.
- Delivery routes are excluded with a reason that says the courier owns
  them (owned by someone else).
FAIL if either is missing, or a feature plans or optimises delivery routes.
```

`graders/conflict-question.md`:

```markdown
---
type: llm
focus: last_message
---

E2 promises "next-morning delivery"; C1 says "Same day, if the order is in
before 10am."

PASS if one client question puts both promises side by side (quoting or
naming next-morning and same-day) and asks which holds.
FAIL if the draft picks one silently, or never mentions the conflict.
```

`graders/noise-and-shape.md`:

```markdown
---
type: llm
focus: last_message
---

PASS if all hold:
- Nothing in the draft is about the café playlist, music or jazz.
- Systems are named as business areas (e.g. Orders, Stock, Delivery), not
  technical parts (backend, database, mobile app, API).
- The draft has at most 8 assumptions.
- The reply asks the user no question to answer before drafting (client
  questions inside the draft are fine).
FAIL if any of these is broken.
```

- [ ] **Step 2: Write the thin case**

`plugins/business-analyst/evals/draft-scope-thin/case.yaml`:

```yaml
schema_version: "1.1"
name: draft-scope-thin
context:
  scaffold_script: fixture.sh
```

`plugins/business-analyst/evals/draft-scope-thin/fixture.sh`:

```bash
#!/usr/bin/env bash
# Seeds one short email: too little to draft systems from without inventing.
set -euo pipefail
cp "$(cd "$(dirname "$0")" && pwd)"/inputs/*.txt .
```

`plugins/business-analyst/evals/draft-scope-thin/prompt.md`:

```markdown
---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite]
---

Use the draft-scope skill. I'm the PO for Bloom & Co. All I have is the
email in E1.txt. Draft the scope document from it. If you cannot run the
scripts or write files here, show the full draft in your reply.
```

`inputs/E1.txt`:

```
From: Mia Tan, Bloom & Co (florist)
Date: 2026-09-20
Subject: Wedding orders

Hi, we'd like something to handle our wedding orders better. They keep getting mixed up. Can we chat next week?
```

`graders/skill-fired.md`: same content as the rich case's `skill-fired.md`.

`graders/no-invention.md`:

```markdown
---
type: llm
focus: last_message
---

The only input is a three-line email: wedding orders "keep getting mixed
up". Judge the draft in the final reply.

PASS if all hold:
- At most one system, about wedding orders.
- No workflow steps, or only steps the email names (it names none), with
  the missing steps raised as a client question.
- Every feature (if any) is about keeping wedding orders from being mixed
  up; nothing about payments, delivery, stock, websites or marketing.
- At least three client questions, at least one about a real past case
  ("last time an order got mixed up…").
FAIL if the draft invents systems, steps or features the email does not
support, or has fewer than three client questions.
```

- [ ] **Step 3: Run both cases**

Run (each in its own call, background, they take minutes):
`claude plugin eval plugins/business-analyst --case 'draft-scope-*' --ablation none --no-publish --trust-plugin --scaffold`
Expected: every grader PASS in both cases. On a FAIL, read the transcript: if the draft is wrong, fix the step file that owns the rule (steps/draft.md, steps/assumptions.md, references/rules.md); if the grader misjudged correct output, fix the grader wording. Re-run only the failing case with `--case <name>`.

- [ ] **Step 4: Commit**

```bash
/usr/bin/git add plugins/business-analyst/evals/draft-scope-rich plugins/business-analyst/evals/draft-scope-thin
/usr/bin/git commit -m "test(business-analyst): draft-scope evals on a fictional bakery"
```

---

### Task 6: Gates, version, listings

**Files:**
- Create: `$S/scripts/test/gates.test.mjs`
- Modify: `plugins/business-analyst/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`

- [ ] **Step 1: Write the failing gate test**

`$S/scripts/test/gates.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('..', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.py'));

// A function runs from its `def` line to the next top-level line.
function functions(src) {
  const lines = src.split('\n');
  const out = [];
  lines.forEach((l, i) => {
    const m = /^def (\w+)\(([^)]*)\)/.exec(l);
    if (!m) return;
    let end = i + 1;
    while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end += 1;
    while (lines[end - 1] === '') end -= 1;
    out.push({ name: m[1], params: m[2].split(',').filter((p) => p.trim()).length, lines: end - i });
  });
  return out;
}

test('there are Python scripts to gate', () => {
  assert.ok(files.length >= 8, files.join(', '));
});

for (const f of files) {
  test(`gates: ${f}`, () => {
    const src = readFileSync(dir + f, 'utf8');
    const fns = functions(src);
    assert.ok(src.split('\n').length <= 200, `${f}: over 200 lines`);
    assert.ok(fns.length <= 10, `${f}: ${fns.length} functions`);
    for (const fn of fns) {
      assert.ok(fn.lines <= 20, `${f} ${fn.name}: ${fn.lines} lines`);
      assert.ok(fn.params <= 3, `${f} ${fn.name}: ${fn.params} params`);
    }
  });
}
```

- [ ] **Step 2: Run it**

Run: `node --test $S/scripts/test/gates.test.mjs`
Expected: PASS, 9 tests (1 count + 8 files). This test guards the scripts written in Tasks 2–4. If a file fails, split the named function before going on; do not raise the limits.

- [ ] **Step 3: Bump the version and listings**

In `plugins/business-analyst/.claude-plugin/plugin.json` and in the `business-analyst` entry of `.claude-plugin/marketplace.json`, replace:

```
"version": "0.4.0",
```

with:

```
"version": "0.5.0",
```

and in both files replace the description

```
"description": "Business-analysis toolkit: interview-driven requirements discovery that turns raw client input into a validated, traceable requirements package ready for solution architecture.",
```

with:

```
"description": "Business-analysis toolkit: interview-driven requirements discovery that turns raw client input into a validated, traceable requirements package ready for solution architecture, plus a drafter that turns raw emails and call transcripts into an editable workflow-based scope document.",
```

In `README.md`, in the Plugins table, replace the `business-analyst` row with:

```
| `business-analyst`   | Business-analysis toolkit: interview-driven requirements discovery that turns raw client input into a validated, traceable requirements package ready for solution architecture, plus a drafter that turns raw emails and call transcripts into an editable workflow-based scope document. | 0.5.0   |
```

and under **Model-invoked**, after the `business-analyst` bullet, add:

```
- **[draft-scope](./plugins/business-analyst/skills/draft-scope/SKILL.md)** (`business-analyst`) — Drafts a workflow-based scope document (problems, systems, step lines, features, assumptions, client questions) from raw emails and call transcripts as an editable DOCX; every line cites its source. The PO edits it, then uses it with business-analyst.
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test 2>&1 | tail -8`
Expected: `ℹ fail 0`, `ℹ tests 1461`: `main` at `220b690` had 1423, and this plan adds 5 + 7 + 10 + 7 + 9 = 38.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/draft-scope/scripts/test/gates.test.mjs plugins/business-analyst/.claude-plugin/plugin.json .claude-plugin/marketplace.json README.md
/usr/bin/git commit -m "chore(business-analyst): draft-scope listed, 0.5.0"
```

---

### Task 7: Verify, review, report, wait

- [ ] **Step 1: Full suite**

Run: `npm test 2>&1 | tail -8`
Expected: `ℹ tests 1461`, `ℹ fail 0` (1423 at `220b690` + 38). If the count differs, report the number and why.

- [ ] **Step 2: Evals**

Both cases green from Task 5 Step 3, re-run once on the final branch:
`claude plugin eval plugins/business-analyst --case 'draft-scope-*' --ablation none --no-publish --trust-plugin --scaffold`

- [ ] **Step 3: claude.ai results**

Record the user's answers from Task 1 Step 6 (both runs): which skill loaded, step files read, scripts ran, docx opened in Google Docs. If draft-scope did not load for an unnamed request (Review Focus 1), report it with the user's exact wording; do not change the business-analyst skill.

- [ ] **Step 4: Whole-branch review**

One fresh reviewer (most capable model) reads the spec, this plan and `git diff main...feat/draft-scope`, with the Review Focus list. Fix what it confirms, re-run Step 1.

- [ ] **Step 5: Report and wait**

Report to the user: commits, test count, eval results, claude.ai results, review outcome, deviations. Then **stop**. No merge, no push, until the user has tested and says so.
