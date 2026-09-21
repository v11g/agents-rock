# PDCA

## When it fits

A change with a measurable hypothesis.

## Process

You are executing the PDCA framework within the problem-solving skill.
Work through four stages, each with named parts:

**Plan**
- `hypothesis` — the specific claim being tested, stated so it can be
  shown false.
- `test` — what will be done to test it.
- `metric` — the specific, named measurement that will decide the
  outcome.
- `expected` — the result that would confirm the hypothesis.

**Do**
- Carry out the test as planned. Record what actually happened, not a
  restatement of the plan.

**Check**
- `actual` — the measured result, against the `metric` defined in Plan.
- Compare `actual` to `expected` directly; state whether the hypothesis
  held.

**Act**
- `next` — what happens as a result: adopt, adjust, or abandon the
  change, and what runs next.

If this is an analysis-only run — no test has actually been carried out —
leave `actual` empty rather than inventing a plausible result, and say
explicitly in the output that the cycle is not yet closed. `next` in that
case names what running the test would take, not a result that hasn't
happened.

## Output block

Emit the `pdca` block from `references/contract.md`, with fields
`hypothesis`, `test`, `metric`, `expected`, `actual`, `next`.

## Stop when

Metric, expected result, and next action are defined.
