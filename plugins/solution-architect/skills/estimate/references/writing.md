# Writing — inputs shape, deliverable skeleton, contract, pipeline

Read while writing `estimation-inputs.json` and again while writing
`estimation.md`. Defines the inputs shape by pointing at the canonical
fixture, the two-part skeleton the deliverable must follow, the contract
rules the validator enforces against that skeleton, where the files live,
and the exact command sequence from computed numbers to a served page.

## 1. `estimation-inputs.json` shape

Do not re-derive the shape from prose — read
`scripts/test/fixtures/booking-inputs.json` and match it field for field:
top-level `project`, `technique`, `depth`, `calibration`, `verificationPct`,
`exposeRatesToClient`, `features` (each with `id`, `name`, `provenance`,
`tasks`), `risks`, and `assumptions`. Every task carries `id`, `name`,
`category`, `o`, `m`, `p`, `confidence`, `assumptions`, `provenance`.

Add top-level `deliveryMode` — `"agentic"` or `"traditional"` — on every
estimate you write, even though the field is optional and the booking fixture
omits it. The interview defaults to agentic (`interview.md` §2b) while an
absent field still reads as traditional, so leaving it out would record the
opposite of what was agreed. The fixture keeps its silence on purpose: it is
the traditional path's regression guard.

At `STANDARD`/`DEEP` every feature also carries `scores` — one entry per
factor `tech`, `size`, `deps`, `unc`, `risk`, each `{ "n": 1–5, "anchor":
"<the scoring-guide.md sentence for that factor and score, verbatim>",
"cite": "<the evidence it rests on>" }` — a `scoreNote` (one plain sentence
for a non-technical reader: no file names, factor names or `§`) and a
`scoreProvenance` of `stated` or `proposed`. `schema.mjs` checks the anchor
against the guide byte for byte. At `QUICK` these fields must be absent.

At `STANDARD`/`DEEP`, non-agentic estimates also carry top-level
`contextLevels` and `contextProvenance` — the five factors from
`CONTEXT_FACTORS` in `project-price.mjs`: `codebaseMaturity`,
`stackFamiliarity`, `specQuality`, `compliance`, `clientDecisions`, each an
integer level 1–4 in `contextLevels`. `contextProvenance` carries one entry
per factor: `{ "level": <matching contextLevels>, "anchor": "...", "cite":
"...", "source": "derived"|"stated" }`. The `anchor` is the chosen level's
definition from the context-factor table in `scoring-guide.md`. Four of the five factors are derived
from upstream artifacts rather than asked, so each arrives as a proposal
with its evidence attached, not a silent default, and can be overridden in
review. `schema.mjs` refuses a factor missing from either object, or whose
`contextProvenance` level disagrees with `contextLevels`. Both fields are
skipped at `QUICK` depth and in agentic mode.

Optional top-level `recommendedReason` (non-empty string) — free text for
a judgment call worth explaining to the reader (why AGENTIC over
TRADITIONAL, why one technique over another, anything else worth a
sentence). The rendered page shows it verbatim under the summary figures as
"Approach: …" — not as a recommendation over other options, because there
are no other options to price. `schema.mjs` neither requires it nor
validates its content — nothing in `estimation-inputs.json` compares options
to generate it automatically, so write it only when there is a real call to
explain.
`schema.mjs` is the enforced half of this contract (`checkInputs`) — this
doc is the readable half; if the two ever disagree, the code wins.

At `depth: QUICK`, each feature's `tasks` array holds exactly one synthetic
task carrying the tiering technique's calibration band as its `o`/`m`/`p`
(mid = the band's midpoint) — see `references/techniques.md` §2. That keeps
`schema.mjs`'s at-least-one-task rule and `compute.mjs`'s PERT path
unchanged; QUICK never bypasses the compute pipeline. These calibration
bands feed task hours for delivery planning only — they never price
anything; QUICK's price fields stay absent regardless (`techniques.md` §2).

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

### Roadmap

(only when features carry milestones — omit the heading entirely otherwise)

| Milestone | Features | Share |
| --- | --- | --- |
| <label> | <feature names> | <share>% |

Bands are relative shares of total effort, not durations. This estimate
produces no timeline. Ordering: <stated|proposed>.

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

### Price

| Figure | Value |
| --- | --- |
| Presented range | <presentLow> – <presentHigh> |
| If a single number is required | <singleNumber> |
| Contingency rate | <contingencyRate> |
| Implied accuracy | <impliedAccuracy> |

### Calibration

State the band's implied rate: divide the tier's price midpoint by the
hours actually spent on a comparable delivered feature, and confirm that
blended rate is defensible. Recalibrate the bands against delivered
actuals roughly twice a year. Whatever AI leverage the team has is priced
into the bands already — it is never shown as a client-visible discount;
it becomes margin instead, and that is deliberate.
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
4. Estimation detail must contain a line matching `/calibration/i`.
5. The document must not contain a table with a `Scenario` column — the
   price block replaces it (`checkPrice` in `scripts/lib/checks.mjs`).
6. `computed.price.presentLow` and `presentHigh` must both appear in the
   document as formatted numbers (`Number.toLocaleString('en-US')`) — skipped
   when `computed.price.p50` is `0` (agentic deliverables carry no price).

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
15. The Roadmap section must contain a line matching `/relative shares/i`
    — the bands claim relative shares of effort, never durations.
16. Band numbers come from `computed.roadmap` — covered by the recompute
    rule 12, same as every other number.

Deep estimates (mirrors `checkDeepEstimates` in `scripts/lib/checks.mjs`):

17. A feature whose `computed.features[<id>].flag` starts with `Deep
    estimate` or `SPLIT` needs either a real task breakdown (two or more
    `inputs` `tasks` — one task is not a breakdown, and every feature
    already has one) or a `deepEstimateWaiver` — a non-empty string
    naming why the band price stands without one (`schema.mjs` refuses a
    bare `true`). Neither present is refused.

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
- **Risks table** — `### Risks`, required in the agentic template (mirror
  `agentic-estimation-pass.md` §Risks): `Risk | Probability | Impact (min) |
  Reason`. Every row needs all four cells — `schema.mjs` requires `reason`
  on agentic risks specifically. Team mode's own §2 skeleton carries no
  equivalent section today; `risks` is a required top-level input either
  way (§1), but nothing requires `reason` on a team-mode risk, and nothing
  requires team mode's `estimation.md` to surface the risk register at all.
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
