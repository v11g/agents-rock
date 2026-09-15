# Writing — inputs shape, deliverable skeleton, contract, pipeline

Read while writing `estimation-inputs.json` and again while writing
`estimation.md`. Defines the inputs shape by pointing at the canonical
fixture, the two-part skeleton the deliverable must follow, the contract
rules the validator enforces against that skeleton, where the files live,
and the exact command sequence from computed numbers to a served page.

## 1. `estimation-inputs.json` shape

Do not re-derive the shape from prose — read
`scripts/test/fixtures/booking-inputs.json` and match it field for field:
top-level `project`, `technique`, `depth`, `calibration`, `overheadPct`,
`verificationPct`, `exposeRatesToClient`, `features` (each with `id`, `name`,
`provenance`, `tasks`), `risks`, `assumptions`, `scenarios`, and
`recommendedScenario`. Every task carries `id`, `name`, `category`, `o`,
`m`, `p`, `confidence`, `assumptions`, `provenance`.

At `STANDARD`/`DEEP` every feature also carries `scores` — one entry per
factor `tech`, `size`, `deps`, `unc`, `risk`, each `{ "n": 1–5, "anchor":
"<the scoring-guide.md sentence for that factor and score, verbatim>",
"cite": "<the evidence it rests on>" }` — a `scoreNote` (one plain sentence
for a non-technical reader: no file names, factor names or `§`) and a
`scoreProvenance` of `stated` or `proposed`. `schema.mjs` checks the anchor
against the guide byte for byte. At `QUICK` these fields must be absent.

Optional top-level `recommendedReason` (non-empty string) says why the
recommended scenario wins when several are compared. `schema.mjs` is the
enforced half of this contract (`checkInputs`) — this doc is the readable
half; if the two ever disagree, the code wins.

At `depth: QUICK`, each feature's `tasks` array holds exactly one synthetic
task carrying the tiering technique's calibration band as its `o`/`m`/`p`
(mid = the band's midpoint) — see `references/techniques.md` §2. That keeps
`schema.mjs`'s at-least-one-task rule and `compute.mjs`'s PERT path
unchanged; QUICK never bypasses the compute pipeline.

Features may each carry an optional `milestone` string (e.g. `"M1 - Booking
core"`). Milestones are all-or-nothing: if any feature has one, every feature
must, or `schema.mjs` refuses the inputs. Features sharing a label form one
milestone; label order of first appearance in `features` = delivery order.

Inputs may also carry a top-level `components` roster (each entry `id`,
`name`, optional `parent` naming a top-level entry — two levels max, C4
container → component — and optional `notEstimated: "<reason>"`). Components
are all-or-nothing like milestones: when the roster exists, every feature
carries a `component` that resolves to a roster id. Every leaf entry must be
covered by at least one feature or carry a `notEstimated` reason —
`schema.mjs` refuses an uncovered component, because a component in the
architecture with no planned work is a scope hole, not an omission to paper
over.

## 2. `estimation.md` — two-part skeleton

Mirror `scripts/test/fixtures/estimation-pass.md` exactly. Two top-level
sections, in this order:

```markdown
# <Project> — Estimation

## Summary

| Feature | Tier | Range (h) | src |
| --- | --- | --- | --- |
| <feature name> | S/M/L | <low>–<high> | stated|proposed |

Recommended delivery: <team + AI-assisted summary> — see detail.

| Line | Hours |
| --- | --- |
| Development | <hours> |
| Overhead (<pct>%) | <hours> |
| Risk buffer | <hours> |
| Estimate-spread buffer | <hours> |

### Roadmap

(only when features carry milestones — omit the heading entirely otherwise)

| Milestone | Features | Months (from start) |
| --- | --- | --- |
| <label> | <feature names> | <start>–<end> |

Sequential delivery by the recommended scenario team. Bands are relative
months, not calendar dates. Ordering: <stated|proposed>.

### Assumptions

| Assumption | Impact if wrong |
| --- | --- |
| <text> | <impactIfWrong> |

### Out of scope

- <explicitly excluded item>

## Estimation detail

Technique: <technique name> — <one line on why>.

| Task | Category | O/M/P | E (h) | Confidence | Assumptions | src |
| --- | --- | --- | --- | --- | --- | --- |
| <task name> | boilerplate|logic|novel | <o>/<m>/<p> | <e> | HIGH|MED|LOW | <text or "none"> | observed|stated|researched|proposed |

### Scenario comparison

| Scenario | Team | AI-assisted | Months | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| <scenario id> | <team summary> | yes|no | <months> | <cost> | <"recommended" or "—"> |

### Calibration

Tier hour bands used: <bands> (state whether these are the org's own
history or the S 20-60h / M 60-160h / L 160-400h defaults).
```

## 3. Contract rules

These mirror `scripts/lib/checks.mjs` exactly — the validator enforces every
line below, so a doc that satisfies this list passes `validate.mjs` by
construction.

Structure:

1. `## Summary` and `## Estimation detail` headings must both exist.
2. Summary must contain an `### Out of scope` heading.
3. Summary must contain an `### Assumptions` heading whose table has at
   least one row.
4. Summary must contain a line item matching `/buffer/i` (the buffer table
   row above).
5. Estimation detail must contain a table with a `Scenario` column and at
   least 1 row.
6. Estimation detail must contain a line matching `/calibration/i`.

Row-level, on the task table (found by header, needs `Task`, `Confidence`,
`Assumptions`, `src` columns):

7. No cell is the bare string `0` — write **"not estimated"** instead of a
   zero when a number genuinely isn't known yet.
8. `src` is one of `observed | stated | researched | proposed`.
9. `Confidence` is one of `HIGH | MED | LOW`.
10. `Assumptions` is never blank — write the literal **"none"** when there
    are none.

Row-level, on the Summary's feature/tier table (the table with an `src`
column but no `Task` column):

