# Reasoning plugin — spec 3: systemic-design

Source PRD: `docs/reasoning-skill.md` (§§23–28). Earlier specs:
`2026-09-21-reasoning-plugin-design.md`, `2026-09-22-systems-thinking-design.md`,
`2026-09-25-evidence-interview-design.md`.

This is the last of three slices. It adds the fourth skill and closes the
15 findings deferred from spec 2 and the evidence-interview slice.

## Slice boundary

| Spec | Contents | Status |
| ---- | -------- | ------ |
| 1 | output contract, `problem-router`, `problem-solving` | merged |
| 2 | `systems-thinking` | merged |
| — | evidence interview | merged (0.3.0) |
| 3 (this) | `systemic-design` + 15 deferred fixes | designed |

Out of scope: PRD §24's later set (Transition Design, Service / Ecosystem
Design), the React Flow board (own spec), Codex compatibility, JSON schema
files, and any link to the `system-design` software-architecture skill.

## Purpose

`systemic-design` answers **how should the system be changed?** It turns a
problem whose fixes get routed around — by people, incentives, habits —
into a plan: changes, order, owners, dates, and the signal that says each
step worked.

```
problem-solving    "what broke?"                    → cause + experiment
systems-thinking   "why does it keep coming back?"  → system model
systemic-design    "how do we change that system?"  → plan
```

It is not software architecture. "Design the system for 1M users" is out
of scope.

## Decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | One combined spec: new skill + 15 fixes | Human's call. Blame is kept tractable by ordering the work in phases, each with its own eval run (see Verification). |
| 2 | Input: a systems-thinking result or a raw problem; with raw input, the missing model is flagged | Refusing raw input adds a hop for the human; silently inventing a model breaks the evidence rule. Flagging routes the gap into `assumptions` and the interview. |
| 3 | Full plan with dates | Human's call. Any date the input did not give is also an `assumptions` entry, status `unverified` — the no-fabricated-figures rule is preserved. |
| 4 | Three peer frameworks, first match wins, one block per run | Same shape as `systems-thinking`. Nesting the frameworks (explore→…→catalyse as a spine) would put three blocks in one run and break the contract for all four skills. |
| 5 | Invocation: human, model auto-invoke, or confirmed hand-off; no skill ever starts the next | Matches the three shipped skills. The description names what the skill is not for, and an eval guards it. |
| 6 | `guardrail-unavailable-framework` moves from `three_horizons` to `transition_design`, invoked on `systemic-design` | `three_horizons` ships here, so the premise dies. Invoking the owning skill directly also resolves deferred finding #3: a closest-available framework now exists in that skill's own table. |
| 7 | Version 0.3.0 → 0.4.0 | New skill. |

## The skill

### Frontmatter

```yaml
name: systemic-design
description: Plan how to change a system of people, incentives, and habits so a
  problem stops regenerating — using explore/reframe/create/catalyse, a theory
  of change, or three horizons. Use when a fix must survive people adapting to
  it: org or process transitions, "how do we get from today's way of working to
  a new one", or turning a systems-thinking map into steps, owners, dates, and
  success signals. Not for software architecture or technical system design.
  Recommends a framework and lets you choose; run it with a named framework to
  skip the choice.
```

### Entry paths

```
/reasoning:systemic-design "<problem>"                 skill recommends, human picks
/reasoning:systemic-design <framework> "<problem>"     human has already chosen
hand-off after human confirmation                      router or systems-thinking recommended
```

A prior `systems-thinking` result, when handed in, is read through its six
core fields and its one block. Its `evidence` carries over as evidence; its
`assumptions` carry over with their status unchanged.

### Framework selection

First match wins. Read top to bottom and stop at the first row that holds.

| Order | Test against the input | Framework |
| --- | --- | --- |
| 1 | The input names one chosen intervention and asks how it reaches an outcome. | `theory_of_change` |
| 2 | The input names a current state and a desired future state. | `three_horizons` |
| 3 | Otherwise — a system that needs changing, no path chosen yet. | `systemic_design` |

"We want product teams, so let's pilot one team" holds for 1 and 2; row 1
wins because an intervention is already chosen.

Selection, confirmation, and the headless branch follow `systems-thinking`
step 2 verbatim: shortlist the match plus the next-best, recommend, test
whether `AskUserQuestion` is available, ask or proceed agent-selected.

### Frameworks

Each lives in `frameworks/<name>.md` with Process, Output block, and Stop
when sections, like the existing framework files.

