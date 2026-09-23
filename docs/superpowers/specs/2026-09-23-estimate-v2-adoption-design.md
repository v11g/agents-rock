# Estimate v2 adoption — design

Date: 2026-09-23
Status: proposed
Scope: `plugins/solution-architect/skills/estimate`, `plugins/solution-architect/skills/proposal`

## 1. Problem

The `estimate` skill prices work by counting hours and multiplying by rates:
PERT per task, seniority scaling, per-category AI reduction, team capacity,
months, `rate × 140h`. The spreadsheet it exports is a scoring worksheet that
carries no money of its own.

`Estimator_v2.xlsx` is a different instrument. It prices from five weighted
scores, scales the result by five project-wide context factors, adds eight
named overhead lines, adds contingency, and presents a statistical range. It
produces the whole number by itself.

The team's commercial model is fixed-price packages. The client buys a
package; team size and schedule are decided afterwards, internally. Hours,
rates and months therefore price nothing the client ever sees.

## 2. Decision

Adopt v2's pricing model. Retire the hours-to-money conversion. Keep the
task-level machinery for delivery planning, where it still earns its place.

The two models stop competing and become the two halves v2 itself describes:
v2's own How to Use sheet says a feature that matters enough to get right
should leave the ballpark sheet and go to a "companion FEATURE DEEP
ESTIMATOR". The skill's PERT task breakdown is that companion.

| | Job | Produces |
|---|---|---|
| v2 scores + roll-up | price the package | the number the client pays |
| PERT tasks + milestones | plan the delivery | ordering, relative size |
| v2's flag column | the handoff | which features need the deep pass |

## 3. Pricing model

Per feature, on the Ballpark Estimator sheet:

```
weighted score = SUMPRODUCT(scores, weights) × 5          weights 20/10/20/30/20
tier           = band containing the weighted score        5–11.5 / 11.5–17.5
                                                           17.5–22.5 / 22.5–25
point estimate = linear interpolation inside the band      bands are continuous:
                                                           each band's price low
                                                           equals the one below's
                                                           price high
spread         = 0.15 + 0.07 × (unc − 1) + 0.03 × (risk − 1)
low / high     = point × (1 ∓ spread)
```

Then once, on the Project Roll-up sheet:

```
context multiplier = 1 + Σ(factor deviations)              capped at 2.50
adjusted base      = Σ point estimates × context multiplier
non-feature work   = base × 62%                            8 named lines, below
contingency rate   = 5% + 2% × avg uncertainty + 2% × avg risk
P50                = base + non-feature + contingency
1σ (build only)    = √(Σ (point × spread)²)
1σ (project)       = 1σ_build × P50 / Σ point estimates
P20 / P80 / P95    = P50 ∓ 0.84σ, +0.84σ, +1.645σ
presented range    = CEILING(P50, 500) … CEILING(P95, 500)
single number      = CEILING(P80, 500)
```

The eight overhead lines: shared foundation 12%, project management 10%, UX/UI
8%, QA/UAT 8%, discovery 6%, DevOps 5%, documentation 3%, cross-feature
integration 2% per feature capped at 25%.

Worked on the workbook's own five sample features:

```
feature points                       16,212
  × context 1.40                 →   22,696
  + overheads 62%                →  +14,072
  + contingency 15.8%            →   +5,809
                                     ───────
  P50                                42,577
  P80                                50,332     ← the single number, if forced
  presented range                    43,000 – 58,000
  implied accuracy                   ±21.7%     ← above 30% ⇒ sell discovery
```

### Rate calibration

The bands encode an assumed blended rate. Per v2's Tier Reference: divide a
band midpoint by hours actually spent on a comparable delivered feature and
confirm the implied rate is defensible. Recalibrate twice a year. Whatever AI
leverage the team has is priced into the bands, not shown as a line item —
it becomes margin rather than a client-visible discount. This is deliberate.

## 4. Removed

All of these existed only to turn hours into money or months. With both gone,
they have no remaining job — and the four places where the two models
described the same concept dissolve with them.

| Removed | Was |
|---|---|
| `SENIORITY_FACTOR`, team rates | hours → money |
| Scenarios (`team × aiAssisted`) | varied cost and months only |
| `HOURS_PER_MONTH`, `effectiveCapacity`, `COORDINATION_TAX` | hours → months |
| `scenarioRollup`, `laborCost`, `toolingCost`, `totalCost` | the price |
| `overheadPct` (flat 35% on hours) | superseded by v2's 8 lines = 62% |
| `riskBufferHours` as a price input | superseded by v2's contingency |
| `projectBuffer` (√Σσ²) as a price input | superseded by v2's spread |
| `toolingCostPerSeat` | priced per seat per month |

