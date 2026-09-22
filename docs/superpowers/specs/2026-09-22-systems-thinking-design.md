# Reasoning plugin — spec 2: systems-thinking

Source PRD: `docs/reasoning-skill.md` (Reasoning Skills Pack, §§16–22, §28,
§43, §46). Spec 1: `docs/superpowers/specs/2026-09-21-reasoning-plugin-design.md`.

This is the second of three slices. Spec 1 proved the output contract
against two consumers. This slice adds a third, and is the first to edit
shipped behaviour.

## Slice boundary

| Spec | Contents | Status |
| ---- | -------- | ------ |
| 1 | output contract, `problem-router`, `problem-solving` (5 frameworks) | merged |
| 2 (this) | `systems-thinking` — iceberg, system map, causal loop, leverage points | designed |
| 3 | `systemic-design` — explore/reframe/create/catalyse, theory of change, three horizons | later |

Spec 2 also edits `problem-router` (class definitions and degradation) and
one line of `problem-solving`. Both edits are forced by this slice: when
`systems-thinking` ships, prose asserting it does not exist becomes false.

Out of scope, unchanged from spec 1: Codex compatibility (PRD §39, §54.2),
JSON schema files, a validation script, always-on artifact writing, and any
relationship to the `business-analyst` plugin. Also out of scope, from PRD
§17's "later" set: Stock and Flow, Rich Picture. `systemic-design` stays
unbuilt.

## Decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Four peer frameworks, all taking the problem text; one block per run | See "Leverage Points as a peer". The contract's core and its one-block rule survive untouched. |
| 2 | `problem-router`'s `complex` / `complex-adaptive` definitions are rewritten now | The two classes are not disjoint, and `systems-thinking` receives both. Spec 2 must edit the router anyway; one edit and one suite run beats two. |
| 3 | Diagrams are governed by a cycle test | `contract.md`'s shipped rule — "diagrams only where they carry something prose cannot" — is an adjective. See "The recurring failure mode". |
| 4 | Framework selection is first-match-wins over an ordered list | PRD §18's flat tree has the same non-disjointness defect as the router's class table. An ordered list is disjoint by construction. |
| 5 | Evals add 6 cases, not 12 | A case costs an agent run × 3; a grader costs a transcript read. Load assertions onto shared transcripts. |
| 6 | The `guardrail-unavailable-framework` fixture moves from `iceberg` to `three_horizons` | Iceberg ships in this slice, so the case's premise dies. `three_horizons` preserves the original intent 1:1 without inventing a new case. |

## Leverage Points as a peer

PRD §28 chains System Map → Leverage Points in one pass, which reads as a
conflict with the contract's one-block rule. It is not, and the resolution
changes the framework's own output shape.

Leverage Points is not structurally like the other three. Its seven levels
(PRD §22) are, with one exception, field names the other frameworks emit:

| Level (PRD §22 wording) | `kind` | Field it names | Emitted by |
| ----------------------- | ------ | -------------- | ---------- |
| parameters | `parameter` | variables | Causal Loop |
| information flows | `information_flow` | information flows | System Map |
| rules | `rule` | policies | System Map |
| incentives | `incentive` | incentives | System Map |
| system structure | `structure` | structures, loops | Iceberg, Causal Loop |
| mental models | `mental_model` | mental_models | Iceberg |
| goals | `goal` | — | none |

`kind` is the machine name used in the block; the first column is PRD §22's
prose. `goal` is the one level no other framework emits — an `elements[]`
row of that kind is admissible only when the input states a goal, and it
carries an evidence type like any other row. Nothing special-cases it.

Run standalone against raw text, `level: system structure` asserts a
structure nobody mapped, and `expected_effect` asserts propagation through
relationships nobody listed. The framework does not fail — it produces
confident systems vocabulary over an invisible model. That is the failure
PRD §6.3 exists to prevent.

The blocker was never the missing input. It was the missing *visibility*.
So the block carries the model it read the levels off:

```
leverage_points:
  elements:
    - element:   "senior engineers triage all inbound requests"
      kind:      rule
      evidence:  user-provided fact
    - element:   "throughput is measured per-team"
      kind:      incentive
      evidence:  inferred
  points:
    - intervention:    "route triage through a rota"
      level:           rule
      expected_effect: "spreads interrupt load off the two named seniors"
      risks:           "triage quality drops while the rota ramps"
      evidence:        "user-provided fact: seniors are constantly interrupted"
```

Test: every `points[].level` matches the `kind` of a row in `elements[]`,
and every `elements[]` row carries an evidence type. The check is
mechanical and lives inside one block.

