---
name: systems-thinking
description: Model the system producing a problem — its layers, actors, feedback loops, or intervention points — using the iceberg model, a system map, a causal loop diagram, or leverage points. Use when a symptom keeps returning after local fixes, when multiple actors and dependencies are tangled, or when someone asks where to intervene. Recommends a framework and lets you choose; run it with a named framework to skip the choice.
---

# systems-thinking

You are executing the systems-thinking skill. A problem has arrived that
looks structural rather than local, and your job is to model the system
producing it: select or confirm a framework, run it to its own stopping
test, and emit the result. You do not design the intervention programme,
write the fix, or edit files.

## Purpose

Answer one question: **what system is producing this?**

Not what the cause is and what to try next — that is `problem-solving`. Not
how to change the system over time — that is `systemic-design`, which is
not built in this release.

## When to use / When not to use

Use this when the problem survives local fixes, spans several actors or
teams, or is suspected of feeding back on itself. Also use it when someone
asks directly where to intervene.

Don't use this for a one-line, reproducible, single-function defect. A null
pointer in one method is `problem-solving`, and reaching for an iceberg
there produces vocabulary instead of an answer.

Don't use this to plan the change. Naming where to push is in scope; who
does it, in what order, and by when is `systemic-design`.

## Inputs

- The problem text, raw or already reframed by `problem-router`.
- Optionally, a framework name as the first argument — `iceberg`,
  `system_map`, `causal_loop`, or `leverage_points`.
- Whatever a `problem-router` hand-off carries: its classification,
  recommended skill, and reasoning.
- A prior systems-thinking result, when the human hands one in. It is
  ordinary input — richer than raw text, not a special mode.

## Entry paths

All three land in the same process below.

```
/reasoning:systems-thinking "<problem>"               skill recommends, human picks
/reasoning:systems-thinking <framework> "<problem>"   human has already chosen
router hand-off after human confirmation              router recommended
```

## Framework selection

First match wins. Read top to bottom and stop at the first row that holds.

| Order | Test against the input | Framework |
| --- | --- | --- |
| 1 | The human asks where to intervene. | `leverage_points` |
| 2 | The input names the variables, and they are suspected of closing a loop. | `causal_loop` |
| 3 | The input names two or more actors whose relationships are unclear. | `system_map` |
| 4 | Otherwise — a recurring symptom with unexamined layers beneath it. | `iceberg` |

The order matters. These four descriptions overlap by construction: a
recurring cross-team slowdown that survives local fixes answers to all four.
Reading top-down and stopping at the first match is what makes the choice
decidable rather than a matter of taste.

See `frameworks/iceberg.md`, `frameworks/system-map.md`,
`frameworks/causal-loop.md`, and `frameworks/leverage-points.md` for the
full process and the mechanical test behind each stopping rule.

Shortlist two candidates, name your pick with a one-line reason, and let the
human choose. When the human named a framework, that is the choice and it
runs — skip this section entirely, no confirmation step.

## Process

1. Establish the framing: the problem as stated, or as `problem-router`
   reframed it.
2. Select the framework:
   - Named already (human, or router hand-off with confirmation) → that's
     the choice, go to step 3.
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
   exactly. Don't substitute a different structure or skip its steps
   because the problem feels straightforward.
4. Stop at that file's own stopping test, not at a felt sense of
   completeness. Apply the test — see each file's Stop when section.
5. Emit the result per Output contract below.

## Output contract

Emit the six core fields plus exactly one framework block, per
`references/contract.md` — that file is the single source of truth for
field names, evidence types, assumption status, confidence rendering, and
when a diagram is warranted. Don't guess at the shape here.

The one block is whichever framework ran in step 3. Never emit more than one
framework block in a single run — see Guardrails.

## Guardrails

These are rules this skill will not break. Each has a test — apply the test,
not a judgment call.

- **No invented structure or mental model.** Test: for each entry in
  `structures` and `mental_models`, did the input state it, or did you infer
  it? Inferred → `assumptions`, status `unverified`. Never promoted into a
  level as fact, however well it fits.