The risk register itself stays — it is still content for the proposal and for
`estimation.md`. Only its conversion into buffer hours goes.

`scenario-schema.mjs` currently enforces `rate must be a positive number` per
team member. Team and rates leave `estimation-inputs.json` entirely.

## 5. Retained

PERT (`o/m/p → e, σ`), the task register with confidence and assumptions,
feature scores and tiers, components, the risk register, milestones, and both
generated workbook tabs.

`TIER_BREAKS`/`tierFor` change shape: from four score ceilings to four bands
carrying start, end, price low and price high, with weighted scoring and
interpolation. Consumers to update: `scoring.mjs`, `score-csv.mjs`,
`score-html.mjs` (which inlines them into the review page),
`scores-review-template.html`, `estimate-math.test.mjs`,
`references.test.mjs`, and the tier claim in `references/techniques.md`.

`CATEGORY` on the Task Breakdown tab becomes descriptive. It no longer drives
a price, because nothing converts hours to money. Keep the column — it is
still planning signal — but hard rule 4 (no blanket AI multipliers) now
describes machinery that affects nothing. Reword it rather than delete it:
v2 answers the same concern with the 10% size / 30% uncertainty weights.

## 6. Timeline

Milestones keep ordering and relative size; they lose absolute duration.

Seniority and the verification percentage **cancel exactly** out of the band
ratios, because both are uniform multipliers:

```
band share = (e × S) / Σ(e × S) = e / Σe
```

So dropping them does not move a milestone boundary. What does change is the
per-category AI reduction, which is not uniform — a boilerplate-heavy
milestone shrinks against an algorithm-heavy one. On the booking fixture that
shift is 77/23 → 75/25, two percentage points. Not worth retaining scenarios
for. Milestone shares are therefore computed from raw PERT `e`.

`roadmapBands` loses its `months` argument and returns fractional shares.
`roadmapFor` returns `{ milestone, features, share }` instead of
`startMonths`/`endMonths`. It also moves out of `scenarioBlock`, which no
longer exists, and is computed once from the task register.

No part of the estimate answers "how long" or "how many people" any more.
That is the intended boundary, not a gap: those are internal delivery
decisions made after the package is sold.

## 7. The five context factors

Three arrive from upstream artifacts. One is derived. One is asked.

| Factor | Source | Mode |
|---|---|---|
| Specification quality | BA `readiness` score + status + Part 4 acceptance scenarios | derived |
| Compliance & data sensitivity | BA layer 8 NFRs, layer 9 sensitivity; AR §8 PII column, §2 Constraints | derived |
| Client decision structure | BA layer 2 — deciders, approvers, power-interest table | derived |
| Codebase maturity | AR `mode`, §3 Project Structure, §11 testing strategy, §15 Risks & Technical Debt | derived |
| Stack & domain familiarity | interview — nothing upstream can know it | asked |

`mode: greenfield` **is** level 1 exactly. Only brownfield requires a judgment
between levels 2, 3 and 4 (×1.10 / ×1.20 / ×1.45 — a 32% swing).

Stack familiarity is a fact about the delivery team's history, not about the
client's system, so no upstream document contains it. AR §6's tech column does
supply the stack, which makes the question a pick-list rather than open-ended:

```
Detected stack: React, Node, Postgres, Stripe. Which is closest?
  1  core stack, done before        2  adjacent, some learning
  3  new to the team
```

Deriving rather than asking follows analyze-requirements' hard rule 3 —
"never ask what the scan already observed". The person in a sales conversation
has usually not read the repository; the scan has.

**Standalone mode** has no BA package and no ARCHITECTURE.md, so all five are
asked. That run has no upstream evidence to skip on.

### Provenance

Every derived level carries the same provenance the feature scores already
carry: an `anchor` (which level definition applied), a `cite` (the evidence it
came from), and `scoreProvenance` of `proposed` until a reviewer changes it to
`stated`. Derived levels appear in the existing score-review channel
(terminal cards, csv, or `score-review.mjs` html) and remain editable in the
workbook cell. A derived factor is a proposal with its evidence attached,
never a silent default.

## 8. The workbook — seven tabs