Consequences:

- All four frameworks take the same input. Leverage Points is a peer.
- The contract's core and one-block rule are unchanged.
- Chaining needs no special case. A prior run's output is ordinary input,
  the way `problem-router` already treats "any files the human points at".
  Richer input yields a richer `elements[]`.
- Nothing enforces mapping first. That ordering is replaced by a visible
  signal: run against two lines of raw text, every `elements[]` row is
  `evidence: inferred` and confidence is `low`. PRD §6.3 permits inferred
  content; it forbids *undeclared* inferred content.

`elements[]` overlaps `system_map` and is deliberately shallower — a flat
kind-tagged list, with no boundary, no relationships, and no dependencies.
A full map is `system_map`'s job.

## The recurring failure mode

Four rules shipped in spec 1 as adjectives, read correctly, changed no
behaviour, and were caught only when something else failed: "a ceiling,
not a target", "framing settles", "no human available", "classify-only".
Each had to be replaced with a test an agent executes and gets a yes or no
from.

PRD §43 hands this slice three more. Its stopping conditions for Systems
Thinking are "system boundary is useful", "primary loops and structures are
understood", and "additional nodes do not materially change intervention
choices". None of the three is executable. Every rule below is stated as a
test for that reason, and any adjectival constraint in this spec should be
treated as a defect.

## The four frameworks

Field names follow PRD §§19–22.

| Block | Fields |
| ----- | ------ |
| `iceberg` | `event`, `patterns`, `structures`, `mental_models` |
| `system_map` | `system_boundary`, `actors`, `components`, `relationships`, `dependencies`, `external_factors` |
| `causal_loop` | `variables`, `links`, `loops`, `delays` |
| `leverage_points` | `elements`, `points` |

Each edge in `causal_loop.links` carries exactly one support label, per
PRD §21: `correlation`, `hypothesized`, or `evidenced`. A missing label is
an error, and the three are never collapsed.

### Stopping tests

**`iceberg`.** Depth is fixed at four levels, so the rule is not how deep
to go. It is what happens to a level with nothing under it.

> For each of the four levels, name the specific input fact supporting it.
> Cannot name one → the level renders empty, stating what evidence would
> fill it. Never inferred upward into a fact.

This is PRD §46's "mental model not invented as fact", stated as a check.

**`system_map`.** This is where PRD §43's "useful boundary" actually lives.

> Add a candidate node only if it appears in the input, **or** removing it
> breaks a `relationship` already recorded. Neither → it is outside the
> boundary and goes in `external_factors`.
> Stop when no remaining candidate passes.

The boundary is closure over stated elements: finite, and computable.

**`causal_loop`.**

> Extend a chain only while the next link names a variable already in
> `variables` or evidenced in the input. The next link would introduce an
> unevidenced variable → the chain stops there.
> A chain enters `loops` only when it closes on a variable already in the
> diagram. It does not close → it is an open chain, labelled as such, and
> not called a loop.
> A `delays` entry is recorded only where the input states a lag. An
> inferred delay is an `assumptions` entry, not a `delays` entry.

**`leverage_points`.**

> Every `points[].level` matches the `kind` of a row in `elements[]`.
> Stop when each `kind` present in `elements[]` has either an intervention
> or an explicit "none identified, because …".

Finite by construction: seven kinds, one pass.

## Framework selection

PRD §18 offers a flat tree — recurring symptom → Iceberg, actors and
relationships → System Map, feedback analysis → Causal Loop, intervention
points → Leverage Points. Its four branches overlap: a recurring
cross-team delivery slowdown that survives local fixes matches all four.
This is the same defect as the router's class table, and takes the same
fix.

First match wins, top to bottom:

| Order | Test against the input | Framework |
| ----- | ---------------------- | --------- |
| 1 | The human asks where to intervene | `leverage_points` |
| 2 | The input names the variables, and they are suspected of closing a loop | `causal_loop` |
| 3 | The input names two or more actors whose relationships are unclear | `system_map` |
| 4 | Otherwise — a recurring symptom with unexamined layers beneath it | `iceberg` |

Following `problem-solving`: shortlist two candidates, name the pick with a
one-line reason, and let the human choose. Never decide silently.

## Entry paths and process

Three entry paths, one process, matching `problem-solving`:

```
/reasoning:systems-thinking "<problem>"              skill recommends
/reasoning:systems-thinking <framework> "<problem>"  human has chosen
router hand-off after human confirmation             router recommended
```

