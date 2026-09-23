# review-architecture

Reads a finished architecture package and reports what is wrong with it. It
writes `review-report.md` and nothing else — never into the documents it
reviews.

## What it is for

`analyze-requirements` runs `validate.mjs` before anything renders, so a
published set already has its `src` columns, its links resolve, and its prose
agrees with its model. None of that says whether the targets are measurable,
whether the rejected options were ever real, or whether anybody agreed to the
decisions.

Those are the questions a reader asks and a script cannot. This skill asks them.

## What it needs

`ARCHITECTURE.md`. Everything else is read when present and changes what can be
checked rather than whether the review runs:

| present | unlocks |
|---|---|
| `docs/adr/` | decision quality, trace integrity, decision traceability |
| `validation-plan.md` | validation honesty, evidence and validation coverage |
| `model.json` | section-against-model disagreement |

A gate with nothing to inspect reports **nothing to check**, with the reason. It
never reports a pass.

## What you get

```
review-report.md
├── Verdict          Exploratory | Design-reviewable | Accepted for implementation
│                    validation stated separately, never folded in
├── Findings         blocker / major / minor, each with evidence and a fix
├── Coverage         four ratios, numerator and denominator, from coverage.mjs
└── Nothing to check  each skipped gate and why
```

Stamped with the revision it reviewed, because a stale review reads exactly like
a current one.

## Independence

The writer cannot grade the writer. Run it in a session of its own. If a package
was produced in the current context, the skill dispatches a subagent that gets
the file paths and the gate charter — no interview memory, no knowledge of what
the author meant.

## Counting

Four ratios come from `node scripts/coverage.mjs --arch <path> --adr <dir>
[--plan <path>]`, never from the agent counting rows. A zero denominator prints
**not applicable**; a system with no `must` rows has not achieved 100% coverage.

Matching a §13 row to an ADR relies on the ADR quoting the row's `measure`
verbatim, which is the convention `analyze-requirements`
`references/decisions.md` sets. §13 has no id column, so that string is the only
handle the two documents share.
