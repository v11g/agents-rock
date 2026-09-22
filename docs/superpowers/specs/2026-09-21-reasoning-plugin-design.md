# Reasoning plugin — spec 1: contract, router, problem-solving

Source PRD: `docs/reasoning-skill.md` (Reasoning Skills Pack, §§1–56).
This spec covers the first of three slices. It is scoped so the output
contract is proven against two consumers before the remaining skills
are designed.

## Slice boundary

| Spec | Contents | Status |
| ---- | -------- | ------ |
| 1 (this) | output contract, `problem-router`, `problem-solving` (5 frameworks) | designed |
| 2 | `systems-thinking` — iceberg, system map, causal loop, leverage points | later |
| 3 | `systemic-design` — explore/reframe/create/catalyse, theory of change, three horizons | later |

Deferred out of every slice until a dedicated spec: Codex compatibility
(PRD §39, §54.2). Spec 1 targets Claude Code only and makes no
portability claim. Provider-neutral phrasing is a convention here, not a
tested guarantee — see "Neutrality convention".

Out of scope for spec 1, from PRD §52 and the decisions below: JSON
schema files, a validation script, always-on artifact writing,
per-framework eval depth, and any relationship to the `business-analyst`
plugin. The two plugins are independent; overlapping material (5 Whys,
evidence labelling) is defined separately in each and no cross-reference
is created.

## Decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Slice 1 is contract + router + problem-solving | The contract is what every later skill depends on; two consumers test it before it is locked. |
| 2 | One plugin, `plugins/reasoning/`, N skills | Matches `solution-architect`, which ships four skills under one manifest and one version. |
| 3 | Codex deferred | No Codex artifact is worth maintaining before the Claude Code path is proven. |
| 4 | No coupling to `business-analyst` | Different jobs — elicitation for a lead versus analysis of a problem. Coupling a shipped 0.2.0 plugin buys nothing here. |
| 5 | Chat output by default; files only on request | PRD §35 artifacts on every run would clutter throwaway questions and force a directory convention. |
| 6 | Router advises, human confirms | A wrong classification is cheap to veto and expensive to act on. |
| 7 | Framework choice is recommended, never imposed | PRD §6.4 — the agent shortlists and explains; the human picks. |
| 8 | Contract is a small core plus one framework block | PRD §29's flat 20 fields cannot distinguish "not applicable" from "omitted". |
| 9 | `contract.md` is copied per skill, parity enforced by test | `src/cli/install.mjs` copies only skill directories (see "Installer constraint"). |
| 10 | Evals cover routing and guardrails, not per-framework sections | Negative assertions grade the PRD §55 hypothesis; section checks can follow. |

## Installer constraint

`src/cli/install.mjs:31` copies a single skill directory:

```js
cpSync(skill.dir, dest, { recursive: true, filter: shipsToUsers });
```

`skill.dir` is `plugins/<plugin>/skills/<skill>/`. Anything at plugin
root is not copied. A shared `plugins/reasoning/references/contract.md`
would therefore reach users who install through the Claude Code
marketplace (whole plugin ships) but not users who run
`agents-rock install` — a silent, install-path-dependent break.

Resolution: each skill carries its own `references/contract.md`, and
`tests/contract-parity.test.mjs` asserts the copies are byte-identical.
Drift fails CI instead of rotting. Each later skill adds a copy; the
test covers it without modification.

## File layout

```
plugins/reasoning/
├── .claude-plugin/plugin.json
├── evals/                        # per PLUGIN, not per skill
│   └── <case-name>/
│       ├── prompt.md             # fixtures are inlined into the prompt
│       └── graders/*.md          # type: llm | regex | tool_used
└── skills/
    ├── problem-router/
    │   ├── SKILL.md
    │   ├── README.md
    │   └── references/contract.md
    └── problem-solving/
        ├── SKILL.md
        ├── README.md
        ├── references/contract.md
        └── frameworks/
            ├── double-diamond.md
            ├── root-cause-analysis.md
            ├── five-whys.md
            ├── a3.md
            └── pdca.md
```