```
1. Establish the framing: the problem as stated, or as problem-router
   reframed it.
2. Select the framework:
     - Named already → that is the choice, go to step 3.
     - Not named → shortlist two, recommend one with a one-line reason.
       Then test, don't infer: is AskUserQuestion actually available in
       this session? Yes → ask and wait. No → headless: take your own
       recommendation, record it agent-selected and unconfirmed, go to
       step 3.
       Naming the shortlist and stopping there, without asking and
       without proceeding, is not a valid outcome on either branch.
3. Open the matching file under frameworks/ and follow it exactly.
4. Stop at that file's stopping test, not at a felt sense of completeness.
5. Emit the six core fields plus exactly one framework block.
```

## Guardrails

Each carries a test, not an instruction to be careful.

| Guardrail | Test |
| --------- | ---- |
| No invented structure or mental model | For each entry in `structures` and `mental_models`: did the input state it? No → `assumptions`, status `unverified`. Never promoted to `evidence`. |
| An open chain is not a loop | Does the chain close on a variable already in the diagram? No → record it as an open chain. |
| Correlation is not causation | Every `links` edge carries exactly one of `correlation` / `hypothesized` / `evidenced`. A missing label is an error. |
| One framework per run | Has the first framework's stopping test fired, and is there a stated reason a second adds something the first did not reach? Both must be yes. |
| Diagrams only for cycles | Does the structure contain a cycle? No → prose. |
| No intervention design | Does the output name who does it, in what order, or by when? Yes → cut. `leverage_points` names *where* to push, the expected effect, and the risks. Adoption plans, sequencing, and ownership are `systemic-design` (PRD §25.4). |
| Depth scales to the problem | Sentence by sentence: does this sentence name a fact, figure, file, or `evidence` entry from THIS input? If it would read as true against any input, it is generic — cut it. |

## Boundary with problem-solving

```
problem-solving   "What is the cause, and what is the next testable step?"
systems-thinking  "What system is producing this?"
```

`systems-thinking` is not for a one-line, reproducible, single-function
defect. That is `problem-solving`. The shipped
`guardrail-no-over-analysis/no-systems-thinking-vocabulary.md` grader
already asserts exactly this and needs no change.

## Contract changes

The six core fields do not change. Two edits, applied to all three copies
of `contract.md`:

1. The framework block table gains the four rows listed above.
2. The Rendering section's diagram rule is replaced:

| Before | After |
| ------ | ----- |
| "Diagrams only where they carry something prose cannot." | "A structure containing a cycle gets a diagram; one without gets prose. Prose renders a cycle as a list, and a list loses the closure." |

`skills/systems-thinking/references/contract.md` is the third copy.
`tests/contract-parity.test.mjs` covers it without modification — spec 1's
installer-constraint design anticipated this.

## Router changes

**Class definitions.** The shipped table discriminates `complex` by
"reappears after local fixes" and `complex-adaptive` by "system reacts to
intervention". Those are the same sentence. The `routing-complex-delivery-slowdown`
fixture contains both verbatim, and the router was not misbehaving.

Both rows are rewritten around what regenerates the symptom:

```
complex            Structure regenerates the symptom. Fix the structure
                   and it stops.
complex-adaptive   Agents regenerate it by adapting. Fix the structure
                   and they route around it.

Test: name the actor whose behaviour changes in response to the fix, and
say how they route around it.
  Can name one from the input's evidence → complex-adaptive
  Cannot                                  → complex
```

**Degradation** narrows rather than disappearing:

| Class | Before | After |
| ----- | ------ | ----- |
| `complex` | `systems-thinking` unbuilt, fall back to RCA with its limitation | routes to `systems-thinking`; no degradation |
| `complex-adaptive` | both skills unbuilt | `systems-thinking` runs; `systemic-design` still unbuilt, so degradation applies to the second leg only |

The "quietly downgrading a classification" failure mode stays — it still
governs `complex-adaptive`.

The "Complex — degradation applies" example is rewritten: it currently
recommends RCA as a partial substitute, and must now route to
`systems-thinking`.

**`problem-solving`** loses one Failure-modes claim. Iceberg, system map,
causal loop, and leverage points now belong to a built skill and are handed
off rather than refused. Theory of change and three horizons keep the
existing refusal.

## Verification

**Unit** — `tests/contract-parity.test.mjs`, unchanged. It hashes every
`skills/*/references/contract.md` under `plugins/reasoning/`, so the third
copy is covered automatically. No new unit test ships; there is nothing
mechanical to assert that the evals do not already cover.

**Evals** — `plugins/reasoning/evals/<case>/` with `prompt.md` and
`graders/*.md`, run with:

```
claude plugin eval plugins/reasoning --runs 3 --ablation none \
  --threshold 0.85 --trust-plugin --no-publish
```

