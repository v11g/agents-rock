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
   reframed it, or as a handed-in `systems-thinking` result models it. If
   it is a software-design request, stop here per Failure modes — even
   when a framework is named.
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
4c. Even when the stopping test passes, an actor, behaviour, or structure
   the plan relies on that rests only on an `unverified` assumption is a
   model gap. Pick the one the most interventions depend on and treat it
   as the named gap for `references/interview.md`, with its trigger 1
   counted as met. With a human present, ask before emitting; headless,
   make it the first `open_questions` entry. The plan stays complete — do
   not label it unfinished; never say no further evidence is needed.
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
  and practice, and a software design tool fits the request. Name no
  specific skill. Run no framework — this holds even when the human named
  one.
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