```
from v2 (5) ──┬─ How to Use            static
              ├─ Ballpark Estimator    features filled in, formulas live
              ├─ Scoring Guide         anchors + the weights
              ├─ Tier Reference        bands + model parameters
              └─ Project Roll-up       context factors filled in, overheads, range

generated (2) ┬─ Task Breakdown        unchanged
              └─ Score Rationale       unchanged, and now load-bearing
```

The embedded base64 template in `assets/estimate-template.html` is replaced
with v2. All formulas stay live in-cell so an edited score re-prices in the
workbook.

Column layout on the main sheet changes — v2 uses L and M for est-high and
flag, so the skill's appended `MILESTONE`/`CONTAINER`/`WHY THIS TIER` shift
from L/M/N to N/O/P. `buildSheet1` is updated accordingly, along with the
autofilter reference and the total-row rewrite.

Score Rationale gains weight: with price derived entirely from scores, the
justification for each score is the justification for the price.

The internal/client-only split is unchanged in mechanism — the export block
stays inside `internal:` markers because the workbook carries pricing bands.
But `--client-only` currently strips rates and the labor/tooling breakdown,
and neither will exist. Its definition must be restated: what it now strips is
the tier bands, the context multiplier working and the overhead percentages,
keeping the presented range.

## 9. Downstream — `/proposal`

`proposal/scripts/lib/figures.mjs` reads five things that this change removes
or alters:

| Reads | Becomes |
|---|---|
| `scenarios[id].totalCost` | the roll-up P50 |
| `scenarios[id].months` | **nothing** |
| `roadmap[].startMonths/endMonths` | milestone shares |
| `inputs.scenarios[].team[].seniority` | **nothing** |
| `features[].low/high` (PERT hour spread) | v2's score-driven spread |

Consequences, all of which need a decision in the implementation plan:

- `--scenario <id>` has nothing to select. The flag goes.
- The validator requires cost low/high **and months low/high** in the
  Executive Summary. The months requirement goes.
- §7 Investment & Timeline has a Duration column per milestone. Either the
  column goes, or durations are supplied from outside the estimate.
- §8 Team renders roles from the chosen scenario's team. That section has no
  source any more.
- Cost low/high should come from the roll-up's presented range (P50…P95)
  rather than being scaled by PERT hour ratios — otherwise the proposal
  reports a different range than the workbook.

`/new-lead` needs no change: `map-nodes.mjs` reads `est?.scenarios ?? []` and
degrades to zero scenario nodes.

## 10. Validation and `estimation.md`

`estimation.md`'s required structure carries scenarios directly.
`references/writing.md` mandates a comparison table:

```
| Scenario | Team | AI-assisted | Months | Cost | Notes |
```

Four of those six columns lose their source. The table is replaced by a
single price block — presented range, P80, contingency rate, implied
accuracy — and `recommendedScenario` leaves `estimation-inputs.json`.
`writing.md:181` also references `computed.scenarios[recommendedScenario]
.roadmap`, which becomes the roadmap directly.

`checkRoadmap` in `checks.mjs` requires the Roadmap section to contain the
literal phrase "not calendar dates", guarding bands that are relative months.
Bands are now relative *shares*, so the required wording changes with them —
the guard stays, its text does not.

Check changes:

- `scoring-checks.mjs` (Summary Tier letter vs scores) stays valid; the tier
  now comes from the weighted score.
- New: the five context factor levels are present and within 1–4.
- New: dimension weights sum to 1.
- New: every feature flagged `Deep estimate required` has either a task
  breakdown or a recorded waiver. This is what makes the flag column
  load-bearing rather than decorative.
- Removed: anything asserting a scenario, a months figure, or a labor/tooling
  cost split.

## 11. Out of scope

- Recalibrating the tier bands against delivered actuals. v2 ships defaults
  and says to tune them; that is a data exercise, not this change.
- A companion Deep Estimator workbook with an Actuals and Calibration sheet.
  v2 references one; we do not have it. The PERT path covers the deep pass
  for now.
- Using `measurements.jsonl` history to derive stack familiarity
  automatically. Recorded as a future improvement — the data accumulates
  either way.
- Agentic delivery mode keeps its measurement-based baselines unchanged.
  Pricing moves to scores there too; the shapes and seed minutes do not change.

## 12. Open questions

1. `/proposal` §8 Team and the §7 Duration column — remove them, or feed them
   from a source outside the estimate?
2. Does `estimation.md` keep an hours total anywhere, or do hours become
   internal to the Task Breakdown tab only?
3. Should the contingency rate stay at v2's defaults (5% + 2%/2%) or be tuned
   before first use?