`--no-publish` is mandatory: the CLI publishes an HTML report to claude.ai
by default. Fixtures are inlined into `prompt.md`; `context.add_dirs`
grants read permission and does not mount anything.

Cost shapes the design. A case is an agent run times three; a grader reads
a transcript that already exists. Six new cases carry four to six
assertions each rather than one assertion apiece.

| Case | Fixture | Graders on the shared transcript |
| ---- | ------- | -------------------------------- |
| `st-selection-boundary` | Input matching several selection rows | first match wins; the rejected candidate carries a reason; exactly one block |
| `st-iceberg-thin-input` | Two lines | a level renders empty with what would fill it; no invented mental model; no Mermaid (cycle test); six core fields |
| `st-causal-loop-unclosed` | Two chains — one closing on a variable already in the diagram, one running out of evidence before it closes | the non-closing chain is not called a loop; the closing one is; `correlation` labelled correctly; no `delays` entry, since the fixture states no lag; Mermaid present, because the closing chain is a cycle |
| `st-system-map-boundary` | Names things outside the boundary | they land in `external_factors`; no invented components; no intervention design |
| `st-leverage-points-bound` | Enough to build a thin model | every `level` matches an `elements` kind; every `elements` row carries an evidence type; no adoption plan, owner, or sequencing |
| `routing-adaptive-discriminator` | A symptom regenerated by structure, with no actor routing around the fix | classifies `complex`, not `complex-adaptive`; states the test it applied |

The last case is what makes decision 2 more than a prose edit. Without it,
the taxonomy fix is unmeasured.

Six existing cases change:

| Case or grader | Change |
| -------------- | ------ |
| `routing-complex-delivery-slowdown/names-unbuilt-skill.md` | rewritten: routes to `systems-thinking`, no degradation language |
| `routing-complex-adaptive-org-change/names-both-unbuilt-skills.md` | keeps the ordering assertion, drops "both unbuilt" |
| `routing-complex-adaptive-org-change/states-both-unavailable.md` | renamed `states-systemic-design-unavailable.md`, covers one skill |
| `routing-complex-adaptive-org-change/no-downgrade.md` | unchanged — still correct |
| `guardrail-unavailable-framework/` (3 graders) | fixture moves from `iceberg` to `three_horizons`; graders keep their shape, only the framework name changes |
| `guardrail-no-over-analysis/no-systems-thinking-vocabulary.md` | unchanged — a one-line defect still must not reach for systems vocabulary |

Totals: 16 cases, roughly $11 and 32 minutes per full run, extrapolated
from spec 1's measured 10 cases at ~$7 and ~20 minutes.

The gate is unchanged from spec 1: **per-case score ≥ 0.85 at `--runs 3`**,
not a perfect pass rate. Two consecutive full-suite runs on identical files
once gave three red and then zero red. A single run decides nothing.

## File layout

```
plugins/reasoning/skills/systems-thinking/
├── SKILL.md
├── README.md
├── references/contract.md        # third copy, parity-tested
└── frameworks/
    ├── iceberg.md
    ├── system-map.md
    ├── causal-loop.md
    └── leverage-points.md
```

`plugin.json` goes to `0.2.0`, and `.claude-plugin/marketplace.json`
follows.

**Publishing risk.** This repository's CI publishes to npm when a
`plugin.json` version bump lands on `main`. As of this spec, local `main`
is 22 commits ahead of `origin/main` and nothing has been pushed. The first
push would ship `reasoning@0.2.0` together with everything else unpushed.
Do not push without explicit instruction.

## Definition of done

1. `systems-thinking` runs standalone through all three entry paths.
2. Framework selection is first-match-wins, explained, and never silent.
3. Every run emits the six core fields plus exactly one framework block.
4. All four stopping rules are yes/no tests; no adjectival constraint
   remains.
5. No entry in `structures` or `mental_models` is invented — anything the
   input did not state sits in `assumptions`.
6. An open chain is never labelled a loop, and every edge carries a support
   label.
7. A diagram appears if and only if the structure contains a cycle.
8. `leverage_points` produces no adoption plan, sequencing, or ownership.
9. The router separates `complex` from `complex-adaptive` by the actor
   test.
10. Degradation survives for `systemic-design` and is gone for
    `systems-thinking`.
11. `tests/contract-parity.test.mjs` passes across three copies.
12. All 16 eval cases score ≥ 0.85 at `--runs 3`.
13. `bundle.sh reasoning` produces an installable archive, and
    `agents-rock install` delivers `contract.md` with all three skills.