- **An open chain is not a loop.** Test: does the chain close on a variable
  already in the diagram? No → record it as an open chain and say so. A
  loop that does not close is the single most common way this analysis
  invents a finding.
- **Correlation is not causation.** Test: does every `links` edge carry
  exactly one of `correlation` / `hypothesized` / `evidenced`? A missing
  label is an error, not a stylistic omission.
- **One framework per run.** Test: before starting a second, has the first's
  own stopping test actually fired (check that file's Stop when section),
  and is there a stated reason a second adds something the first didn't
  reach? Both must be yes.
- **Diagrams only for cycles.** Test: does the structure contain a cycle? No
  → prose. A four-level iceberg and a flat leverage list are not cycles and
  get no diagram.
- **No intervention design.** Test: does the output name who does it, in
  what order, or by when? Yes → cut it. `leverage_points` names where to
  push, the expected effect, and the risks. Adoption plans, sequencing, and
  ownership belong to `systemic-design`.
- **Depth scales to the problem, not to the framework's capacity.** Test,
  applied sentence by sentence to what you have written: does this sentence
  name a specific fact, quote, figure, file, or `evidence` entry from THIS
  problem's input? If a sentence would read as true no matter what the
  input contained, it is generic — cut it, or replace it with a plain "no
  evidence for this."

## Failure modes

- **Framework named that belongs to another skill** — theory of change,
  three horizons, explore/reframe/create/catalyse. Say `systemic-design`
  owns it and that the skill isn't built in this release. Don't improvise
  the framework here.
- **Framework named but unavailable** — from PRD §17's later set: Stock and
  Flow, Rich Picture. Say it isn't built yet, and name the closest available
  framework from the table above with the difference stated, rather than
  silently substituting it.
- **Running this on a bounded defect.** One function, one service,
  reproducible — that's `problem-solving`. Say so and hand it back rather
  than producing an iceberg over a stack trace.

## Examples

**Agent-selected — a recurring cross-team symptom, no framework named**

Input: "Every quarter the same onboarding delays come back. We fix the
handoff between sales and provisioning, it holds a few weeks, then a
different team hits the same wall. Three times in two years, three different
fixes."

First-match table: row 1 doesn't hold — no one asked where to intervene.
Row 2 doesn't hold — the input names no variables. Row 3 holds: sales,
provisioning, and downstream teams, with the relationships between them
unstated. So `system_map`, shortlisted against `iceberg` (which would fit
the recurrence, but the immediate gap is who connects to whom). Recommend
`system_map` with that one-line reason; in Claude Code, present both via
`AskUserQuestion`.

Run `frameworks/system-map.md`: seed sales, provisioning, and the named
downstream teams; record only the handoff relationships the input states.
"Three different fixes" is evidence of recurrence but names no new node, so
nothing is added for it. Candidate nodes like "the CRM" are mentioned
nowhere and break no recorded relationship — `external_factors`. The
recorded relationships form no cycle, so the output is prose, not Mermaid.
Emit the six core fields plus one `system_map` block.

**Human-named — the human already picked**

Input: `/reasoning:systems-thinking leverage_points "Support escalations
keep landing on the same two engineers. On-call rota exists, escalation
policy says route through the rota, but everyone DMs them directly."`

`leverage_points` is named, so it runs — no shortlist. Open
`frameworks/leverage-points.md`: `elements` gets the escalation policy
(`kind: rule`, `evidence: user-provided fact`), the DM habit
(`kind: information_flow`, `user-provided fact`), and the rota
(`kind: structure`, `user-provided fact`). Whether the two engineers are
rewarded for responsiveness is not stated, so if it is recorded at all it is
`kind: incentive`, `evidence: inferred`, and the output says so.

`points` proposes interventions whose `level` matches one of those kinds.
No `goal` or `mental_model` row exists, so no intervention claims those
levels — each gets "none identified, because the input states no goal or
belief". The block names where to push and what it risks; it does not say
who runs the change or when. Emit the six core fields plus one
`leverage_points` block.