**`systemic_design`** — explore → reframe → create → catalyse (PRD §25).

- `explore`: actors, behaviours, structures, tensions, constraints — each
  from `evidence`, or cited to an `assumptions` entry.
- `reframe`: the reframed challenge, boundary, desired change, principles.
- `create`: interventions, each with the structure or actor it targets,
  dependencies, one unintended effect, and an experiment.
- `catalyse`: `plan` — a list of `{step, owner_role, when, signal}` — plus
  feedback mechanism and success measures.
- Stop when: every intervention targets a named entry, every plan step has
  all four fields, and every `signal` is observable.

**`theory_of_change`** — inputs → activities → outputs → short-term
outcomes → long-term outcomes → impact (PRD §26).

- `links`: a list of `{from, to, assumption}`, one per adjacent stage pair.
  PRD: "must include assumptions between stages".
- No dates. It is a causal chain, not a schedule.
- Stop when: all six stages have content and all five links carry an
  assumption.

**`three_horizons`** — H1 today's dominant system, H2 transition moves, H3
desired future (PRD §27).

- `h2`: a list of `{move, owner_role, when}`.
- Stop when: H1 and H3 are each tied to evidence or an assumption, and H2
  has at least one move whose `when` and `owner_role` are filled.

### Contract additions

Three rows added to the Framework blocks table in `contract.md`:

| Block | Fields |
| ----- | ------ |
| `systemic_design` | `explore`, `reframe`, `create`, `catalyse` |
| `theory_of_change` | `inputs`, `activities`, `outputs`, `short_term_outcomes`, `long_term_outcomes`, `impact`, `links` |
| `three_horizons` | `h1`, `h2`, `h3` |

`contract.md` exists as byte-identical copies under each skill's
`references/`. All copies, including the new fourth, are updated together
and must stay identical (`cmp` check).

### Guardrails

Each with a mechanical test, like the shipped skills.

- **Every change traces to the system.** Test: does each intervention,
  move, or activity name the `evidence` or `assumptions` entry it targets?
  No → cut it.
- **No invented system model.** Test: for each actor or structure the plan
  relies on, did the input state it? No → `assumptions`, status
  `unverified`, and it is a candidate gap for the interview.
- **Dates and owners come from the input.** Test: is each `when` and each
  named person in the input? A `when` that is not → also an `assumptions`
  entry, `unverified`. An owner that is not → written as a role, never an
  invented name.
- **A plan, not the doing.** Test: does the output draft a message, an org
  chart, a file, or run a step? Yes → stop and hand the plan back.
- **One framework per run.** Same test as `systems-thinking`.
- **Depth scales to the problem.** Same sentence-by-sentence test as the
  shipped skills.

### Failure modes

- **Software-design request.** Say this skill plans changes to systems of
  people and practice, and a software design tool fits the request. Name no
  specific skill.
- **Bounded defect or one-off outage.** Hand to `problem-solving`.
- **A "why does this keep happening" problem with no model.** Recommend
  `systems-thinking` first; run here only if the human says so.
- **Framework named but unavailable** — Transition Design, Service /
  Ecosystem Design. Say it isn't built yet and name the closest framework
  from the table with the difference stated.
- **Framework named that belongs to another skill.** Say which skill owns
  it and hand over.
- The interview failure modes from the shipped skills: asking without
  naming the gap; a source hint that names what to expect.

### Interview

A fourth byte-identical copy of `interview.md` (after the fixes below).
The step 4b wording mirrors `systems-thinking`. The another-class exit's
`systemic-design` clause: a `simple` or `ambiguous` definition met → end
and recommend re-running `problem-router`.

## Hand-off edits to shipped skills

| Skill | Edit |
| ----- | ---- |
| `problem-router` | Degradation: `complex-adaptive` routes to `systems-thinking` then `systemic-design`, both built; the "not built" paragraph goes. The honesty rule against downgrading stays. |
| `systems-thinking` | "No intervention design" guardrail stays, pointing to `systemic-design` as the next run. The failure mode naming ToC / three horizons / explore… as unbuilt becomes a hand-over. README "What it will not do" updated. |
| `problem-solving` | The `systemic-design` failure mode becomes a hand-over, like the `systems-thinking` one. |
| `interview.md` | `systems-thinking` another-class clause: `complex-adaptive` met → emit and name `systemic-design` as the next run, instead of re-routing. |

Any other "not built in this release" string about `systemic-design` in
the plugin is removed; the plan greps for it.