11. `src` is `stated` or `proposed` only — this table is the clear-vs-assumed
    split itself, so it does not carry the full four-word provenance
    vocabulary.

11b. At `STANDARD`/`DEEP` the scope table has a `Tier` column and every
    row's Tier must match `computed.features[<id>].tier` (the letter the
    scores produced — `scoring-checks.mjs`). At `QUICK` the Tier cell is
    the agent's own call, unchecked.

JSON-side (checked against `estimation.json`, not the prose):

12. The `computed` block must equal a fresh recompute of `computed` from
    `inputs` — never hand-edit numbers into the JSON after `compute.mjs` has
    run.
13. Every feature's `low < hours < high` strictly (equal only in the
    degenerate all-equal case) — a feature where that ordering breaks means
    the PERT inputs for its tasks are inconsistent.

Roadmap (mirrors `checkRoadmap` in `scripts/lib/checks.mjs`):

14. Inputs carry milestones → Summary must contain a `### Roadmap` heading
    with a table of at least one row; no milestones → the heading must be
    absent.
15. The Roadmap section must contain a line matching `/not calendar dates/i`
    — the bands claim sequence and rough size, never dates.
16. Band numbers come from
    `computed.scenarios[recommendedScenario].roadmap` — covered by the
    recompute rule 12, same as every other number.

## 3b. Agentic deliverable additions

When `deliveryMode: "agentic"`, `estimation.md` follows the same two-part
skeleton with these additions (mirror
`scripts/test/fixtures/agentic-estimation-pass.md` exactly):

- **Summary header line** — immediately under `## Summary`, before the
  feature table: `Delivery: agentic (<agent> + <model>) · Baselines: <N>
  measurements, <K> shapes matched`. `agenticFindings` in
  `lib/agentic-checks.mjs` refuses a deliverable missing this line.
- **Estimation detail task table** — agentic columns replace the
  traditional PERT columns: `Task | Baseline (min) | Samples | Match |
  Confidence | Assumptions | src`. A zero-sample task writes **"not
  estimated"** in the Baseline column and `UNCALIBRATED` in Confidence — a
  zero-sample row rendered with any other confidence label is refused.
- **`### Evidence` section** — a table of `Id | Task | Actual (min)` rows,
  one per matched historical measurement actually cited. Every row's id AND
  Actual (min) value must match `estimation.json`'s
  `computed.tasks[*].evidence` — the validator refuses an evidence row whose
  id isn't script-matched, or whose minutes cell doesn't match the matched
  record, so never invent, hand-add, or alter a history row.
- **Risks table** — same section as team mode, but the Impact column is in
  minutes with an added Reason column: `Risk | Probability | Impact (min) |
  Reason`. Every risk row needs all four cells; a generic buffer with no
  reason is refused the same as in team mode.
- **Calibration nudge** — when any task is UNCALIBRATED or low-sample, the
  detail section's calibration line should point at recording actuals to
  close the loop (see `docs/requirements/record-task.md` — the capture
  skill that will fill the dataset is designed but not yet built; do not
  describe it as available functionality).

## 4. File placement

Two modes:

- **Companion mode** — the project already has (or is getting)
  `ARCHITECTURE.md` from the `analyze-requirements` skill. `estimation-inputs.json`,
  `estimation.json`, and `estimation.md` live beside `ARCHITECTURE.md`.
  Flip the `estimation` entry in `ARCHITECTURE.md`'s frontmatter
  `electedDocs` to `elected: true` (dropping any `reason` that justified
  leaving it un-elected) — see `analyze-requirements/references/writing.md` for the
  `electedDocs` convention.
- **Standalone mode** — no `ARCHITECTURE.md`, or the user wants estimation
  only. Files live under `docs/estimate/` at the project root instead.

## 5. Command sequence

Run from the skill's own directory (`plugins/solution-architect/skills/estimate/`).
`<dir>` is the placement chosen in §4 — the companion location or
`docs/estimate/`.

```
node scripts/compute.mjs --inputs <dir>/estimation-inputs.json --out <dir>/estimation.json
```

Write `<dir>/estimation.md` by hand, following the §2 skeleton, then:

```
node scripts/validate.mjs --md <dir>/estimation.md --json <dir>/estimation.json
node scripts/render.mjs --json <dir>/estimation.json --md <dir>/estimation.md --out <dir>/dist/
node ../analyze-requirements/scripts/serve.mjs <dir>/
```

`<dir>/dist/` is the one rendered-pages folder — the analyze-requirements viewer
renders into it too. When a rendered viewer exists, add `--viewer index.html`:
index.html and estimate.html then ship as one self-contained folder, and the
viewer's estimation tab links the copy inside it (it falls back to an
estimate.html beside estimation.md).

`render.mjs` runs the same `checkDeliverables` validation `validate.mjs`
runs and **refuses to write `estimate.html` on any finding** — running
`validate.mjs` first is a convenience for a readable error, not a separate
gate `render.mjs` trusts you to have passed.

## 6. The one rule that matters most

**Never write a number into `estimation.md` that is not present in
`estimation.json`.** Every hour, every cost, every tier band in the prose
must trace to a field `compute.mjs` produced. If a number you want to write
doesn't exist in the JSON yet, that means `estimation-inputs.json` is
missing something — fix the inputs and recompute, don't hand-calculate a
number to fill the gap.