Plus one entry in `.claude-plugin/marketplace.json`
(`name: reasoning`, `version: 0.1.0`, `category: documentation`).
`bundle.sh reasoning` works unchanged. Plugin-root `evals/` never reaches
users via `agents-rock install`, because `copyCanonical` copies only skill
directories; the marketplace zip does ship the eval cases, and excludes
only the gitignored local run output under `evals/results/`.

Eval cases use `claude plugin eval`'s own format — `<case>/prompt.md` plus
`graders/*.md` — and live at the plugin root. The `evals/evals.json`
convention the other three plugins carry predates this CLI and is not
readable by it. README lives per skill, matching every existing plugin.

## The contract

Every run of every skill emits six core fields, plus exactly one block
named for the framework that ran.

```
problem            the problem as the skill understands it, restated
framework_used     the framework that ran
framework_reason   one line: why this one, for this problem
evidence[]         what the input actually supplied
assumptions[]      {statement, status: unverified|confirmed}
open_questions[]   what would change the analysis if answered
```

Framework blocks:

```
double_diamond  {discover, define, develop, deliver}
rca             {symptom, immediate, contributing, underlying, root, actions}
five_whys       {why_chain, root_candidate, uncertainties}
a3              {background, current, problem, target, causes,
                 countermeasures, plan, follow_up}
pdca            {hypothesis, test, metric, expected, actual, next}
router          {problem_class, reasoning_skill, recommended_framework,
                 confidence, why[], frameworks_rejected[{framework, reason}]}
```

Later skills add blocks; the core does not change. That is what makes
PRD §28 composition possible — a downstream skill reads the core fields
of an upstream result without knowing which framework produced them.

Rendering: markdown headings in chat by default. When the human asks to
save, one file is written — `problem-analysis.md` (PRD §35) in the
directory they name, carrying the core fields and the framework block as
YAML front-matter above the markdown body. A separate JSON file is not
written: it would be a second representation with nothing validating
that the two agree. No schema file and no validator ships in spec 1;
both return only if the project later moves to always-write artifacts.

### Evidence and confidence

Evidence types (PRD §30): user-provided fact, document, log, metric,
interview, observation, external source, inferred. Anything `inferred`
is never rendered as fact.

Confidence (PRD §31) is `low` / `medium` / `high` in all output. Numeric
confidence is not emitted — `0.84` implies a precision the reasoning
does not have.

## problem-router

Classifies, recommends, and stops. It does not analyse.

```
1. extract what the input states — facts, actors, symptoms, history
2. classify provisionally against PRD §8.2:
     simple | ambiguous | complex | complex-adaptive
3. identify what would flip the class; ask at most 3 such questions
4. recommend: skill + framework + why + what was rejected and why
5. present the options; the human confirms, overrides, or asks to
   classify only
```

Classification precedes questioning. Reversing the order produces an
open-ended interview, which PRD §32 rules out: a question earns a turn
only when a different answer changes the routing.

Rules it enforces:

- Every rejected framework carries a reason, never a bare list.
- Thin input means the class is provisional, and the output says so.
- It never names a root cause or proposes a fix.

Degradation: the router can legitimately classify a problem as `complex`
or `complex-adaptive` while the matching skill does not yet exist. It
says so and offers the closest available option with its limitation
stated — for example, RCA on a recurring symptom, noting that RCA will
not surface feedback loops. It does not silently downgrade the
classification to fit what is built.

## problem-solving

Takes a problem — raw, or reframed by the router — to a testable next
step.

Three entry paths, one behaviour:

```
/reasoning:problem-solving "<problem>"              skill recommends
/reasoning:problem-solving <framework> "<problem>"  human has chosen
router hand-off after human confirmation            router recommended
```

Selection and stopping rules:

| Symptom | Framework | Stop when |
| ------- | --------- | --------- |
| problem itself unclear | Double Diamond | framing settles; remaining unknowns will not change it |
| symptom clear, cause unclear | RCA | causes trace to something actionable and supported |
| narrow, linear causal chain | 5 Whys | the next "why" turns speculative or leaves scope |
| operational improvement needing a written case | A3 | all eight sections have content |
| change with a measurable hypothesis | PDCA | metric, expected result, and next action are defined |

