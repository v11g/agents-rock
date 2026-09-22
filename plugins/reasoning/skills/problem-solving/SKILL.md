---
name: problem-solving
description: Work a problem to a testable next step using the framework that fits it — Double Diamond, root cause analysis, 5 Whys, A3, or PDCA. Use when a problem needs analysis rather than a direct answer: recurring failures, unclear causes, improvement work, or a change that needs a measurable hypothesis. Recommends a framework and lets you choose; run it with a named framework to skip the choice.
---

# problem-solving

You are executing the problem-solving skill. A problem has arrived — raw,
framework-named, or handed over by `problem-router` — and your job is to
take it to a tested next step: select or confirm a framework, run it to its
own stopping rule, and emit the result. You do not write the fix, edit
files, or run the experiment the framework recommends.

## Purpose

Take a problem — raw or reframed — to a testable next step: a hypothesis
with a measurement plan, or a root cause with a named gap in support.
Nothing past that point is this skill's job.

## When to use / When not to use

Use this when a problem has, or can be given, a single framing to run: a
named framework, a symptom clear enough to work directly, or a problem
`problem-router` has already classified and handed over.

Don't use this when the problem hasn't been classified yet and its shape is
genuinely unclear — vague symptoms, "where do I even start," multiple
plausible framings. Route those through `problem-router` first; it decides
where the problem goes, this skill runs what it's given.

Don't use this to write the fix. The deliverable is an experiment or a
supported cause, not a code change, a file edit, or a completed test run —
see Guardrails.

## Inputs

- The problem text, raw or already reframed by `problem-router`.
- Optionally, a framework name as the first argument — `five_whys`, `rca`,
  `double_diamond`, `a3`, or `pdca`.
- Whatever the `problem-router` hand-off carries: its classification,
  recommended framework, and reasoning, when this run started there.

## Entry paths

All three land in the same process below — only the starting point differs.

```
/reasoning:problem-solving "<problem>"               skill recommends, human picks
/reasoning:problem-solving <framework> "<problem>"   human has already chosen
router hand-off after human confirmation             router recommended
```

## Framework selection

Shortlist two candidates from this table, name the pick with a one-line
reason, and let the human choose. Full stopping tests live in each
framework file — this table carries only the first line of each.

| Framework | When it fits | Stop when |
| --- | --- | --- |
| `double_diamond` | The problem itself is unclear. | Framing settles; remaining unknowns will not change it. |
| `rca` | Symptom is clear, cause is not. | Causes trace to something actionable and supported. |
| `five_whys` | Narrow scope, linear causal chain. | The next "why" turns speculative or leaves scope. |
| `a3` | Operational improvement needing a written case. | All eight sections have content. |
| `pdca` | A change with a measurable hypothesis. | Metric, expected result, and next action are defined. |

See `frameworks/double-diamond.md`, `frameworks/root-cause-analysis.md`,
`frameworks/five-whys.md`, `frameworks/a3.md`, and `frameworks/pdca.md` for
the full process and the mechanical test behind each stopping rule.

When the human named a framework, that is the choice and it runs — skip
this section entirely, no confirmation step. Headless, with no human
available: take the pick, record it as agent-selected and unconfirmed, and
proceed.

## Process

1. Establish the framing: the problem as stated, or as `problem-router`
   reframed it.
2. Select the framework:
   - Named already (human, or router hand-off with confirmation) → that's
     the choice, go to step 3.
   - Not named → shortlist two from the table above, recommend one with a
     one-line reason, and let the human choose — in Claude Code, via
     `AskUserQuestion`. Headless: take the recommendation, record it
     agent-selected and unconfirmed.
3. Open the matching file under `frameworks/` and follow its process
   exactly. Don't substitute a different structure or skip its steps
   because the problem feels straightforward.
4. Stop at that file's own stopping rule, not a fixed depth or section
   count. Apply the rule's test, not an impression of whether it feels
   done — see each file's Stop when section.
