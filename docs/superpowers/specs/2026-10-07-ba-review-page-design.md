> Superseded by docs/superpowers/specs/2026-10-07-ba-review-page-readonly.md (read-only page).

# Business-analyst review page — Design Spec

Date: 2026-10-07 · Plugin: business-analyst → **0.4.0** · Skill: `business-analyst`
Branch: `feat/ba-review-page` from `feat/workflow-based-estimator` (`de64fdc`).
Reopens spec 1 (`2026-10-06-ba-workflow-scope-design.md`): reverses **D6** (no
HTML page), **D7** (PO review read-only) and **D8** (no IDs in To-be scope).
Replaces the 0.3.7 tick-box stopgap (`references/interview.md` §8).
Agreed look: mockup https://claude.ai/artifact/LHZuZBWbW6acHCLphdFB7L
(illustrative Sin Kowa data; its IDs are made up).

## Summary

Two readers, two views, one source.

```
requirements.json ──► review.html        PO: business words, drawn workflows, yes / no / note
       ▲                   │ "Copy decisions" → paste in chat
       └── review apply ◄──┘
       │
       └──────────────► requirements.md   engineers: IDs, FR table, left-out table
```

The contract downstream skills rely on: **`features` (and `systems`,
to-be `workflows`) hold only what will be built.** What the PO declines
moves to `leftOut`; no other skill needs to know reviews exist.

The PO decides the draft scope on a non-technical page. Engineers read
`requirements.md`. `requirements.json` is the single source both are built
from, and the one the estimate and proposal skills read. Workflow scope mode only; classic
mode is unchanged.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| R1 | The page opens as a claude.ai artifact in the chat the skill ran in. In Claude Code (no artifact): the agent gives the file path to open in a browser; the page is self-contained and works from `file://`. | User choice; the PO is already in that chat. |
| R2 | Decisions return by a **Copy decisions** button; the PO pastes into chat. Clipboard failure → the text is shown pre-selected for Ctrl+C. | No documented way for an artifact to post into its own chat (checked 2026-10-07: only `window.claude.complete` and per-artifact storage the chat cannot read). |
| R3 | **Hard rule: the page is for non-technical readers.** Business words only: no IDs, no FR text, no priorities, labels or scores. Workflows are drawn (step chips, arrows, side paths, sub-flows), never mermaid source. | The PO is the reader. |
| R4 | Per draft item: **Yes, include** · **No, leave out** · **Add a note**. | User choice. |
| R5 | **Questions for you**: open questions *not* paired with a card, an answer box each. A question paired with a card is answered by the card. | One answer per fact. |
| R6 | The page appears once, at the end of the interview. After apply, the agent hints one phrase, **"review decisions"**, which reopens the editable page with earlier answers pre-filled, any time, including later sessions. | User dropped a second phrase as confusing. |
| R7 | Unanswered items stay open for the client, never guessed. Copy is never blocked. The bottom bar shows only "X of Y answered". | User choice. |
| R8 | Copied text = one plain sentence + a fenced JSON block with real IDs (§3). The on-page preview of the copied text is collapsed by default. | Agent-friendly, human-skimmable. |
| R9 | Built by script, not by the agent: one fixed template shared by Node and Python, plus a `review` script that extracts page data from `requirements.json` and injects it. | Never drifts from the JSON; parity-tested like `scope`. |
| R10 | Order: `requirements.json` → validate (JSON only) → fresh-eyes review → page → paste → apply → **then** `requirements.md`. There is no "before review" md. Re-written after every "review decisions". | User correction. |
| R11 | `requirements.md` is the engineer view: spec 1 structure kept; IDs back in To-be scope; no ⚠ marks or "please confirm" banners anywhere; Start-here line removed. | Reverses D8; ⚠ was a PO device and the PO now has the page. |
| R12 | A "No" **moves** the item out of `systems` / `workflows` / `features` into a new top-level `leftOut` list, with the PO's note and date. Its FRs go to scope `out`; its name goes to `scope.out`. A later "Yes" moves it back. | BA output is the input of every later skill; one rule ("the lists hold what we build") beats teaching each reader to filter. Estimate and proposal need no change. |