The skill shortlists two candidates, names its pick with a one-line
reason, and lets the human choose. When the human has already named a
framework, that is the choice and it runs.

Guardrails (PRD §42):

- No cause is labelled *root* without stated support. Unsupported
  candidates render as `root_candidate`.
- Anything the input did not state is an assumption marked `unverified`.
- One framework per run. A second requires the first's stopping rule to
  have fired, plus a stated reason.
- Deliver is an experiment with a measurement plan, not an
  implementation. The skill does not write code or run the experiment.

## Headless behaviour

No human available (PRD §33): the pipeline is unchanged, but each point
that would ask a question instead records an assumption and proceeds.

```
questions      -> assumptions[], status: unverified
framework pick -> recommendation taken, recorded as agent-selected,
                  unconfirmed
analysis       -> produced, marked provisional
```

The analysis still ships. What would have been asked is visible in
`open_questions`.

## Neutrality convention

Skill prose addresses the executing agent, not a named model — "You are
executing the problem-solving skill", never "Because you are Claude"
(PRD §40). Harness-specific tools are named as bindings rather than as
the behaviour itself: the contract says *present the candidate
frameworks with a recommendation and let the human choose*, and notes
that Claude Code does this with `AskUserQuestion`. This keeps the
behaviour portable without shipping a Codex artifact in spec 1.

## Verification

**Unit** — `tests/contract-parity.test.mjs`, `node:test`, consistent
with the existing suites in `tests/`. Hashes every
`skills/*/references/contract.md` under `plugins/reasoning/` and fails
if they differ.

**Evals** — `plugins/reasoning/evals/<case>/` holding `prompt.md` and
`graders/*.md`, run with
`claude plugin eval plugins/reasoning --runs 3 --ablation none --threshold 0.85 --trust-plugin --no-publish`.
Ten cases: six routing, four guardrail. Assertions are predominantly
negative, because the claim under test is that the skills *avoid*
failure modes a general-purpose agent falls into.

Routing cases span all four classes and assert both the class and the
frameworks that must not appear:

```
eval_technical_001
  in     "a button crashes because user.profile is null"
  assert class in {simple, bounded}
         no systemic-design, no causal-loop, no three-horizons
         at most one clarifying question

eval_org_001
  in     "delivery remains slow after adding engineers; coordination
          overhead increased and senior engineers are constantly
          interrupted"
  assert class = complex
         does not immediately recommend hiring
         names systems-thinking and states it is not built yet
         every rejected framework carries a reason
```

Guardrail cases target PRD §47:

```
no fabricated figures     every number in the output appears verbatim
                          in the input
no unsupported root       no cause labelled "root" without stated support
no over-analysis          a simple problem does not produce an iceberg,
                          a causal loop, or a second framework
assumptions labelled      anything not stated in the input is marked
                          unverified
```

The fabricated-figures assertion is modelled on the equivalent check in
`business-analyst`'s eval suite, which is the sharpest assertion pattern
currently in this repository.

## Definition of done

1. `plugins/reasoning/` exists with both skills and a marketplace entry.
2. Both skills run standalone; the router also runs in classify-only mode.
3. Framework selection is conditional and explained, never automatic.
4. Every run emits the six core fields plus exactly one framework block.
5. Evidence, assumptions, and inferences are distinguishable in output.
6. A simple problem does not trigger systemic analysis.
7. The router degrades honestly when it classifies into an unbuilt skill.
8. `tests/contract-parity.test.mjs` passes.
9. The ten-case eval suite scores >= 0.85 per case at `--runs 3`, negative assertions included. Not a perfect pass rate: skill behaviour is non-deterministic prose, and a 1.0 threshold measures sampling luck rather than quality.
10. `bundle.sh reasoning` produces an installable archive, and
    `agents-rock install` delivers `contract.md` with each skill.