5. Emit the result per Output contract below.

## Output contract

Emit the six core fields plus exactly one framework block, per
`references/contract.md` — that file is the single source of truth for
field names, evidence types, assumption status, and confidence rendering.
Don't guess at the shape here.

The one block is whichever framework ran in step 3. Never emit more than
one framework block in a single run — see Guardrails.

## Guardrails

These are rules this skill will not break. Each has a test — apply the
test, not a judgment call.

- **No cause is labelled `root` without stated support.** Test: can you name
  a specific entry in `evidence` that ties this cause to the symptom
  without inserting a further inferential step? Yes → `root`. No →
  `root_candidate`, with what evidence would promote it stated alongside.
- **Anything the input didn't state is an assumption, not evidence.** Test:
  for each fact about to be recorded, did the input say it, or did you
  infer or derive it? Inferred → `assumptions`, status `unverified`. Never
  render inferred content as `evidence`, no matter how confident the
  inference.
- **One framework per run.** Test: before starting a second one, has the
  first's own stopping rule actually fired (check that file's Stop when
  section), and is there a stated reason continuing adds something the
  first pass didn't reach? Both must be yes; if either is no, don't run a
  second framework.
- **Deliver is an experiment with a measurement plan, not an
  implementation.** Test: does the next step involve writing code, editing
  a file to apply the change, or running the experiment? Yes → stop; hand
  the tested next step back rather than acting on it, however obvious the
  fix looks.
- **Length and depth scale to the problem, not to the framework's
  capacity.** Test: could this section's content, unchanged, be pasted
  into an analysis of a different problem? Yes → it's filling space, not
  analysis of this one — cut it, or replace it with a plain "no evidence
  for this." A one-line defect gets however many fields the evidence
  actually supports, stated briefly; it does not get every section of the
  framework padded out to look thorough.

## Failure modes

- **Framework named that belongs to another skill** — iceberg, system map,
  causal loop, leverage points, theory of change, three horizons. Say
  which skill owns it (`systems-thinking` or `systemic-design`) and that
  the skill isn't built in this release. Don't improvise the framework
  here.
- **Framework named but unavailable** — from PRD §10.2's later set: DMAIC,
  OODA, TRIZ, Design Sprint. Say it isn't built yet, and name the closest
  available framework from the table above with the difference stated,
  rather than silently substituting it.

## Examples

**Agent-selected — a one-line defect, no framework named**

Input: "Deploys fail intermittently after the runner image update.
ci-run-4471 log attached."

No framework named. Shortlist from the table: `five_whys` (narrow scope,
one system, plausible linear chain) and `rca` (would work too, but its
four-layer breakdown is more structure than one log and one symptom
supports). Recommend `five_whys` with that one-line reason; in Claude Code,
present both via `AskUserQuestion` and let the human pick. Headless, take
`five_whys` and record it as agent-selected, unconfirmed.

Run `frameworks/five-whys.md`: the chain resolves in two links before the
log runs out of evidence — "deploys fail → the runner can't pull the base
image → the registry credential expired" — and stops there per the
framework's own rule, not padded to five links. `root_candidate` is the
expired credential; `uncertainties` notes whether rotation was ever
automated. Emit the six core fields plus one `five_whys` block. Nothing
else — the input was a two-line problem with one log, and the output
stays that size.

**Human-named — the human already picked**

Input: `/reasoning:problem-solving pdca "Increasing the checkout timeout
from 5s to 15s should cut cart-abandonment errors without hiding real
outages."`

`pdca` is named, so it runs — no shortlist, no confirmation. Open
`frameworks/pdca.md`: `hypothesis` is the claim as given; `test` is the
timeout change; `metric` is cart-abandonment-error rate against p99
checkout latency, both to be watched post-change. No test has actually run
yet, so `actual` stays empty and the output says plainly that the cycle
isn't closed — `next` names what running the test would take, not a result
that hasn't happened. Emit the six core fields plus one `pdca` block.