## 1. Files

```
skills/business-analyst/
  assets/review-page.html        NEW  fixed template (from the mockup), two slots
  assets/review-decisions.js     NEW  pure copy-decisions logic, inlined into the page, loaded by tests
  scripts/review.mjs             NEW  `page` | `apply` subcommands
  scripts/review.py              NEW  Python twin, byte-identical output
  scripts/lib/left-out.mjs       NEW  move an item to leftOut and back
  scripts/lib/review-data.mjs    NEW  requirements.json → page data
  scripts/lib/review-page.mjs    NEW  fills the template's two slots
  scripts/lib/review-apply.mjs   NEW  decisions → new requirements.json + notes
  scripts/lib/review-checks.mjs  NEW  `review` and `leftOut` rules (§5)
  scripts/left_out.py, review_data.py, review_apply.py, review_checks.py   NEW  twins
  scripts/lib/scope-render.mjs, scope_render.py   IDs back, no ⚠ (§4)
  scripts/lib/scope-md.mjs                        no Start-here line; Requirements column; left-out table
  scripts/lib/checks.mjs, scope-rules.mjs + twins  leftOut ids count as known ids
  scripts/validate.mjs, validate.py               `--md` optional (JSON-only run)
  scripts/test/review-fixture.mjs   NEW  reviewed state built in code from the pass fixture (no second JSON to drift)
  SKILL.md, references/interview.md §8, references/writing.md, references/review.md
plugins/business-analyst/.claude-plugin/plugin.json, marketplace.json   0.4.0
```

Names under `scripts/lib/` are indicative; the plan fixes them. All new Node
modules meet the size gates (≤ 200 lines, ≤ 10 functions, ≤ 22 lines per
function, ≤ 3 params); the template script meets ≤ 22 lines per function.

## 2. The page

### Commands

```
node scripts/review.mjs page  --json requirements.json --out review.html
node scripts/review.mjs apply --json requirements.json --decisions decisions.json [--confirm SYS-001,…]
python3 scripts/review.py page|apply …   (same flags, same output bytes)
```

- `page` in classic mode: prints `classic mode: no review page`, writes
  nothing, exit 0.
- `page` refuses (exit 1) when the scope checks fail, as `scope` does.
- The page is the template with two slots filled: the page data (JSON,
  `<` escaped as `<` so no `</script>` can close the tag) and
  `review-decisions.js`. Node and Python serialize the data the same way:
  insertion order, no spaces, non-ASCII kept as is.

### Page data (what the script extracts)

| Page part | From `requirements.json` |
| --- | --- |
| Header | `lead` humanised (`sin-kowa-mini` → "Sin Kowa Mini") |
| Block per system | `name`, `purpose` |
| "How it works" | the system's to-be workflows: `steps`, `branches` (side path or loop back), `sub` (starts at, rejoins, share). Draft workflows and draft steps' features are drawn orange. |
| Cards (decide) | in an open "Needs your decision (n)" section per system: to-be workflows, systems and features with `label ≠ confirmed`, items that already have a `review` field (earlier "yes"), and `leftOut` entries (earlier "no", drawn in their old place). Card text: name + `does`/`purpose`; the "why" line = the paired open question's `reason`. Systems, features and workflows an input document lists are written `confirmed` (the PO made that list for the estimate), so cards are only what the BA drafted itself. |
| "Features already decided (n)" | confirmed features without `review`, per system in a section collapsed by default: name + `does`, and under it `Decided in: <source>` (`not recorded` when the feature has no `source`). |
| Questions for you | open questions (status `open`, or answered with a `review` field) whose `affects` names no card. Shows `question` only. |
| Pre-fill | `review` on kept items and questions ("yes" / answer text); `leftOut` entries ("no" + note). |

Every shown string comes from `name`, `purpose`, `does`, step names,
`reason`, `question` or a decided feature's `source`. IDs travel in the data only as keys for the copied
JSON; nothing renders them. The test in §7 enforces this.

