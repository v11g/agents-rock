# Gates — the seven passes, in order

Each gate states what it inspects and what a failure looks like. Work them in
order: a G2 failure changes what G3 means, because a decision cannot be judged
against a driver nobody made measurable.

A gate with nothing to inspect reports **nothing to check**, with the reason.
It never reports a pass. An empty §13 has not passed driver clarity.

## 0. Independence

The writer cannot grade the writer. If the package was produced in this same
context, dispatch one general-purpose subagent with **only** the file paths and
this file — no interview memory, no knowledge of what the author meant. It must
read the document the way its reader will, and return findings, not rewrites.

Reviewing a package from a previous session, or one somebody else wrote, needs
no subagent.

## G1 — Input integrity

`validate.mjs` has already checked that every row carries a `src` value from the
closed vocabulary. This gate asks whether the value is **true**.

- A `stated` fact with no interview or source behind it.
- A `proposed` that is really `assumed` — a number the document invented, dressed
  as a recommendation. The distinction is defined in `analyze-requirements`
  `references/writing.md` §3.
- A `researched` with a bracketed source that does not support the claim, or
  carries no date where the fact can go stale.
- Contradictions between two sections left unreconciled rather than named.

## G2 — Driver clarity

§13 is the gate's whole subject.

- A `scenario` cell with no conditions in it. "Checkout is fast" and "checkout
  submit → responds quickly" are the same claim; both fail.
- A `must` row whose target is `assumed`. This is a **blocker**, not a major —
  the design has no acceptance criterion.
- A `must` row with no measure, or a measure nothing could observe.
- More than about seven characteristics, none identified as driving. Ask which
  three the structure was actually designed for.
- Cost or simplicity listed beside scale, elasticity and fault tolerance with no
  conflict named — the trade is real and the document has hidden it.

## G3 — Decision quality

Every file in `docs/adr/`. The rules are `analyze-requirements`
`references/decisions.md`; this gate is where they are enforced.

- Fewer than two credible options, with no constraint named as the eliminator.
- A strawman: an option no reader would have chosen, or two options failing the
  same constraint so neither could have won.
- A hard constraint applied inside the comparison instead of before it.
- A claim with no mechanism — "async makes it reliable", "add a cache". The
  catalogue is in `references/decision-rules.md`.
- Technology costs blended into one number instead of build, operate,
  infrastructure and switching.
- A product named where a class would do, with no §13 quality forcing it.
- No revisit trigger.
- `accepted` with no named decision-maker and date. Acceptance inferred from
  silence is a **blocker**.

## G4 — Coverage

- An applicable section left empty rather than carrying `Not applicable —
  <reason>`.
- A `Not applicable` whose reason does not survive reading — §12 Security marked
  not applicable on a system §9 shows handling payment data.
- Sections that disagree: §6 naming a component absent from §5's views, §10
  describing environments §11 never configures.
- A failure path in §7 with no component owning it.

## G5 — Trace integrity

- An ADR whose `addresses` target does not exist — a §2 constraint, §13 row or
  §15 risk that was renamed or deleted.
- A §13 `must` row no decision or component answers.
- A decision whose driver changed after it was accepted.
- Cycles in `supersedes`. Dependency cycles between components are reported for
  discussion, not auto-failed; real systems have them.

## G6 — Validation honesty

Skip with **nothing to check** when no `validation-plan.md` exists — and say so,
because a package with `must` rows and no plan is itself a G2 finding.

- A `planned` row reported, summarised or rendered as though it passed.
- Evidence missing any of result, environment, date or artifact.
- Evidence older than the revision it describes, presented as current.
- A failed or stale check deleted rather than left visible.
- Coverage improved by narrowing what counts as critical.

## G7 — Handoff readiness

- Decisions at `proposed` with nobody named to accept them.
- A §15 risk with no owner and no mitigation.
- An open question with no owner and no date.
- A dependency on another team stated nowhere they would see it.