## The 15 deferred fixes

### Graders (7)

| # | Fix |
| - | --- |
| G1 | `st-causal-loop-unclosed/edges-carry-support-labels`: pricing→churn passes as `correlation` or `hypothesized`; only `evidenced` fails. |
| G2 | `st-selection-boundary/one-block-only`: the grader lists every block name from `contract.md` and counts only those. |
| G3 | New regex grader on every `routing-*` case: `not_contains` `(low\|medium\|high)\s*[-/]\s*(low\|medium\|high)` — catches `medium-high`. |
| G4 | `ps-interview-first-question/options-from-input`: each option must quote or name a specific detail from the input (a figure, a time, a component); an option that would fit any outage fails. |
| G5 | New regex grader on the three `*-interview-*` cases: `not_contains` `Don't know\|Stop, analyze now` — the headless question carries no fixed exits. |
| G6 | `guardrail-unavailable-framework`: prompt and graders move to `transition_design` on `systemic-design` (Decision 6). `names-closest-available` expects a framework from the `systemic-design` table. |
| G7 | New case `ps-router-handoff` (path 3, never evaluated): a prompt carrying a confirmed router hand-off with `rca`. Graders: skill fired; one `rca` block; no framework shortlist or re-selection question. |

Also on the router: `routing-complex-adaptive-org-change/states-systemic-design-unavailable`
is replaced by `no-unavailability-claim` — PASS if the response does not
call either skill unavailable.

### Skill wording (7)

| # | Fix |
| - | --- |
| W1 | `causal-loop.md` step 6: a stated lag is a duration or an explicit "after a delay"; a dated sequence ("March … April") is not a lag and goes in `assumptions`. `no-invented-delays` mirrors it. |
| W2 | `systems-thinking/README.md`: framework table in selection order. |
| W3 | `system-map.md`: steps 3–4 collapse into one pass; "candidate node" → "seeded node". |
| W4 | `interview.md`: "It is `root` only if…" → "It supports a cause only if an observation ties X to the symptom." Works in both skills. |
| W5 | `interview.md`: "lower confidence" (no such core field) → "name the contradiction in `open_questions`". |
| W6 | `interview.md` Answers table: new row — human confirms an assumption → its status becomes `confirmed`. |
| W7 | `contract.md` example: one `open_questions` entry written as a YAML block scalar, showing a multi-line question with its `Look in:` line. |

### Process lesson (1)

P1: never write an acceptance check that needs git rename detection across
a full-body rewrite. No code change; the plan obeys it.

## New eval cases

Five for `systemic-design`, plus G7. Every prompt names its skill, so a
skipped invocation fails `skill-fired`. Each loads several graders onto one
transcript.

| Case | Input shape | Graders assert |
| ---- | ----------- | -------------- |
| `sd-theory-of-change` | one chosen intervention, outcome wanted | skill fired; `theory_of_change` block; five links each with an assumption; no dates |
| `sd-three-horizons` | today + future state, no dates given | `three_horizons` block; every `when` also in `assumptions`; owners are roles |
| `sd-raw-input` | raw org problem, no model | actors/structures in `assumptions`; first `open_questions` entry targets a model gap with `Look in:` |
| `sd-not-software` | "use the systemic-design skill: design the system for 1M users" | skill fired; no `systemic_design` / ToC / three-horizons block; says a software design tool fits |
| `sd-default-selection` | system to change, no path chosen | `systemic_design` block only; each intervention cites an entry; plan steps carry all four fields |

## Verification

Phased so a score change has one cause.

| Phase | Work | Eval run |
| ----- | ---- | -------- |
| 0 | none | full suite, `--runs 3` → baseline |
| 1 | G1–G7 and the router grader swap | affected cases, `--runs 3` |
| 2 | W1–W7 | affected cases, `--runs 3` |
| 3 | skill, contract, hand-offs, new cases, 0.4.0 | full suite, `--runs 3` |

Gate: each new case ≥ 0.85; every existing case ≥ its phase-0 baseline
(or ≥ 0.85). A regression below baseline is investigated, not waived.
Estimated spend: ~$33–35. Full runs go to the background per
`claude plugin eval` cost notes.

TDD: each new case is written and run before its skill text exists and
must fail (RED). Grader fixes are checked against the phase-0 transcript
they were meant to judge.

Manual check after merge: one interactive `/reasoning:systemic-design` run
on the org-change input, confirming the interview asks about a model gap.
