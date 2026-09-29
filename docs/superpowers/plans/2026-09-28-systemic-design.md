# Systemic Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the fourth reasoning skill, `systemic-design`, and close the 15 findings deferred from spec 2 and the evidence-interview slice.

**Architecture:** A new skill directory mirroring `systems-thinking`: `SKILL.md`, `README.md`, three framework files, and byte-identical copies of `references/contract.md` and `references/interview.md`. The shipped skills change only where they claim `systemic-design` is unbuilt, plus the 15 fixes. Work runs in four phases, each with its own eval run, so a score change has one cause.

**Tech Stack:** Markdown skill prose; `claude plugin eval` (prompt.md + graders/*.md).

**Spec:** `docs/superpowers/specs/2026-09-28-systemic-design-design.md`

All paths are relative to the worktree root
`.claude/worktrees/systemic-design/`. Run every command from there.
`P=plugins/reasoning` in the commands below.

## Global Constraints

- Version `0.3.0` → `0.4.0` in `plugins/reasoning/.claude-plugin/plugin.json`; the `reasoning` entry in `.claude-plugin/marketplace.json` (currently a stale `0.2.0`) → `0.4.0`.
- Every `references/contract.md` copy is byte-identical; every `references/interview.md` copy is byte-identical (`cmp` exits 0).
- Core fields of the contract never change; only Framework blocks rows and the example are added to.
- One framework block per run, in every skill.
- Any `when` the input did not give is also an `assumptions` entry, status `unverified`. Owners not named in the input are roles.
- The software-design failure mode names no specific skill.
- Gate: each new case ≥ 0.85 at `--runs 3`; every existing case ≥ its Task 1 baseline or ≥ 0.85.
- Every eval run: `--no-publish --trust-plugin`. `--case` takes one glob; run cases separately. Full-suite runs go in the background (~60–70 min).
- P1: no acceptance check may rely on git rename detection.
- Commits: Conventional Commits, no AI attribution trailers. Never push — a version bump on `main` publishes to npm.

## Review Focus

Conditions the spec implies that no eval exercises:

1. `problem-solving` or `systems-thinking` asked to run `theory_of_change` / `three_horizons` → hands over to `systemic-design` rather than refusing or improvising. Task 6 Step 5 pins it with a grep for the new hand-over text.
2. A prior `systems-thinking` result handed in → its assumptions keep their status, never promoted. Task 7 Step 3's manual script pins it.
3. Input gives a date for some steps but not others → only the missing ones go to `assumptions`. `sd-default-selection` supplies "end of Q2"; its `dates-traced` grader pins it (Task 4).
4. Human names a person as owner → name kept, not rewritten to a role. `sd-default-selection` names "the discharge lead"; `owners-from-input` pins it (Task 4).
5. Interview inside `systemic-design` meets `simple` → ends and recommends the router. Task 7 Step 3's manual script pins it.

---

### Task 1: Baseline (phase 0)

**Files:** none.

**Interfaces:**
- Produces: `/tmp/claude-1000/sd/baseline.json` — per-case scores every later gate compares against.

- [ ] **Step 1: Full suite in the background**

Run with `run_in_background`:
```bash
mkdir -p /tmp/claude-1000/sd
claude plugin eval plugins/reasoning --runs 3 --no-publish --trust-plugin \
  --json /tmp/claude-1000/sd/baseline.json > /tmp/claude-1000/sd/baseline.log 2>&1
```
Wait for the completion notification; don't poll.

- [ ] **Step 2: Record per-case scores**

```bash
jq -r '.cases[] | "\(.name)\t\(.score)"' /tmp/claude-1000/sd/baseline.json
```
If the JSON shape differs, read it and adapt the filter. Copy the 18
lines into the ledger as `Baseline: <case> <score>`.

Expected: 18 cases; roughly 14 at ≥ 0.85, consistent with the last run
(reds: `routing-thin-input-provisional`, `st-causal-loop-unclosed`,
`routing-complex-adaptive-org-change`, `st-leverage-points-bound`).

---

### Task 2: Grader fixes G1–G5, G7 (phase 1)

G6 and the router grader swap test behaviour that only exists after
Task 5, so they are written in Task 4 as RED cases.

**Files:**
- Modify: `$P/evals/st-causal-loop-unclosed/graders/edges-carry-support-labels.md`
- Modify: `$P/evals/st-selection-boundary/graders/one-block-only.md`
- Create: `$P/evals/routing-*/graders/confidence-single-word.md` (7 cases)
- Modify: `$P/evals/ps-interview-first-question/graders/options-from-input.md`
- Create: `$P/evals/{ps-interview-first-question,st-interview-first-question,ps-interview-five-whys}/graders/no-fixed-exits.md`
- Create: `$P/evals/ps-router-handoff/` (prompt + 3 graders)

- [ ] **Step 1: G1 — write `edges-carry-support-labels.md`**

```markdown
---
type: llm
weight: 1
---

PASS if every causal link carries exactly one support label from
`correlation` / `hypothesized` / `evidenced`, AND the March price rise
followed by April churn is labelled `correlation` or `hypothesized` — the
input gives sequence, not demonstrated causation.

FAIL if any link is unlabelled, if a link carries more than one label, or if
the pricing-churn link is labelled `evidenced`.
```

- [ ] **Step 2: G2 — write `one-block-only.md`**

```markdown
---
type: llm
weight: 1
---

The contract's framework blocks are exactly these names: `router`,
`double_diamond`, `rca`, `five_whys`, `a3`, `pdca`, `iceberg`,
`system_map`, `causal_loop`, `leverage_points`, `systemic_design`,
`theory_of_change`, `three_horizons`.

Count how many of those names appear in the response as a block — a
heading, a YAML key, or a labelled section holding that framework's
fields. Core fields (`problem`, `framework_used`, `framework_reason`,
`evidence`, `assumptions`, `open_questions`) are not blocks. Mentioning a
framework name in prose, such as a rejected candidate, is not a block.

PASS if the count is exactly one.
FAIL if it is two or more, however they are labelled, including one
called preliminary.
```

- [ ] **Step 3: G3 — write `confidence-single-word.md` into each routing case**

```bash
for d in $P/evals/routing-*/; do cat > "$d/graders/confidence-single-word.md" <<'EOF'
---
type: regex
pattern: 'confidence\W{0,4}(low|medium|high)\s*[-/]\s*(low|medium|high)'
flags: i
match: not_contains
target: last_message
---

Confidence is one word — low, medium, or high. A blend like
"medium-high" fails.
EOF
done
ls $P/evals/routing-*/graders/confidence-single-word.md | wc -l
```
Expected: `7`.

- [ ] **Step 4: G4 — write `options-from-input.md`**

```markdown
---
type: llm
weight: 1
---

The input names: 09:15, Monday, the transfer API, 504 Gateway Timeout,
about 85% of requests, requests hanging before they fail.

PASS if the first entry in `open_questions` offers two answer options, and
each option names at least one of those details or a dimension that splits
them (for example "only transfers" vs "all payment types", "failing
requests hang the full timeout" vs "fail fast").
FAIL if there are no options, if either option would read the same for any
outage (for example "check the logs", "yes / no"), or if an option asserts
a cause (for example "a memory leak", "a bad deploy").
```

- [ ] **Step 5: G5 — write `no-fixed-exits.md` into the three interview cases**

```bash
for c in ps-interview-first-question st-interview-first-question ps-interview-five-whys; do
cat > "$P/evals/$c/graders/no-fixed-exits.md" <<'EOF'
---
type: regex
pattern: "Don.t know|Stop, analyze now"
flags: i
match: not_contains
target: last_message
---

Headless, the first open question carries its two options without the
fixed exits.
EOF
done
```

- [ ] **Step 6: G7 — create `ps-router-handoff`**

`$P/evals/ps-router-handoff/prompt.md`:
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the problem-solving skill on this. Router hand-off: class simple,
recommended framework rca, confirmed by the human.

Problem: since this morning's deploy, the invoice PDF export returns a
blank page for every invoice over 50 line items. Smaller invoices render
fine.
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

`graders/runs-rca.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response emits one `rca` block (symptom, immediate,
contributing, underlying, root, actions) and no other framework block.
FAIL if it runs a different framework, or emits more than one block.
```

`graders/no-reselection.md`:
```markdown
---
type: llm
weight: 1
---

The router hand-off already carries a human-confirmed framework.

PASS if the response runs rca without shortlisting frameworks or asking
the human to choose one.
FAIL if it presents a shortlist, recommends a framework as though none
were chosen, or asks which framework to use.
```

- [ ] **Step 7: Run the affected cases**

Run each separately (one glob per call):
```bash
for c in st-causal-loop-unclosed st-selection-boundary '*-interview-*' ps-router-handoff; do
  claude plugin eval plugins/reasoning --case "$c" --runs 3 --no-publish --trust-plugin \
    --json "/tmp/claude-1000/sd/p1-${c//\*/x}.json" > /dev/null 2>&1
done
```
Run with `run_in_background` if the four together exceed 10 minutes.

Expected:
- `st-selection-boundary` ≥ its baseline; `one-block-only` no longer fails a one-block output.
- `st-causal-loop-unclosed`: `edges-carry-support-labels` passes where the only defect was `hypothesized`. The case may stay red until W1.
- The three interview cases: `no-fixed-exits` passes. If `options-from-input` now fails on `ps-interview-first-question`, the grader works as designed; ledger it, and the gate for that case is judged after W4–W6.
- `ps-router-handoff` ≥ 0.85. It is a guard for shipped behaviour, so no RED was expected; ledger that.

The G3 grader is checked by Task 7's full run.

- [ ] **Step 8: Commit**

```bash
git add $P/evals
git commit -m "test(reasoning): fix deferred grader defects"
```

---

### Task 3: Wording fixes W1–W7 (phase 2)

**Files:**
- Modify: `$P/skills/systems-thinking/frameworks/causal-loop.md` (step 6)
- Modify: `$P/evals/st-causal-loop-unclosed/graders/no-invented-delays.md`
- Modify: `$P/skills/systems-thinking/README.md` (framework table)
- Modify: `$P/skills/systems-thinking/frameworks/system-map.md` (steps 3–4, Stop when)
- Modify: `$P/skills/systems-thinking/SKILL.md` (example's "Candidate nodes")
- Modify: both `references/interview.md` copies
- Modify: all three `references/contract.md` copies

- [ ] **Step 1: W1 RED — write `no-invented-delays.md`**

```markdown
---
type: llm
weight: 1
---

A stated lag is a duration ("about six weeks later") or an explicit
"after a delay". A dated sequence — "prices rose in March, churn rose in
April" — is not a stated lag.

PASS if `delays` is empty, absent, or contains only stated lags.
FAIL if `delays` holds an inferred lag (for example "roughly a one-quarter
lag between documentation time and knowledge gaps") or a lag read off the
March→April dates, instead of recording it in `assumptions`.
```

- [ ] **Step 2: Run it — must fail**

```bash
claude plugin eval plugins/reasoning --case st-causal-loop-unclosed --runs 3 \
  --no-publish --trust-plugin --json /tmp/claude-1000/sd/w1-red.json > /dev/null 2>&1
```
Expected: `no-invented-delays` fails in at least one run (the March→April
lag lands in `delays`). If it passes 3/3, ledger "W1 RED not reproduced"
and keep the wording fix as a guard.

- [ ] **Step 3: W1 GREEN — replace step 6 in `causal-loop.md`**

Old:
```
6. Record a `delays` entry only where the input states a lag. An inferred
   delay is an `assumptions` entry, not a `delays` entry.
```
New:
```
6. Record a `delays` entry only where the input states a lag: a duration
   ("about six weeks later") or an explicit "after a delay". A dated
   sequence ("prices rose in March, churn rose in April") is not a stated
   lag. An inferred delay, including one read off dates, is an
   `assumptions` entry, not a `delays` entry.
```

- [ ] **Step 4: W2 — reorder the README table to selection order**

In `$P/skills/systems-thinking/README.md`, replace the table body and the
sentence after it:
```
| Framework | Use it when |
| --- | --- |
| Leverage Points | You need to know where to intervene. |
| Causal Loop | The variables are known and suspected of feeding back on each other. |
| System Map | Two or more actors, and the relationships between them are unclear. |
| Iceberg Model | A symptom keeps returning and the layers under it are unexamined. |

Selection is first-match-wins, top to bottom. The skill shortlists two
and recommends one; you pick.
```

- [ ] **Step 5: W3 — collapse `system-map.md` steps 3–4**

Old steps 3–5:
```
3. Test each seeded node: does the input state a relationship between it
   and another node already in the map, **or** does removing it break a
   `relationship` already recorded? If neither, it is outside the boundary
   and goes in `external_factors` — the input naming something is not the
   same as the input connecting it.
4. Repeat step 3 until no remaining candidate passes.
5. State `system_boundary` explicitly as the set of elements that passed.
```
New steps 3–4:
```
3. Test each seeded node once: does the input state a relationship between
   it and another seeded node, **or** does removing it break a
   `relationship` already recorded? If neither, it is outside the boundary
   and goes in `external_factors` — the input naming something is not the
   same as the input connecting it.
4. State `system_boundary` explicitly as the set of elements that passed.
```
Stop when, old: `No remaining candidate node passes the step 3 test.`
New: `Every seeded node has been tested once under step 3.`

In `$P/skills/systems-thinking/SKILL.md` example, `Candidate nodes like
"the CRM"` → `Seeded nodes like "the CRM"`. Then:
```bash
grep -rn "candidate node" $P/skills/systems-thinking
```
Expected: no output.

- [ ] **Step 6: W4–W6 — edit `interview.md`, then copy**

In `$P/skills/systems-thinking/references/interview.md`:

W4, old cell: `It is \`root\` only if an observation ties X to the symptom.`
New cell: `It supports a cause only if an observation ties X to the symptom.`

W5, old cell: `Keep both, name the contradiction, lower confidence.`
New cell: `Keep both, and name the contradiction in \`open_questions\`.`

W6, add after the `Picked option` row:
```
| Confirms an assumption | that assumption's status becomes `confirmed` | re-run |
```

```bash
cp $P/skills/systems-thinking/references/interview.md $P/skills/problem-solving/references/interview.md
cmp $P/skills/systems-thinking/references/interview.md $P/skills/problem-solving/references/interview.md && echo SAME
```
Expected: `SAME`.

- [ ] **Step 7: W7 — multi-line example in `contract.md`, then copy**

In `$P/skills/systems-thinking/references/contract.md`, old:
```
open_questions:
  - Who owns the runner image?
```
New:
```
open_questions:
  - Who owns the runner image?
  - |
    Which runner pool failed — shared or dedicated?
    Look in: the CI runner dashboard
```
```bash
for s in problem-router problem-solving; do cp $P/skills/systems-thinking/references/contract.md $P/skills/$s/references/contract.md; done
md5sum $P/skills/*/references/contract.md | awk '{print $1}' | sort -u | wc -l
```
Expected: `1`.

- [ ] **Step 8: Run the affected cases**

```bash
for c in st-causal-loop-unclosed st-system-map-boundary '*-interview-*'; do
  claude plugin eval plugins/reasoning --case "$c" --runs 3 --no-publish --trust-plugin \
    --json "/tmp/claude-1000/sd/p2-${c//\*/x}.json" > /dev/null 2>&1
done
```
Expected: `st-causal-loop-unclosed` ≥ 0.85 (was the accepted red); the
others ≥ baseline and ≥ 0.85. W2, W4–W7 have no dedicated test; the
existing cases staying green is their check — ledger that.

- [ ] **Step 9: Commit**

```bash
git add $P/skills $P/evals
git commit -m "fix(reasoning): close deferred wording findings"
```

---

### Task 4: RED — new cases, G6, router swap (phase 3a)

**Files:**
- Create: `$P/evals/sd-theory-of-change/`, `sd-three-horizons/`, `sd-raw-input/`, `sd-not-software/`, `sd-default-selection/`
- Modify: `$P/evals/guardrail-unavailable-framework/prompt.md` and graders
- Delete: `$P/evals/guardrail-unavailable-framework/graders/names-owning-skill.md`
- Delete: `$P/evals/routing-complex-adaptive-org-change/graders/states-systemic-design-unavailable.md`
- Create: `$P/evals/routing-complex-adaptive-org-change/graders/no-unavailability-claim.md`

**Interfaces:**
- Produces: case names `sd-*` and the grader names below; Task 5's skill must satisfy them.

Every `sd-*` case uses this `skill-fired.md`:
```markdown
---
type: tool_used
tool: Skill
min: 1
---

The systemic-design skill must actually be invoked, not merely described.
```

Every `sd-*` prompt starts with this frontmatter:
```
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---
```

- [ ] **Step 1: `sd-theory-of-change`**

prompt body:
```
Use the systemic-design skill on this. We've decided to give each product
team its own on-call rota instead of the central ops team taking every
page. We want fewer repeat incidents. How does that change get us there?
```
`graders/toc-block.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response emits a `theory_of_change` block with all six stages
(inputs, activities, outputs, short-term outcomes, long-term outcomes,
impact) and no other framework block.
FAIL if a stage is missing, or a different or second framework block
appears.
```
`graders/links-carry-assumptions.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the block states an assumption for each of the five transitions
between adjacent stages (inputs→activities, activities→outputs,
outputs→short-term, short-term→long-term, long-term→impact).
FAIL if any transition has no assumption.
```
`graders/no-dates.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the theory-of-change block carries no dates, quarters, months, or
deadlines — it is a causal chain, not a schedule.
FAIL if any stage or link carries a date or deadline.
```

- [ ] **Step 2: `sd-three-horizons`**

prompt body:
```
Use the systemic-design skill on this. Today every release goes through a
weekly change-advisory board that signs off each deploy by hand. We want
teams to ship on their own whenever their automated checks pass. Plan the
move from here to there.
```
`graders/three-horizons-block.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response emits a `three_horizons` block with h1 (today's
system), h2 (transition moves), and h3 (the desired future), and no other
framework block.
FAIL if a horizon is missing, or another or second framework block
appears.
```
`graders/dates-are-assumptions.md`:
```markdown
---
type: llm
weight: 1
---

The input gives no dates.

PASS if every `when` on an h2 move also appears in `assumptions` with
status `unverified` (or the move says the timing is unknown).
FAIL if any `when` carries a date, quarter, or duration that is not also
recorded as an unverified assumption.
```
`graders/owners-are-roles.md`:
```markdown
---
type: llm
weight: 1
---

PASS if every h2 move has an owner written as a role (for example "release
manager", "each team lead"), because the input names no people.
FAIL if an owner is a personal name, or a move has no owner.
```

- [ ] **Step 3: `sd-raw-input`**

prompt body:
```
Use the systemic-design skill on this: our regional sales offices keep
ignoring the new pricing policy, and head office wants it to stick this
time.
```
`graders/model-in-assumptions.md`:
```markdown
---
type: llm
weight: 1
---

The input states no reason the offices ignore the policy and nothing
about how they are measured or rewarded.

PASS if every actor behaviour, incentive, or structure the response relies
on beyond the input's two facts appears in `assumptions` with status
`unverified`.
FAIL if any such explanation is presented as evidence or as fact in the
framework block.
```
`graders/first-question-targets-model.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the first entry in `open_questions` asks for a missing piece of
the system model — why the offices ignore the policy, how they are
measured, who enforces pricing — using this input's details (regional
sales offices, the pricing policy, head office).
FAIL if it asks about something the input answers, is generic enough to
fit any problem, or `open_questions` is absent.
```
`graders/look-in-present.md`:
```markdown
---
type: regex
pattern: 'look in:'
flags: i
match: contains
target: last_message
---

The run is headless and the model is missing, so the first open question
carries its source hint.
```
`graders/no-fixed-exits.md`:
```markdown
---
type: regex
pattern: "Don.t know|Stop, analyze now"
flags: i
match: not_contains
target: last_message
---

Headless, the first open question carries no fixed exits.
```

- [ ] **Step 4: `sd-not-software`**

prompt body:
```
Use the systemic-design skill on this: design the system for 1M concurrent
users — we need to pick between microservices and a modular monolith, and
decide on the database.
```
`graders/no-design-block.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response emits no `systemic_design`, `theory_of_change`, or
`three_horizons` block, and proposes no service split, architecture
style, or database.
FAIL if it runs any of those frameworks on this request or gives a
software architecture recommendation.
```
`graders/says-out-of-scope.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response says this skill plans changes to systems of people
and practice, and that a software design tool fits this request.
FAIL if it does not say the request is out of scope.
```

- [ ] **Step 5: `sd-default-selection`**

prompt body:
```
Use the systemic-design skill on this. Our hospital's discharge process
keeps backing up. Nurses wait on pharmacy sign-off, pharmacy waits on
doctors' final notes, and doctors write notes at the end of their shift.
Every local fix — a pharmacy fast-lane, a discharge coordinator — got
bypassed within a month as staff went back to old habits. The discharge
lead wants this fixed by the end of Q2.
```
`graders/selects-systemic-design.md`:
```markdown
---
type: llm
weight: 1
---

No single intervention is chosen and no future state is described, so the
selection table's first two rows do not hold.

PASS if the response selects `systemic_design` (explore, reframe, create,
catalyse) and emits that block only.
FAIL if it selects `theory_of_change` or `three_horizons` without an
override, or emits more than one block.
```
`graders/interventions-cite-entries.md`:
```markdown
---
type: llm
weight: 1
---

PASS if every intervention in `create` names the actor or structure it
targets, and that target appears in `evidence` or `assumptions` (nurses,
pharmacy sign-off, doctors' end-of-shift notes, the bypassed fixes).
FAIL if any intervention names no target, or a target found nowhere in
evidence or assumptions.
```
`graders/plan-steps-complete.md`:
```markdown
---
type: llm
weight: 1
---

PASS if every step in `catalyse`'s plan has all four: the step, an owner,
a when, and an observable signal that it worked.
FAIL if any step lacks one, or a signal is not observable (for example
"things improve").
```
`graders/dates-traced.md`:
```markdown
---
type: llm
weight: 1
---

The input gives one date: the end of Q2.

PASS if any `when` other than "end of Q2" (or a step bounded by it) also
appears in `assumptions` with status `unverified`.
FAIL if a date the input did not give appears only in the plan.
```
`graders/owners-from-input.md`:
```markdown
---
type: llm
weight: 1
---

PASS if owners are either people the input names ("the discharge lead")
or roles, and no personal name is invented.
FAIL if any owner is an invented personal name.
```

- [ ] **Step 6: G6 — move `guardrail-unavailable-framework`**

`prompt.md`:
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the systemic-design skill on this: our incident count keeps climbing
quarter over quarter. Use the transition design framework.
```
`graders/skill-fired.md`: the `sd-*` version above.

`graders/states-unavailable.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response states that the transition design framework is not
built yet. Accept "not built", "not available", "a later release", or
similar.
FAIL if it is silent on availability or runs transition design.
```
`graders/names-closest-available.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response names a closest available framework from the
systemic-design table (`systemic_design`, `theory_of_change`, or
`three_horizons`) together with a stated difference from transition
design.
FAIL if none is named, or one is named with no stated difference.
```
`graders/no-improvised-levels.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the response does NOT produce a transition-design structure
(for example a future vision, a backcast path of transition steps, and
the shifts in mindset and practice it needs) as if the framework had run.
FAIL if it lays out such a structure under any label.
```
```bash
git rm -q $P/evals/guardrail-unavailable-framework/graders/names-owning-skill.md
```

- [ ] **Step 7: Router grader swap**

```bash
git rm -q $P/evals/routing-complex-adaptive-org-change/graders/states-systemic-design-unavailable.md
```
`graders/no-unavailability-claim.md`:
```markdown
---
type: llm
weight: 1
---

Both `systems-thinking` and `systemic-design` are built.

PASS if the response does not call either skill unavailable, unbuilt, or
coming in a later release.
FAIL if it says either one is not built or not available.
```

- [ ] **Step 8: Run RED (one run each is enough to see failure)**

```bash
for c in 'sd-*' guardrail-unavailable-framework routing-complex-adaptive-org-change; do
  claude plugin eval plugins/reasoning --case "$c" --runs 1 --no-publish --trust-plugin \
    --json "/tmp/claude-1000/sd/red-${c//\*/x}.json" > /dev/null 2>&1
done
```
Expected: every `sd-*` case and `guardrail-unavailable-framework` fail
(`skill-fired` fails — no such skill). `routing-complex-adaptive-org-change`
fails `no-unavailability-claim` (the router still says "not built").

- [ ] **Step 9: Commit**

```bash
git add $P/evals
git commit -m "test(reasoning): add failing systemic-design cases"
```

---

### Task 5: The systemic-design skill (phase 3b)

**Files:**
- Create: `$P/skills/systemic-design/SKILL.md`
- Create: `$P/skills/systemic-design/README.md`
- Create: `$P/skills/systemic-design/frameworks/systemic-design.md`
- Create: `$P/skills/systemic-design/frameworks/theory-of-change.md`
- Create: `$P/skills/systemic-design/frameworks/three-horizons.md`
- Modify: every `references/contract.md` (three new rows), plus a new copy
- Create: `$P/skills/systemic-design/references/interview.md` (copy)

**Interfaces:**
- Consumes: case and grader names from Task 4.
- Produces: block names `systemic_design`, `theory_of_change`, `three_horizons`; framework args `systemic_design`, `theory_of_change`, `three_horizons`.

- [ ] **Step 1: Contract rows, then copy to all four skills**

In `$P/skills/systems-thinking/references/contract.md`, after the
`leverage_points` row add:
```
| `systemic_design` | `explore`, `reframe`, `create`, `catalyse` |
| `theory_of_change` | `inputs`, `activities`, `outputs`, `short_term_outcomes`, `long_term_outcomes`, `impact`, `links` |
| `three_horizons` | `h1`, `h2`, `h3` |
```
```bash
mkdir -p $P/skills/systemic-design/references $P/skills/systemic-design/frameworks
for s in problem-router problem-solving systemic-design; do cp $P/skills/systems-thinking/references/contract.md $P/skills/$s/references/contract.md; done
cp $P/skills/systems-thinking/references/interview.md $P/skills/systemic-design/references/interview.md
md5sum $P/skills/*/references/contract.md | awk '{print $1}' | sort -u | wc -l
```
Expected: `1`.

- [ ] **Step 2: Write `SKILL.md`**

````markdown
---
name: systemic-design
description: Plan how to change a system of people, incentives, and habits so a problem stops regenerating — using explore/reframe/create/catalyse, a theory of change, or three horizons. Use when a fix must survive people adapting to it: org or process transitions, "how do we get from today's way of working to a new one", or turning a systems-thinking map into steps, owners, dates, and success signals. Not for software architecture or technical system design. Recommends a framework and lets you choose; run it with a named framework to skip the choice.
---

# systemic-design

You are executing the systemic-design skill. A problem has arrived whose
fixes get routed around — by people, incentives, or habits — and your job
is to plan the change: select or confirm a framework, run it to its own
stopping test, and emit the result. You do not carry out the plan, draft
its messages, or edit files.

## Purpose

Answer one question: **how should the system be changed?**

Not what broke — that is `problem-solving`. Not why it keeps coming back —
that is `systems-thinking`. This skill takes a model of the system, or
builds a flagged one from raw input, and turns it into changes, an order,
owners, dates, and the signal that says each step worked.

## When to use / When not to use

Use this for org or process transitions, for a change that has to survive
people adapting to it, or to turn a systems-thinking result into a plan.

Don't use this for software architecture — services, databases, scaling.
Don't use it for a bug or a one-off outage; that is `problem-solving`. If
the problem is still "why does this keep happening" and no model exists,
recommend `systems-thinking` first, and run here only if the human says so.

## Inputs

- The problem text, raw or already reframed by `problem-router`.
- Optionally, a framework name as the first argument — `systemic_design`,
  `theory_of_change`, or `three_horizons`.
- Whatever a `problem-router` or `systems-thinking` hand-off carries.
- A prior `systems-thinking` result, read through its six core fields and
  its one block. Its `evidence` stays evidence; its `assumptions` keep
  their status. Nothing is promoted on the way in.

## Entry paths

```
/reasoning:systemic-design "<problem>"                 skill recommends, human picks
/reasoning:systemic-design <framework> "<problem>"     human has already chosen
hand-off after human confirmation                      router or systems-thinking recommended
```

## Framework selection

First match wins. Read top to bottom and stop at the first row that holds.

| Order | Test against the input | Framework |
| --- | --- | --- |
| 1 | The input names one chosen intervention and asks how it reaches an outcome. | `theory_of_change` |
| 2 | The input names a current state and a desired future state. | `three_horizons` |
| 3 | Otherwise — a system that needs changing, no path chosen yet. | `systemic_design` |

"We want product teams, so let's pilot one team" holds for rows 1 and 2;
row 1 wins because an intervention is already chosen.

See `frameworks/theory-of-change.md`, `frameworks/three-horizons.md`, and
`frameworks/systemic-design.md` for the process and stopping test of each.

Shortlist two candidates, name your pick with a one-line reason, and let
the human choose. When the human named a framework, that is the choice and
it runs — skip this section entirely, no confirmation step.

## Process

1. Establish the framing: the problem as stated, as `problem-router`
   reframed it, or as a handed-in `systems-thinking` result models it.
2. Select the framework:
   - Named already (human, or hand-off with confirmation) → that's the
     choice, go to step 3.
   - Not named → apply the first-match table above, shortlist it plus the
     next-best candidate, and recommend the first with a one-line reason.
     Then test, don't infer: is `AskUserQuestion` actually available in
     this session? If yes, ask via `AskUserQuestion` and wait for the
     answer. If no — the tool is unavailable, or the run is otherwise
     non-interactive — you are headless: take your own recommendation,
     record it agent-selected and unconfirmed, and go straight to step 3.
     Naming the shortlist and stopping there, without asking and without
     proceeding, is not a valid outcome on either branch.
3. Open the matching file under `frameworks/` and follow its process
   exactly.
4. Stop at that file's own stopping test. Apply the test — see each file's
   Stop when section.
4b. If the stopping test has not passed, follow
   `references/interview.md`. With a human present it returns you to
   step 3 with new evidence; headless, it shapes the first open question.
   Then continue to step 5.
5. Emit the result per Output contract below.

## Output contract

Emit the six core fields plus exactly one framework block, per
`references/contract.md` — the single source of truth for field names,
evidence types, assumption status, confidence, and rendering.

## Guardrails

Each has a test — apply the test, not a judgment call.

- **Every change traces to the system.** Test: does each intervention,
  move, or activity name the `evidence` or `assumptions` entry it targets?
  No → cut it.
- **No invented system model.** Test: for each actor or structure the plan
  relies on, did the input state it? No → `assumptions`, status
  `unverified`, and it is a candidate gap for the interview.
- **Dates and owners come from the input.** Test: is each `when` and each
  named person in the input? A `when` that is not → also an `assumptions`
  entry, status `unverified`. An owner that is not → written as a role,
  never an invented name.
- **A plan, not the doing.** Test: does the output draft a message, an org
  chart, a file, or run a step? Yes → stop and hand the plan back.
- **One framework per run.** Test: has the first framework's stopping test
  fired, and is there a stated reason a second adds something? Both must
  be yes — and even then the second is a second run, never a second block.
- **Depth scales to the problem.** Test, sentence by sentence: does this
  sentence name a specific fact, quote, figure, or `evidence` entry from
  THIS input? If it would read as true no matter what the input said, cut
  it or replace it with a plain "no evidence for this."

## Failure modes

- **Software-design request** — services, databases, scaling, an
  architecture style. Say this skill plans changes to systems of people
  and practice, and a software design tool fits the request. Run no
  framework.
- **Bounded defect or one-off outage.** Hand to `problem-solving`.
- **"Why does this keep happening", no model.** Recommend
  `systems-thinking` first; run here only if the human says so.
- **Framework named but unavailable** — from PRD §24's later set:
  Transition Design, Service / Ecosystem Design. Say it isn't built yet,
  and name the closest framework from the table above with the difference
  stated. Don't improvise the framework.
- **Framework named that belongs to another skill** — say which skill owns
  it and hand over.
- **Asking without naming the gap.** An interview question must fill a
  specific field the stopping test is blocked on.
- **A source hint that names what to expect.** `Look in:` names where the
  evidence lives, never what the human will find there.

## Examples

**Agent-selected — no path chosen**

Input: "Our hospital's discharge process keeps backing up. Nurses wait on
pharmacy sign-off, pharmacy waits on doctors' notes, doctors write notes at
end of shift. Every local fix got bypassed within a month. The discharge
lead wants this fixed by the end of Q2."

Row 1 doesn't hold — no intervention is chosen. Row 2 doesn't hold — no
future state is described. Row 3: `systemic_design`, shortlisted against
`three_horizons`. Run `frameworks/systemic-design.md`. Why staff return to
old habits is not stated, so it goes in `assumptions` as `unverified`. The
plan's final step can use "end of Q2"; any earlier date is also an
assumption. The discharge lead is named, so that owner stays; other owners
are roles. Emit the six core fields plus one `systemic_design` block.

**Human-named**

Input: `/reasoning:systemic-design theory_of_change "Give each product
team its own on-call rota instead of central ops. We want fewer repeat
incidents."`

`theory_of_change` runs — no shortlist. Six stages, five links, each link
with its assumption, no dates. Emit the six core fields plus one
`theory_of_change` block.
````

- [ ] **Step 3: Write `frameworks/systemic-design.md`**

```markdown
# Systemic Design (explore → reframe → create → catalyse)

## When it fits

A system needs changing and no path has been chosen yet.

## Process

You are executing the Systemic Design framework within the systemic-design
skill. Four phases, in order. Each phase uses only what the earlier phases
and the input established.

1. `explore` — actors, behaviours, structures, tensions, constraints. Each
   entry cites an `evidence` entry or an `assumptions` entry. An actor or
   structure the input did not state goes in `assumptions`, `unverified`.
2. `reframe` — the challenge restated at the level of the system, the
   boundary, the desired change, and the principles any intervention must
   respect.
3. `create` — interventions. Each names the `explore` entry it targets,
   its dependencies, one unintended effect, and a small experiment that
   would test it.
4. `catalyse` — `plan`: a list of `{step, owner_role, when, signal}`, plus
   the feedback mechanism and success measures. `owner_role` is a person
   only if the input names one. A `when` the input did not give also goes
   in `assumptions`, `unverified`. A `signal` is something someone can
   observe.

## Output block

Emit the `systemic_design` block from `references/contract.md`: `explore`,
`reframe`, `create`, `catalyse`. The plan is a sequence, not a cycle, so it
renders as a list.

## Stop when

Every intervention targets a named `explore` entry, every plan step has all
four fields, and every `signal` is observable.
```

- [ ] **Step 4: Write `frameworks/theory-of-change.md`**

```markdown
# Theory of Change

## When it fits

One intervention is already chosen, and the question is how it reaches an
outcome.

## Process

You are executing the Theory of Change framework within the systemic-design
skill. Six stages in a chain:

inputs → activities → outputs → short-term outcomes → long-term outcomes →
impact

1. Fill each stage from the input. A stage the input does not support says
   what evidence would fill it.
2. For each of the five adjacent pairs, record a `links` entry:
   `{from, to, assumption}` — what has to be true for the earlier stage to
   produce the later one. Every link carries one.
3. Each assumption also appears in the core `assumptions` field, status
   `unverified` unless the human confirmed it.
4. No dates. This is a causal chain, not a schedule.

## Output block

Emit the `theory_of_change` block from `references/contract.md`: `inputs`,
`activities`, `outputs`, `short_term_outcomes`, `long_term_outcomes`,
`impact`, `links`. A chain is not a cycle; it renders as a list.

## Stop when

All six stages have content or a stated evidence gap, and all five links
carry an assumption.
```

- [ ] **Step 5: Write `frameworks/three-horizons.md`**

```markdown
# Three Horizons

## When it fits

The input names today's state and a desired future state.

## Process

You are executing the Three Horizons framework within the systemic-design
skill.

1. `h1` — today's dominant system, as the input describes it.
2. `h3` — the desired future system, as the input describes it.
3. `h2` — transition moves that grow the future inside the present: a list
   of `{move, owner_role, when}`. Each move names the `h1` feature it
   loosens or the `h3` feature it seeds. `owner_role` is a person only if
   the input names one. A `when` the input did not give also goes in
   `assumptions`, `unverified`.

## Output block

Emit the `three_horizons` block from `references/contract.md`: `h1`, `h2`,
`h3`. Renders as prose or a list; there is no cycle.

## Stop when

`h1` and `h3` each tie to evidence or an assumption, and `h2` has at least
one move with `owner_role` and `when` filled.
```

- [ ] **Step 6: Write `README.md`**

````markdown
# systemic-design

Plans how to change a system of people, incentives, and habits so a
problem stops coming back.

Answers: **how should the system be changed?**

## Frameworks

| Framework | Use it when |
| --- | --- |
| Theory of Change | One change is chosen; trace it from action to impact. |
| Three Horizons | You know today's state and the future you want. |
| Systemic Design | Otherwise: explore, reframe, create, catalyse. |

Selection is first-match-wins, top to bottom. The skill shortlists two
and recommends one; you pick.

## Usage

```
/reasoning:systemic-design "<problem>"
/reasoning:systemic-design three_horizons "<problem>"
```

Or hand it a `systems-thinking` result, or let `problem-router` route
there.

When a piece of the system model is missing and you're there to answer,
it asks you for it — one question at a time, each naming where to look.

## What it will not do

- Software architecture. Use a software design tool.
- Carry out the plan, draft its messages, or edit files.
- Invent dates or owners. A date you didn't give is marked as an
  assumption; an owner you didn't name is written as a role.

## Output

Six core fields plus exactly one framework block, per the shared contract
in `references/contract.md`.
````

- [ ] **Step 7: Run the new cases**

```bash
for c in 'sd-*' guardrail-unavailable-framework; do
  claude plugin eval plugins/reasoning --case "$c" --runs 3 --no-publish --trust-plugin \
    --json "/tmp/claude-1000/sd/green-${c//\*/x}.json" > /dev/null 2>&1
done
```
Run with `run_in_background` (six cases × 3 runs exceeds 10 minutes).

Expected: each case ≥ 0.85. A red case: read its failing grader and
transcript, fix the skill text (not the grader) unless the grader is
provably wrong, and ledger the ruling.

- [ ] **Step 8: Commit**

```bash
git add $P/skills
git commit -m "feat(reasoning): add systemic-design skill"
```

---

### Task 6: Hand-offs and version (phase 3c)

**Files:**
- Modify: `$P/skills/problem-router/SKILL.md` (Degradation)
- Modify: `$P/skills/systems-thinking/SKILL.md` (Purpose, Failure modes)
- Modify: `$P/skills/systems-thinking/frameworks/leverage-points.md` (Stop when)
- Modify: `$P/skills/systems-thinking/README.md`
- Modify: `$P/skills/problem-solving/SKILL.md` (Failure modes)
- Modify: all three `references/interview.md` copies
- Modify: `$P/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

- [ ] **Step 1: Router Degradation**

Replace the `complex-adaptive` paragraph and the one after it:

Old (two paragraphs, from `` `complex-adaptive` routes to `` through
`...not to the router.`) →
New:
```
`complex-adaptive` routes to `systems-thinking` first and then
`systemic-design`. Both are built. Route to them in that order, normally —
the first produces the model, the second plans the change.

Don't preview what either would conclude — no "would likely land on X", no
floating a probable intervention even provisionally. Those findings belong
to the skills that run them, not to the router.
```
Last paragraph of Degradation, old:
```
Never quietly downgrade the classification to fit what's built. A
complex-adaptive problem stays classified as complex-adaptive even though
only the first leg of its route can run — the human needs the honest class
to know the route is partial.
```
New:
```
Never quietly downgrade the classification. A complex-adaptive problem
stays classified as complex-adaptive — the human needs the honest class to
know which route fits.
```

- [ ] **Step 2: systems-thinking**

`SKILL.md` Purpose, old:
```
how to change the system over time — that is `systemic-design`, which is
not built in this release.
```
New:
```
how to change the system over time — that is `systemic-design`, the next
run once this model exists.
```

Failure mode, old:
```
- **Framework named that belongs to another skill** — theory of change,
  three horizons, explore/reframe/create/catalyse. Say `systemic-design`
  owns it and that the skill isn't built in this release. Don't improvise
  the framework here.
```
New:
```
- **Framework named that belongs to another skill** — theory of change,
  three horizons, explore/reframe/create/catalyse. That skill is built:
  say `systemic-design` owns the framework and hand the problem over.
  Don't run the framework here, and don't refuse it.
```

`leverage-points.md`, old: `an owner — that is \`systemic-design\`, which is not built in this release.`
New: `an owner — that is \`systemic-design\`, the next run.`

`README.md` "What it will not do", old:
```
- Produce an adoption plan, a sequence, or an owner — that is
  `systemic-design`, which is not built in this release.
```
New:
```
- Produce an adoption plan, a sequence, or an owner — that is
  `systemic-design`, the next run once the model exists.
```

- [ ] **Step 3: problem-solving failure mode**

Old:
```
- **Framework named that belongs to `systemic-design`** — theory of change,
  three horizons, explore/reframe/create/catalyse. Say which skill owns it
  and that the skill isn't built in this release. Don't improvise the
  framework here.
```
New:
```
- **Framework named that belongs to `systemic-design`** — theory of change,
  three horizons, explore/reframe/create/catalyse. That skill is built:
  say it owns the framework and hand the problem over. Don't run the
  framework here, and don't refuse it.
```

- [ ] **Step 4: interview another-class row, then copy**

In `$P/skills/systems-thinking/references/interview.md`, replace the row
starting `| Answer meets another class's definition` with:
```
| Answer meets another class's definition in `problem-router` — in `problem-solving`, recurrence (`complex`) or an actor adapting to fixes (`complex-adaptive`); in `systems-thinking`, only `complex-adaptive`; in `systemic-design`, `simple` or `ambiguous` | End the interview and emit. In `systems-thinking`, name `systemic-design` as the next run; elsewhere, recommend re-running `problem-router`. Do not start a second framework. |
```
```bash
for s in problem-solving systemic-design; do cp $P/skills/systems-thinking/references/interview.md $P/skills/$s/references/interview.md; done
md5sum $P/skills/*/references/interview.md | awk '{print $1}' | sort -u | wc -l
```
Expected: `1` (three copies; the router has none).

- [ ] **Step 5: No "not built" claim about systemic-design remains**

```bash
grep -rn -i "systemic-design" $P/skills | grep -i "not built\|isn't built\|does not exist"
grep -rn "hand the problem over" $P/skills/problem-solving/SKILL.md $P/skills/systems-thinking/SKILL.md | wc -l
```
Expected: first command prints nothing; second prints `3` (ps has two
hand-overs, ST one).

- [ ] **Step 6: Version bump**

`$P/.claude-plugin/plugin.json`: `"version": "0.3.0"` → `"version": "0.4.0"`.
`.claude-plugin/marketplace.json`, `reasoning` entry: `"version": "0.2.0"`
→ `"version": "0.4.0"`, and add `"systemic-design"` to its `keywords`.
```bash
jq -r '.version' $P/.claude-plugin/plugin.json
jq -r '.plugins[] | select(.name=="reasoning") | .version' .claude-plugin/marketplace.json
```
Expected: `0.4.0` twice.

- [ ] **Step 7: Run the router case**

```bash
claude plugin eval plugins/reasoning --case routing-complex-adaptive-org-change --runs 3 \
  --no-publish --trust-plugin --json /tmp/claude-1000/sd/router.json > /dev/null 2>&1
```
Expected: `no-unavailability-claim` passes 3/3; case ≥ its baseline.

- [ ] **Step 8: Commit**

```bash
git add $P .claude-plugin/marketplace.json
git commit -m "feat(reasoning): route to systemic-design, bump 0.4.0"
```

---

### Task 7: Full-suite gate

**Files:** none unless a regression needs a fix.

- [ ] **Step 1: Full suite in the background**

```bash
claude plugin eval plugins/reasoning --runs 3 --no-publish --trust-plugin \
  --json /tmp/claude-1000/sd/final.json > /tmp/claude-1000/sd/final.log 2>&1
```
Run with `run_in_background`; wait for the notification.

- [ ] **Step 2: Compare against baseline**

```bash
jq -r '.cases[] | "\(.name)\t\(.score)"' /tmp/claude-1000/sd/final.json | sort > /tmp/claude-1000/sd/final.tsv
jq -r '.cases[] | "\(.name)\t\(.score)"' /tmp/claude-1000/sd/baseline.json | sort > /tmp/claude-1000/sd/base.tsv
join -a1 -t$'\t' /tmp/claude-1000/sd/final.tsv /tmp/claude-1000/sd/base.tsv
```
Expected: 24 cases. Each new case (`sd-*`, `ps-router-handoff`) ≥ 0.85.
Each existing case ≥ its baseline or ≥ 0.85. A case below both is a
regression: re-run it alone with `--case`, diagnose, fix, and ledger it.

- [ ] **Step 3: Manual script (run by the human after merge)**

Write to the ledger, for the human to run in a new session:
1. `/reasoning:systemic-design "We want to move 200 people from project-based staffing to long-lived product teams over the next two years. Every previous reorg attempt got reverted within a quarter."` → first `AskUserQuestion` targets a model gap, with a `Look in:` line.
2. Answer: "managers are rated on headcount". Expected: recorded as `interview` evidence; the plan's interventions change.
3. Hand in a prior `systems-thinking` result with one `unverified` assumption. Expected: it stays `unverified`.
4. Answer a round with "it's just a typo in one config file". Expected: interview ends, output recommends re-running `problem-router`.

- [ ] **Step 4: Commit any fixes**

```bash
git add $P
git commit -m "fix(reasoning): <the regression fixed>"
```
Only if Step 2 required a fix.
