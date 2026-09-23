# Validation — what gets checked, and what has actually been checked

Read when electing `validation-plan.md`, and again before writing it. The
companion answers one question the spine cannot: which claims in this document
are load-bearing, and how would anyone find out they are wrong.

## 1. Election

Elect it when §13 has a `must` row, or when a decision in `docs/adr/` rests on a
number nobody has measured. Refuse it — with a reason, like every companion —
when the set has neither. "No critical claims to check yet" is an honest reason
on a §13 that is still all `should`.

## 2. A check per critical claim

One row per claim that would change the design if it turned out false. Not one
per requirement, and not one per component.

| claim | method | condition | threshold | status | src |
|---|---|---|---|---|---|
| p99 checkout 200 ms at 400 concurrent carts | load test | staging, production-shaped data | 200 ms | planned | stated |
| worker crash loses no accepted job | fault injection | one worker killed mid-job | zero lost | planned | assumed |

Pick the method honestly. A load test, a fault-injection run, a spike, a
review and a monitor in production are different instruments with different
strengths, and naming a heavier one than will really run is its own false
claim. Where a claim cannot be checked before delivery, say that and say what
would check it afterwards.

## 3. Planned is not passed

`status` is `planned` until something has actually run. **A planned check is
never reported as passed**, never rendered as a tick, and never summarised into
a readiness statement that implies it.

Evidence replaces a plan only when it carries all four:

- **result** — what the run produced, not what it was supposed to produce
- **environment** — where it ran, and how that differs from production
- **date** — when, so staleness is visible
- **artifact** — where the output lives

Evidence missing any of the four is still `planned`. Evidence older than the
revision it describes is `stale`, and stale evidence stays on the page — a
check that used to pass is information, and deleting it is how a regression
becomes invisible.

A failed check stays visible too. Removing it and re-running until green is
falsification of the record, not validation of the system.

## 4. The rows are work

Every row is a task somebody performs: building the harness, shaping the data,
running it, reading the result. Priced with the build, it is a line item.
Discovered after the contract, it is a surprise.

So the plan is an input to the `estimate` skill, not only a record for the
reader. Write it in enough detail that someone sizing the project can tell a
one-afternoon spike from a fortnight of load-test infrastructure.

## 5. Coverage, honestly

Report critical claims with a check against critical claims in scope — the
numerator and the denominator, never the percentage alone. Where the
denominator is zero, report **not applicable**; a system with no critical
claims has not achieved 100% coverage.

Never improve the ratio by narrowing what counts as critical.
