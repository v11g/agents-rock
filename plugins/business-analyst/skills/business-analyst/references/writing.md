# Writing the requirements package

Two artifacts, always together, in the lead directory:

- `requirements.md` — the human document. Five parts (below).
- `requirements.json` — the machine handoff downstream skills read.

The canonical json shape is `scripts/test/fixtures/requirements-pass.json` —
copy its structure exactly; the validator enforces it. `schemaVersion` is
`"1.0"`; bump only on a breaking shape change. Workflow scope mode:
`scripts/test/fixtures/requirements-workflow-pass.json` adds `scopeMode`,
`mapLabel`, `systems`, `features`, and `label`/`source`/`steps`/`branches`
(`replaces`, `sub` optional) on to-be workflows.

## ID conventions

| Prefix | Register | Prefix | Register |
| --- | --- | --- | --- |
| G- | goals (context.goals) | NFR- | non-functional requirements |
| ACT- | actors | INT- | integrations |
| WF- | workflows | DAT- | data entities |
| FR- | functional requirements | CON- | constraints (hard limits) |
| BR- | business rules | ASM- | assumptions (unverified beliefs) |
| SC- | scenarios | Q- | open questions |
| SYS- | systems (workflow mode) | CONFLICT- | contradictions |
| FEAT- | features (workflow mode) | | |

Three digits, zero-padded (`FR-001`). IDs are stable: never renumber on
re-run; retired items keep their id with a note rather than vanishing.

Constraint vs assumption: a constraint is a confirmed boundary ("must run in
the client's M365 tenant"); an assumption is an unverified belief ("managers
authenticate through Entra"). Never file one as the other.

## Label discipline

Every requirement, NFR, integration and data row carries
`label: confirmed | assumed | recommended` and (where the schema asks) a
`source`. Recommendations never render as confirmed requirements; a
`recommended` item in scope `in` must have an open question referencing it
(the validator enforces this).

## Ambiguous terms — banned in requirement text

fast, quick, easy, simple, user-friendly, intuitive, flexible, robust,
seamless, efficient, optimal, appropriate, various, etc, some, many,
several, as needed.

Replace with a measurable statement: not "the search must be fast" but
"search results return within 2 seconds for 10,000 records". This list is
mirrored in `scripts/lib/checks.mjs` (`AMBIGUOUS`) — change both together.

## requirements.md structure

Frontmatter (must match the json — the validator checks status and readiness):

```yaml
---
lead: <lead-id>
status: <status enum>
depth: QUICK | STANDARD | DEEP
updated: YYYY-MM-DD
readiness: <overall number>
---
```

- **Part 1 — Discovery Brief**: problem, goals table (id, goal, metric),
  one benefit hypothesis per goal ("we believe *capability* will result in
  *outcome*, measured by *metric*"), stakeholders (add a power-interest
  table when more than 3 stakeholder groups), pain points, constraints.
- **Part 2 — Process & Domain**: as-is workflows (mermaid flowchart when a
  workflow has more than one actor), decision points, business-rules table
  with concrete examples, exceptions, to-be capabilities, glossary of
  domain terms. Workflow mode: no to-be capabilities prose — the To-be
  scope section written by `scripts/scope.mjs` replaces it (systems table,
  then per system its workflows as mermaid and a feature table; no ids;
  ⚠ on drafted items). Frontmatter gains `scopeMode: workflow`.
- **Part 3 — Requirements**: scope (out / future / unconfirmed — in-scope
  is the FR table itself), actors and permissions, FR table (id, text,
  label, scope; workflow mode adds a last `Feature` column — the feature
  name(s) holding the FR, `—` when none; header starts
  `| ID | Requirement |`, which the validator looks for), NFRs, data,
  integrations, dependencies.
- **Part 4 — Acceptance Scenarios**: per critical FR a given/when/then
  table; input → expected tables for rule-heavy requirements.
- **Part 5 — Readiness Report**: readiness per area and overall, open
  questions register, assumptions register, conflicts register,
  architecture blockers. Registers live HERE only — other parts reference
  ids (one home per fact).

Section headings must be exactly `## Part N — <title>` — the validator
matches on `## Part N`.

Depth scaling: QUICK writes Parts 1, 3 (slim) and 5 only; STANDARD all
five; DEEP all five plus example-mapping tables and full scenario coverage.

## Honest absences

An unknown renders as an honest absence — "Not provided — asked, awaiting
client", "Not applicable — <reason>" — never `[TODO]`, `TBD`, `XXX`, never
an invented value. The validator refuses placeholders.

## Readiness scoring

You judge each area score (0–100) and justify it in Part 5 prose. The
script recomputes `overall` as the rounded mean and refuses a mismatch.
Status rules the validator enforces:

- open question with `architectureBlocker: true` → status at most `ANALYZED`;
- `READY_FOR_ARCHITECTURE` requires no unconfirmed high-impact assumptions
  and no open conflicts;
- every open architecture blocker appears in `readiness.blockers`.