A question paired with a card (its `affects` lists the card's id) is not
shown in "Questions for you"; the card's answer answers it (§3, apply).

### Interaction

- Each card: three choices; "Add a note" opens a one-line note box (a note
  can accompany Yes or No).
- Bottom bar: "X of Y answered" and **Copy decisions**. Y counts cards +
  questions. Copy works at any X, including 0.
- The preview of the copied text sits under the bar, collapsed.
- Clipboard API fails → the preview opens with the text selected and a line
  "Press Ctrl+C (⌘C) to copy".

## 3. Copied decisions and `apply`

### The copied text

~~~
Here are my review decisions — please apply them.

```json
{ "reviewDecisions": 1, "lead": "sin-kowa-mini", "date": "2026-10-07",
  "decisions": [
    { "id": "WF-003", "name": "Order to cash", "answer": "yes" },
    { "id": "FEAT-004", "name": "Invoice from packed quantities", "answer": "no",
      "note": "we invoice from the signed DO" },
    { "id": "Q-003", "question": "…", "answer": "Up to 5 users" } ],
  "skipped": ["SYS-002"] }
```
~~~

`name`/`question` are for the human reading the chat; `apply` keys on `id`.
`review-decisions.js` builds this from the page state and is the only code
that does; the round-trip test feeds its output straight to `apply`.

### `apply`

Checks first, writes nothing on failure (exit 1, one line per problem):
`reviewDecisions` ≠ 1; `lead` ≠ the JSON's lead; an id that is not a card or
a shown question; a card answer other than yes|no; any decision on an item
whose system stays left out (the page greys those cards out and leaves them
out of the copied block); text that is not valid JSON (chat curly quotes).

Then, per decision (`date` = the copied `date`):

| Answer | Effect |
| --- | --- |
| item **yes** | `label: confirmed`, `source: "confirmed by PO in review, <date>"`, `review: { answer: "yes", note?, date }`; paired open questions → `status: answered`, `answer: "confirmed in review"`. If the item is in `leftOut` (an earlier "no"), it is first moved back (below). |
| item **no** | the item moves to `leftOut` (below); paired open questions → `answered`, `"left out in review: <note or 'no note'>"`. |
| system **no**, holding decided features | **held back**: not applied (system and features stay, paired questions untouched), counted as still open; apply prints the held-back lines (below) and exits 0. Applied as an item **no** only when the system id is in `--confirm`. |
| question | `status: answered`, `answer: <text>`, `review: { answer: <text>, date }`. |
| re-review | answers overwrite earlier ones. |
| skipped | untouched (an earlier answer stays). Clearing an answer on the page does not undo it; the agent handles "undo" requests in chat. |

**Moving out ("no").** One `leftOut` entry per moved item:

```jsonc
"leftOut": [
  { "id": "FEAT-004", "kind": "feature", "system": "SYS-002", "at": 1, "index": 3,
    "date": "2026-10-07", "frsOut": ["FR-004"], "note": "we invoice from the signed DO",
    "outAdded": true, "item": { /* the feature object, unchanged */ } }
]
```

- `kind` is `system` | `workflow` | `feature`; `system` is the owner it was
  listed in; `at` its index in that owner's list and `index` its index in
  the top-level array, so it returns to the same place; `outAdded` says
  whether apply added the name to `scope.out` (only then is it removed on
  the way back).
- A system takes its features and workflows with it: they get their own
  entries with `"via": "SYS-002"`, no note of their own.
- `frsOut`: the moved features' FRs that were scope `in`, now `out`.
- `scope.out` gains the decided item's name (once, not one per child).

**Moving back ("yes" on a left-out item).** The reverse, exactly: the item
(and its `via` children) return to their lists at `at`, `frsOut` FRs return
to `in`, the name leaves `scope.out`, the entries leave `leftOut`.

`apply` rewrites `requirements.json` (2-space JSON, same key order, trailing
newline) and prints, for the agent:

- each note: `FEAT-004 note: "we invoice from the signed DO"`;
- each answered question: `Q-003 answered: "Up to 5 users" — update what depends on it`;
- each held-back system, then one line per decided feature (label
  `confirmed`) in the system's feature order:
  `SYS-001 not left out: it holds decided features; ask the PO first`
  `  FEAT-001 "Order pipeline & stage engine" (decided in: <source, or "no source recorded">)`;
- `N decided, M still open`.

`--confirm <ID>[,<ID>…]` lists systems the PO confirmed leaving out after
the agent asked (§6): they are applied as a normal "no". An id that is not
a held-back system "no" in this block is refused before anything is
written (exit 1): `--confirm SYS-009: not a held-back system in these decisions`.

The agent applies notes and answers by judgment (edit requirements,
rules, readiness), says in chat what it changed, then runs validate, writes
`requirements.md` and runs `scope` (§4).

A "No" on a to-be workflow whose steps a kept feature still uses (or a
sub-workflow starts from or rejoins) is not fixed by `apply`: validate flags
it (§5) and the agent asks the user one
question in chat (drop the feature, or move it to other steps). Moving it
needs no further question. If any of those features is decided (label
`confirmed`), dropping it goes through the decided-items question (§6):
one bullet per decided feature with "decided in", options "No, keep them
(Recommended)", "Yes, remove".

## 4. `requirements.md` (engineer view)

Spec 1 structure stays: To-be scope section between markers, systems table,
per system the mermaid and a feature table, Feature column in the FR table.
Changes:

- **IDs back**: `### SYS-001 Warehouse operations`, `**Main workflow: WF-002
  Order pipeline**`, and an ID column first in the systems and feature
  tables.
- **No ⚠, no banners**: the ⚠ line, the ⚠ after names and the Start-here
  line are gone. A draft still open reads plainly; it is in the open
  questions list (Part 5) as today.
- **Requirements column** in each feature table: the feature's FR ids,
  comma-separated.
- **Left out in review** table after the systems, only when `leftOut` is
  non-empty: `| ID | Item | PO note | Date |`, one row per entry; a `via`
  child's note reads `with SYS-002`.
- One line under the To-be scope heading when any item has `review`:
  `Reviewed by PO on <latest date>: N decided, M still open for the client.`
- Left-out items appear only in that table. Their FRs stay in the FR table
  with scope `out`, Feature column `—`; the item name is in the out-of-scope
  list (from `scope.out`).

The `scope` script writes all of this; `checkScopeMd` compares against it
as today. Classic mode: md exactly as today.

## 5. Validation (Node and Python, identical findings)

`validate --json` without `--md` runs every JSON check and skips md checks.

| Rule | Finding |
| --- | --- |
| `review.answer` is `yes` on systems, to-be workflows, features | `FEAT-003: review answer must be yes` |
| `review.answer` is a non-empty string on questions | `Q-003: review answer is empty` |
| `review.date` / `leftOut[].date` is `YYYY-MM-DD` | `FEAT-004: review date missing` |
| `leftOut[]`: `kind` legal, `item.id` = `id`, `system` exists in `systems` or `leftOut`, `via` names a left-out system | `FEAT-004: leftOut owner SYS-009 unknown` |
| an id is in `leftOut` and in a live list | `duplicate id: FEAT-004` (existing message) |
| `frsOut` FRs exist and are not scope `in` | `FR-004: in scope but its feature was left out` |
| a kept feature points at a step of a left-out workflow; a kept sub-workflow starts from or rejoins one | `FEAT-001: uses left-out workflow WF-003` |

The md compare (`To-be scope is stale`) runs only when the scope and review
checks are clean, since a broken record cannot be rendered.

`leftOut` ids count as known ids, so an open question whose `affects` names
one is not a dangling reference. Every spec 1 scope check runs on the live
lists only, unchanged. The md check "id absent from requirements.md" now holds
for to-be workflow, system and feature ids too (D8 reversed); the spec 1
"To-be scope contains no ids" rule is removed.

## 6. Flow and docs

**SKILL.md** steps 7–10 (workflow mode; classic unchanged):

```
7  Write      requirements.json (writing.md)
8  Validate   validate --json → clean
9  Fresh eyes review.md over requirements.json; re-validate
10 Review     review page → show it (R1); wait for the paste;
              save it, review apply, act on the printed notes, say what changed
11 Finish     requirements.md (writing.md) → scope → validate --json --md;
              show Part 5; hint: say "review decisions" to change answers later
```

If the user says skip/later at step 10: go to 11; every draft stays open.
**Trigger**: "review decisions" (any session, `requirements.json` exists,
workflow mode) → `review page` → steps 10–11.

**Decided items** (label `confirmed`) never leave scope without the PO's
explicit yes. Before one does — a held-back line from `apply`, or the PO
asking in chat to drop it — the agent asks ONE question with the host's
question tool: `Leaving out "<system>" also removes <n> features already
decided:` + one bullet per feature `(decided in: <source>)` + `They will drop
out of the estimate. Remove all of them?`; options in order
"No, keep them (Recommended)", "Yes, remove". Only "Yes, remove" removes
(re-run apply with `--confirm <SYS-ID>`; a chat request is edited as usual);
anything else keeps them. One decided feature dropped in chat: same
question, one bullet. No question tool → the same two options in chat.

**interview.md §8** rewritten as step 10 above (page, paste, apply, never
answer on the user's behalf). **writing.md**: To-be scope bullet (IDs, no ⚠,
Requirements column, left-out table); md is written after review in workflow
mode. **review.md**: the checklist reads `requirements.json` in workflow mode
(items 5–6 name JSON registers instead of md Parts).

**Other skills: no change.** The estimate reads `features`, which no longer
holds a declined item, so it is never scored or priced; its score review and
spec 3 pages never see it. Spec 3 already lists BA `scope.out` under
Exclusions, so the declined item shows there. An estimate made *before* a
"No" stops on re-run with `feature FEAT-004: not in requirements.json`,
which is accurate; the agent removes the stale scores and links. Older
estimate versions ignore the unknown `leftOut` key.

## 7. Testing (RED first)

- **Page data**: shown strings of the fixture contain no `SYS-`/`WF-`/`FEAT-`/
  `FR-`/`Q-` token and no `TECH_WORDS`; card set = drafts + reviewed; a
  question paired with a card is not in Questions; pre-fill from `review`;
  classic → exit 0, no file.
- **Page HTML**: data slot cannot be closed by `</script>` in a name.
- **review-decisions.js**: from a page state → expected copied JSON; zero
  answers → all skipped; notes kept.
- **apply**: each row of the §3 table; "no" on a feature, a workflow and a
  system (children move with `via`); "yes" after "no" puts every list, FR scope and
  `scope.out` back exactly as before the "no" (only label, source, `review`
  and the paired question differ);
  wrong lead / unknown id / bad answer → exit 1, file bytes unchanged; notes
  and counts printed; validate passes on the result.
- **Round trip**: fixture → page data → `review-decisions.js` with scripted
  answers → `apply` → validate → `scope` → md checks pass.
- **scope / validate**: IDs present, no ⚠, Requirements column, left-out
  table, reviewed line; each §5 finding; JSON-only validate.
- **Python parity**: byte-identical `review.html`, identical `apply` output
  JSON and stdout, identical findings.
- **Estimate**: no change; its suite runs in `npm test` as before.
- **Evals** (plugin-level, `plugins/business-analyst/evals/`): (1) a
  pre-staged workflow lead at the review step → the agent offers the review
  page, not tick-box questions; (2) "review decisions" on a reviewed lead →
  the agent goes to the review page. The eval sandbox has no Bash, so graders
  check the agent's intent (names the `review page` command / does not ask
  draft tick boxes), not the file.
- **Plan task 1 (manual)**: how claude.ai shows a script-made `.html` in the
  chat (rendered artifact vs download). Fallback: the agent creates the
  artifact from the file's content. The result decides the R1 wording in
  SKILL.md.

## 8. Out of scope

- Classic mode: no page, no change.
- A page that writes back by itself (R2).
- Undo of an answer from the page (handled in chat).
- Any change to estimate or proposal (R12).
- The 8 deferred spec 1 review minors.
