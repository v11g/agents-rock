# Linked, Saved Output Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every item in a reasoning result an id, link evidence and assumptions to the claims they back, and save every run to `~/.reasoning/problems/`.

**Architecture:** One shared file changes — `references/contract.md`, byte-identical in all four skills — plus one sentence in the shared `references/interview.md` (three skills), one Inputs line in the three receiving skills, a README line in each skill, and the version bump. No code. Four new eval cases go RED first, then GREEN.

**Tech Stack:** Markdown skill prose; `claude plugin eval` (prompt.md + graders/*.md).

**Spec:** `docs/superpowers/specs/2026-09-29-reasoning-linked-format-design.md`

All paths are relative to the worktree root
`.claude/worktrees/reasoning-board/`. Run every command from there.
`P=plugins/reasoning` in the commands below.

## Global Constraints

- Version `0.4.0` → `0.5.0` in `plugins/reasoning/.claude-plugin/plugin.json` and in the `reasoning` entry of `.claude-plugin/marketplace.json`.
- Every `references/contract.md` copy is byte-identical (4 skills); every `references/interview.md` copy is byte-identical (3 skills). `cmp` exits 0.
- The six core field names never change; one framework block per run.
- Id prefixes: `e` evidence, `a` assumptions, `q` open questions, `c` framework-block items. Unique per file, kept across rewrites.
- Save path: `~/.reasoning/problems/<YYYY-MM-DD>-<slug>/<NN>-<skill>.md`.
- A refused or failed write never blocks the run: say "not saved: <reason>" once, no retry.
- No second JSON file.
- Gate: each new case ≥ 0.85 at `--runs 3`; every existing case ≥ its Task 1 baseline or ≥ 0.85.
- Every eval run: `--ablation none --no-publish --trust-plugin`. `--case` takes one glob; run cases separately. Full-suite runs go in the background (~60–70 min).
- Commits: Conventional Commits, no AI attribution trailers. Never push — a version bump on `main` publishes to npm.

## Review Focus

Conditions the spec implies that no eval exercises:

1. A successful write (evals cannot write outside the project) → the file appears at the right path with front-matter that parses. Task 4 Step 3's manual script pins it.
2. An interview answer → the same file is rewritten and every earlier id keeps its value. Task 4 Step 3's manual script pins it.
3. A hand-off into `systems-thinking` → it writes `02-systems-thinking.md` into the router's folder, not a new folder. Task 4 Step 3's manual script pins it.
4. Two problems on the same day with the same slug → the second folder gets `-2`. Task 3 Step 6 pins the rule text with a grep.
5. An object-shaped block item (`{step, owner_role, when, signal}`) → gains `id`, keeps its fields. Task 3 Step 6 pins the rule text with a grep; `sd-default-selection` in the Task 4 full suite exercises it.

---

### Task 1: Baseline

**Files:** none.

**Interfaces:**
- Produces: `/tmp/claude-1000/lf/baseline.json` — per-case scores every later gate compares against.

- [ ] **Step 1: Full suite in the background**

Run with `run_in_background`:
```bash
mkdir -p /tmp/claude-1000/lf
claude plugin eval plugins/reasoning --runs 3 --ablation none --no-publish --trust-plugin \
  --json /tmp/claude-1000/lf/baseline.json > /tmp/claude-1000/lf/baseline.log 2>&1
```
Wait for the completion notification; don't poll.

- [ ] **Step 2: Record per-case scores**

```bash
jq -r '.cases[] | "\(.name)\t\(.aggregates.score)"' /tmp/claude-1000/lf/baseline.json | sort
```
Expected: 26 rows. Copy them into the ledger as `Baseline: <case> <score>`.

---

### Task 2: Four new cases, RED

**Files:**
- Create: `plugins/reasoning/evals/format-ids-and-supports/prompt.md`, `graders/skill-fired.md`, `graders/ids-in-chat.md`, `graders/supports-resolve.md`
- Create: `plugins/reasoning/evals/format-root-candidate-status/prompt.md`, `graders/skill-fired.md`, `graders/candidate-status.md`
- Create: `plugins/reasoning/evals/format-unsaved-continues/prompt.md`, `graders/skill-fired.md`, `graders/not-saved-stated.md`, `graders/analysis-completes.md`
- Create: `plugins/reasoning/evals/format-handoff-folder/prompt.md`, `graders/skill-fired.md`, `graders/folder-named.md`

**Interfaces:**
- Produces: four case directories Task 3 must turn GREEN.

- [ ] **Step 1: `format-ids-and-supports`**

`prompt.md`:
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the problem-solving skill with five_whys on this: deploys fail
intermittently since Monday's runner image update. The ci-run-4471 log
shows "pull access denied for base-image".
```

`graders/skill-fired.md`:
```markdown
---
type: tool_used
tool: Skill
min: 1
---

The problem-solving skill must actually be invoked, not merely described.
```

`graders/ids-in-chat.md`:
```markdown
---
type: regex
pattern: '\[e1\]'
match: contains
target: last_message
---

Evidence ids render as small tags in chat.
```

`graders/supports-resolve.md`:
```markdown
---
type: llm
weight: 1
---

PASS if every `evidence` entry shows an id (`e1`, `e2`, …) and a
`supports` list, and every id in those lists names a `c`-prefixed item
that appears in the `five_whys` block.
FAIL if any evidence entry has no id, has no `supports` list, or lists an
id that no framework item carries.
```

- [ ] **Step 2: `format-root-candidate-status`**

`prompt.md`:
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the problem-solving skill with rca on this: the checkout page times
out for some users since Tuesday. No logs are available yet.
```

`graders/skill-fired.md`: same content as Step 1's `skill-fired.md`.

`graders/candidate-status.md`:
```markdown
---
type: llm
weight: 1
---

The input gives no evidence for any cause.

PASS if the deepest cause in the `rca` block has a `c`-prefixed id and
carries `status: root_candidate` (or renders the status `root_candidate`
next to it).
FAIL if any cause carries `status: root`, or if the cause has no id.
```

- [ ] **Step 3: `format-unsaved-continues`**

`prompt.md` (no `Write` in `allowed_tools`, so the save is refused):
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the systems-thinking skill with iceberg on this: our on-call
engineers have quit at a rate of two per quarter for the last year, and
each exit interview names night pages.
```

`graders/skill-fired.md`: same content as Step 1's `skill-fired.md`.

`graders/not-saved-stated.md`:
```markdown
---
type: regex
pattern: 'not saved'
flags: i
match: contains
target: last_message
---

The refused write is reported.
```

`graders/analysis-completes.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response contains the six core fields and one `iceberg`
block, and says the file was not saved exactly once.
FAIL if the analysis stops or is cut short because of the save, if the
save is retried, or if "not saved" is repeated.
```

- [ ] **Step 4: `format-handoff-folder`**

`prompt.md`:
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the problem-router skill on this: every quarter the same onboarding
delays come back. We fix the handoff between sales and provisioning, it
holds for a few weeks, then a different team hits the same wall. Three
fixes in two years.
```

`graders/skill-fired.md`: same content as Step 1's `skill-fired.md`.

`graders/folder-named.md`:
```markdown
---
type: regex
pattern: '\.reasoning/problems/\d{4}-\d{2}-\d{2}-[a-z0-9-]+'
match: contains
target: last_message
---

The router's hand-off names the problem folder the next skill writes into.
```

- [ ] **Step 5: Run each case, confirm RED**

```bash
for c in format-ids-and-supports format-root-candidate-status format-unsaved-continues format-handoff-folder; do
  claude plugin eval plugins/reasoning --case "$c" --runs 3 --ablation none --no-publish --trust-plugin \
    --json /tmp/claude-1000/lf/red-$c.json > /tmp/claude-1000/lf/red-$c.log 2>&1
  jq -r --arg c "$c" '.cases[] | "\($c)\t\(.aggregates.score)"' /tmp/claude-1000/lf/red-$c.json
done
```
Expected: every score < 0.85. The failing graders are `ids-in-chat`,
`supports-resolve`, `candidate-status`, `not-saved-stated`,
`folder-named`. A case already ≥ 0.85 is a finding about the case: fix the
grader before Task 3.

- [ ] **Step 6: Commit**

```bash
git add plugins/reasoning/evals/format-*
git commit -m "test(reasoning): add failing linked-format cases"
```

---

### Task 3: Contract, interview, inputs, version — GREEN

**Files:**
- Modify: `plugins/reasoning/skills/problem-router/references/contract.md` (full replacement below), then copy to the other three skills' `references/contract.md`
- Modify: `plugins/reasoning/skills/systemic-design/references/interview.md:51`, then copy to `problem-solving` and `systems-thinking`
- Modify: `plugins/reasoning/skills/{problem-solving,systems-thinking,systemic-design}/SKILL.md` — Inputs list
- Modify: `plugins/reasoning/skills/*/README.md` — one line each
- Modify: `plugins/reasoning/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: Task 2's four cases.
- Produces: the contract spec 5's board reads — ids, `supports`, `blocks`, `status`, and the save path.

- [ ] **Step 1: Replace `contract.md`**

Write this as the full content of `plugins/reasoning/skills/problem-router/references/contract.md`:

````markdown
# Output contract

Every run emits six core fields, plus exactly one block named for the
framework that ran. Nothing else appears at the top level.

## Core fields

| Field | Contents |
| ----- | -------- |
| `problem` | The problem as this skill understands it, restated in one or two sentences. |
| `framework_used` | The framework that ran. A `problem-router` run runs none — emit `router` there, naming the routing pass itself. |
| `framework_reason` | One line: why this framework, for this problem. |
| `evidence` | What the input actually supplied. Each entry names its type. |
| `assumptions` | Anything the input did not state. Each carries a status. |
| `open_questions` | What would change the analysis if answered. |

An empty `evidence` list is a finding, not an omission: it means nothing
in the input supports the analysis, and the output says so.

## Ids and links

Every entry carries an `id`, unique within the run:

| Entry | Prefix |
| ----- | ------ |
| `evidence` | `e` — `e1`, `e2`, … |
| `assumptions` | `a` |
| `open_questions` | `q` |
| any item inside the framework block | `c` |

Number in order of first appearance. An entry keeps its id when the
result is re-run after an interview answer; a new entry takes the next
free number. Never reuse an id within a run.

Framework block items follow one rule, for every block:

- An item that is a string becomes `{id, text}`.
- An item that is an object (`{step, owner_role, when, signal}`,
  `{from, to, assumption}`, …) gains `id` and keeps its fields.
- A field that refers to another item (`links.from`, `links.to`, the
  entry an intervention targets, the element a leverage point sits on)
  holds that item's id, not its text.
- A cause labelled `root` or `root_candidate` carries the label as
  `status`.

Links:

- `evidence` and `assumptions` entries carry `supports: [ids]` — the `c`
  items they back. An empty list is a finding: the entry backs nothing.
- `open_questions` entries carry `blocks: [ids]` — the `c` items the
  question holds back.

"Name the `evidence` entry that ties this cause to the symptom" is
answered by an id in that entry's `supports`.

## Framework blocks

| Block | Fields |
| ----- | ------ |
| `router` | `problem_class`, `reasoning_skill`, `recommended_framework`, `confidence`, `why`, `frameworks_rejected` |
| `double_diamond` | `discover`, `define`, `develop`, `deliver` |
| `rca` | `symptom`, `immediate`, `contributing`, `underlying`, `root`, `actions` |
| `five_whys` | `why_chain`, `root_candidate`, `uncertainties` |
| `a3` | `background`, `current`, `problem`, `target`, `causes`, `countermeasures`, `plan`, `follow_up` |
| `pdca` | `hypothesis`, `test`, `metric`, `expected`, `actual`, `next` |
| `iceberg` | `event`, `patterns`, `structures`, `mental_models` |
| `system_map` | `system_boundary`, `actors`, `components`, `relationships`, `dependencies`, `external_factors` |
| `causal_loop` | `variables`, `links`, `loops`, `delays` |
| `leverage_points` | `elements`, `points` |
| `systemic_design` | `explore`, `reframe`, `create`, `catalyse` |
| `theory_of_change` | `inputs`, `activities`, `outputs`, `short_term_outcomes`, `long_term_outcomes`, `impact`, `links` |
| `three_horizons` | `h1`, `h2`, `h3` |

Later skills add blocks. The core never changes — that is what lets one
skill consume another's result without knowing which framework produced
it.

## Evidence types

`user-provided fact`, `document`, `log`, `metric`, `interview`,
`observation`, `external source`, `inferred`.

Anything `inferred` is never rendered as fact. If the input did not state
it, it belongs in `assumptions`, not `evidence`.

## Assumption status

`unverified` — nothing has confirmed it.
`confirmed` — the human confirmed it during this run.

Default is `unverified`. An assumption is never silently promoted.

## Confidence

`low` / `medium` / `high`. Numeric confidence is never emitted: `0.84`
implies a precision this reasoning does not have.

Confidence reflects evidence quantity, evidence quality, contradictions
in the input, and how many inferential steps separate the claim from the
evidence.

## Rendering

In chat: markdown headings, one per core field, then the framework block.
Each entry's id renders as a tag after it — `[e1]`, `[c4]` — so the human
can refer to it.

A structure containing a cycle gets a diagram; one without gets prose.
Prose renders a cycle as a list, and a list loses the closure — `A -> B ->
C -> A` read top to bottom does not show that it comes back.

## Saving

Every run is saved to one file:

```
~/.reasoning/problems/<YYYY-MM-DD>-<slug>/<NN>-<skill>.md
```

- `<YYYY-MM-DD>` — today's date, when the problem folder is created.
- `<slug>` — the problem in 2–5 lowercase kebab-case words. If that folder
  already exists for a different problem, append `-2`, `-3`, ….
- `<NN>` — `01`, `02`, …: the next free number in the folder. List the
  folder to find it.
- `<skill>` — `problem-router`, `problem-solving`, `systems-thinking`, or
  `systemic-design`.

| Event | Write |
| ----- | ----- |
| A run starts with no hand-off | create a new problem folder |
| A run starts from a hand-off | use the folder the hand-off names |
| The result is first emitted | write `<NN>-<skill>.md` |
| An interview answer changes the result | rewrite the same file, ids kept |
| The human re-runs a skill on the same problem | the next `<NN>`; the old file stays |

Every hand-off names the problem folder path, so the receiving skill
writes into it. Name it even when this run's write failed; the receiving
skill creates the folder if it is missing.

If a write is refused or fails, continue in chat, say once "not saved:
<reason>", and do not retry within the run.

The file holds the core fields and the framework block as YAML
front-matter above the markdown body chat showed. No second JSON file is
written — it would be a duplicate representation with nothing keeping the
two in agreement.

Example saved file:

```markdown
---
problem: Deploys fail intermittently after the runner image update.
framework_used: five-whys
framework_reason: Narrow scope, causal chain looks linear.
evidence:
  - id: e1
    type: log
    ref: ci-run-4471
    supports: [c1, c2]
assumptions:
  - id: a1
    statement: Staging mirrors production runner config.
    status: unverified
    supports: [c2]
open_questions:
  - id: q1
    text: Who owns the runner image?
    blocks: [c3]
  - id: q2
    text: |
      Which runner pool failed — shared or dedicated?
      Look in: the CI runner dashboard
    blocks: [c2]
five_whys:
  why_chain:
    - id: c1
      text: Deploys fail -> the runner cannot pull the base image
    - id: c2
      text: It cannot pull -> the registry credential expired
  root_candidate:
    id: c3
    text: Credential rotation is manual and undocumented.
    status: root_candidate
  uncertainties:
    - id: c4
      text: Whether rotation was ever automated.
---

# Problem analysis

...
```
````

- [ ] **Step 2: Copy the contract and check identity**

```bash
for s in problem-solving systems-thinking systemic-design; do
  cp $P/skills/problem-router/references/contract.md $P/skills/$s/references/contract.md
  cmp $P/skills/problem-router/references/contract.md $P/skills/$s/references/contract.md && echo "$s ok"
done
```
Expected: three `ok` lines.

- [ ] **Step 3: One sentence in `interview.md`**

In `plugins/reasoning/skills/systemic-design/references/interview.md`, replace
```
A re-run is the same framework over more evidence, not a second framework.
```
with
```
A re-run is the same framework over more evidence, not a second framework.
After each re-run, rewrite the saved file per `references/contract.md`
Saving, keeping every existing id.
```
Then:
```bash
for s in problem-solving systems-thinking; do
  cp $P/skills/systemic-design/references/interview.md $P/skills/$s/references/interview.md
  cmp $P/skills/systemic-design/references/interview.md $P/skills/$s/references/interview.md && echo "$s ok"
done
```
Expected: two `ok` lines.

- [ ] **Step 4: Inputs line in the three receiving skills**

In each of `problem-solving/SKILL.md`, `systems-thinking/SKILL.md`,
`systemic-design/SKILL.md`, add this bullet as the last item of the
`## Inputs` list:
```
- The problem folder a hand-off names, per `references/contract.md`
  Saving. Write this run's file there.
```

In each of the four `README.md` files, add this line directly after the
paragraph under `## Output` (for `problem-router`, whose README has no
`## Output` heading, add the heading and the line at the end):
```
Every run is also saved under `~/.reasoning/problems/`, one folder per
problem and one file per run. If Claude Code isn't allowed to write
there, the run says "not saved" and carries on.
```

- [ ] **Step 5: Version**

In `plugins/reasoning/.claude-plugin/plugin.json` replace `"version": "0.4.0"`
with `"version": "0.5.0"`. In `.claude-plugin/marketplace.json`, in the
`reasoning` entry only, replace `"version": "0.4.0"` with
`"version": "0.5.0"` — a string replace, not a JSON re-dump (a re-dump
reformats the whole file).

- [ ] **Step 6: Text checks**

```bash
grep -c 'append `-2`' $P/skills/problem-router/references/contract.md
grep -c 'gains `id` and keeps its fields' $P/skills/problem-router/references/contract.md
grep -c 'Write this run.s file there' $P/skills/{problem-solving,systems-thinking,systemic-design}/SKILL.md
grep '"version"' $P/.claude-plugin/plugin.json
grep -A3 '"name": "reasoning"' .claude-plugin/marketplace.json | grep version
```
Expected: `1`, `1`, three files each `1`, `"version": "0.5.0"` twice.

- [ ] **Step 7: Run the four cases, confirm GREEN**

Same loop as Task 2 Step 5, writing `green-$c.json`.
Expected: every score ≥ 0.85. A case below: read its failing grader's
`explanation` and `evidence` in the JSON
(`.cases[].arms.with[i].graders[]`) before changing any prose.

- [ ] **Step 8: Commit**

```bash
git add plugins/reasoning .claude-plugin/marketplace.json
git commit -m "feat(reasoning): link evidence to claims, save every run"
```

---

### Task 4: Full gate and manual pass

**Files:** none unless a gate fails.

**Interfaces:**
- Consumes: Task 1 baseline; Task 3 prose.

- [ ] **Step 1: Full suite in the background**

```bash
claude plugin eval plugins/reasoning --runs 3 --ablation none --no-publish --trust-plugin \
  --json /tmp/claude-1000/lf/final.json > /tmp/claude-1000/lf/final.log 2>&1
```
Wait for the completion notification.

- [ ] **Step 2: Compare against baseline**

```bash
join -t $'\t' \
  <(jq -r '.cases[] | "\(.name)\t\(.aggregates.score)"' /tmp/claude-1000/lf/baseline.json | sort) \
  <(jq -r '.cases[] | "\(.name)\t\(.aggregates.score)"' /tmp/claude-1000/lf/final.json | sort) \
  | awk -F'\t' '$3 < $2 && $3 < 0.85 {print "DROP", $0}'
```
Expected: no `DROP` lines, and the four `format-*` cases ≥ 0.85. A drop
gets a single-case re-run before any ruling; a case with a history of
noise (see the spec-3 ledger) is ruled on with that history cited.

- [ ] **Step 3: Manual script (human, new interactive session)**

The human adds `Read(~/.reasoning/**)` and `Edit(~/.reasoning/**)` to
their Claude Code settings, then:

1. `/reasoning:problem-router` on the onboarding-delays prompt from Task 2
   Step 4 → a folder appears under `~/.reasoning/problems/` holding
   `01-problem-router.md`, whose front-matter parses
   (`sed -n '/^---$/,/^---$/p' <file> | head -40`).
2. Confirm the hand-off to `systems-thinking` → `02-systems-thinking.md`
   appears in the same folder.
3. Answer one interview question → `02-systems-thinking.md` is rewritten
   (mtime changes) and ids present before the answer still name the same
   items.
4. Start `/reasoning:problem-solving` on a new problem → a new folder.

Record each step's result in the ledger.
