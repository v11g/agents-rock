# Reporting — findings, ratios, one verdict

## 1. Finding shape

```
[<severity>] <what is wrong>
        — affected: <section or ADR id>
        — evidence: <file, and the line or row that shows it>
        — fix: <the action, not the outcome>
```

| severity | means |
|---|---|
| `blocker` | the design cannot proceed on this — an `assumed` must-target, acceptance inferred from silence |
| `major` | likely rework if it stands — a strawman comparison, a claim with no mechanism |
| `minor` | clarity or completeness — an undated source, a thin reason |

"Fix" names an action somebody can take. *"Make §13 measurable"* is a restatement;
*"ask the client for the peak concurrent figure, or mark the row `should`"* is a fix.

Mark separately any **assumption that invalidates the design if wrong**. It may
carry any severity and still be the most important line in the report.

## 2. Ratios

From `node scripts/coverage.mjs`, never counted by hand. Always print numerator
and denominator:

| ratio | reads |
|---|---|
| design coverage | §13 `must` rows answered by a decision ÷ §13 `must` rows |
| validation coverage | §13 `must` rows with a plan row ÷ §13 `must` rows |
| executed evidence | plan rows carrying all four evidence fields ÷ plan rows |
| decision traceability | ADRs naming a target that resolves ÷ ADRs |

A zero denominator reports **not applicable**. A system with no `must` rows has
not achieved 100% design coverage, and printing 100% there is the exact
dishonesty this report exists to catch.

List deferred and excluded items separately rather than removing them from the
denominator.

## 3. Verdict — exactly one

| verdict | when |
|---|---|
| **Exploratory** | material context or design choices unresolved; any `blocker` open |
| **Design-reviewable** | coherent proposal, traceable, gaps disclosed rather than hidden |
| **Accepted for implementation** | required decisions accepted by a named person on a date, blockers resolved or explicitly dispositioned |

The verdict describes the **document**, not the system.

## 4. Validation, stated separately

Never folded into the verdict:

- `not executed` — nothing has run
- `partially evidenced` — some checks carry evidence, named
- `required checks passed for the stated revision and environment` — and name
  both

A Design-reviewable document with `not executed` validation is a normal, honest
state. Implying otherwise in either direction is a finding against this report.

## 5. The report

`review-report.md` beside `ARCHITECTURE.md`:

```markdown
# Review — <name>

Reviewed <docVersion> · <updated> · <today>

## Verdict
<one level> · validation: <one state>

## Findings
<blockers, then majors, then minors>

## Coverage
<four ratios, numerator and denominator>

## Nothing to check
<each skipped gate and why>
```

The revision stamp is not decoration. Without it a reader cannot tell whether
the review still describes the document in front of them, and a stale review
reads exactly like a current one.
