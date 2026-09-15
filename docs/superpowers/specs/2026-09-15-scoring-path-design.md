# Scoring Path — Design Spec

Date: 2026-09-15
Skill: `plugins/solution-architect/skills/estimate/`
Predecessors (ship first, no spec):
  A — `plan` → `aiAssisted` + `toolingCostPerSeat` on scenarios
  B — page Summary block replaces scenario cards, cost bars, what-if rail

## Summary

Make factor-scored tiering a first-class estimation method instead of a lossy
shortcut. Today the interview scores five factors per feature at QUICK depth,
picks a tier, reads the calibration band — then writes one synthetic task and
**discards the scores**. The HTML page's "scoring mode" re-derives five
scores backwards from the hours, so it can never disagree with them, and the
`estimation.md` Summary carries a `Tier` column that nothing validates. Both
live leads label features `M` with a 40–160 h range and `S` with 16–56 h;
no rule produced those letters.

After this change: scores are elicited against a written rubric, persisted
with provenance, turned into a tier by one scale, and read by every
downstream surface. PERT survives unchanged and gains a cross-check against
the tier band. Compute math is untouched.

## Decisions (approved in design session)

| # | Decision |
| --- | --- |
| D1 | `technique` is the fork the human chooses: `SCORING` or `PERT`. `QUICK` stops being a depth — it *is* `SCORING`. `depth` (`STANDARD` / `DEEP`) is meaningful only under `PERT`. |
| D2 | `SCORING` keeps the synthetic-task bridge (`o`/`m`/`p` = band low/mid/high). `compute.mjs`, `rollup.mjs`, scenarios, roadmap, `/proposal` are not modified. |
| D3 | Every feature on every path carries `scores`, `tier`, `band`. Under `PERT`, scores are elicited **before** task decomposition and the PERT total is cross-checked against the band. |
| D4 | Scores are never derived from hours. `deriveScores` in the template is deleted; the page reads `features[].scores`. |
| D5 | One tier scale everywhere: the workbook's `S ≤ 11 · M ≤ 17 · L ≤ 22 · XL > 22`. The calibration table gains an `XL` band. `techniques.md` and `TIER_BREAKS` in `estimate-math.mjs` are updated to match. |
| D6 | The rubric leaves the HTML for `references/scoring-guide.md`. The interviewer reads it before proposing any score; `render.mjs` injects it into the page as a slot. |
| D7 | Score elicitation is evidence-first: the agent proposes all five scores per feature from the evidence it already read, labels them `proposed`, and the human accepts or corrects. Cards are batched 4–6 per turn. |
| D8 | A PERT feature whose expected hours fall outside its tier band must carry a `bandNote` explaining the reconciliation, or `validate.mjs` refuses. Same spirit as the existing >30% analogy-divergence rule. |
| D9 | The xlsx export's tier → `$` price columns (`500/1500/4000/10000` and `1500/4000/10000/25000`) are removed. They are a second pricing model with no owner. |
| D10 | Milestones under `SCORING` are optional (asked, skippable). Under `PERT` unchanged. |

## 1. Interview (`references/interview.md`)

### 1.1 Fork

§2 "Depth question — ask first" becomes:

```text
Technique?
 ├── SCORING — five factors per feature, tier, calibration band     (±wide)
 └── PERT    — score first, then task-level three-point            (±moderate)
                 depth?  STANDARD | DEEP                           (DEEP: ±narrow)
```

§2b delivery mode is unchanged and still asked second. The evidence →
technique decision table in `techniques.md` §1 still drives the *recommended*
answer; the human confirms or overrides as today.

### 1.2 Question sequence

```text
0. evidence scan            pre-fill scope, show provenance table   (unchanged)
1. technique                SCORING | PERT (+ depth)                (was: depth)
2. delivery mode            TRADITIONAL | AGENTIC                   (unchanged)
3. clear-vs-assumed gate                                            (unchanged)
4. calibration table        S · M · L · XL bands, org history or defaults   (was Q7 — moved up)
5. score features           §1.3 — both techniques
6. milestone grouping       PERT: as today · SCORING: optional      (D10)
7. PERT tasks + o/m/p       PERT only, with band cross-check §1.4
8. team + rates + seniority                                         (unchanged)
9. tooling cost per seat    from predecessor A                      (unchanged)
10. deadline / budget ceiling                                       (unchanged)
11. expose rates to client                                          (unchanged)
```

Calibration moves before scoring because it is the thing that turns a letter
into hours; the human must see the bands before handing out tiers.

### 1.3 Score cards

One card per feature, batched 4–6 per turn. The agent fills every cell from
evidence and cites the source inline; the human answers `accept`, `<factor>
<n>`, or `split`.

```text
┌ F07  Payment reconciliation ───────────────────────────── proposed ┐
│  Tech    4  non-trivial algorithms     ← ARCHITECTURE.md §6 matching │
│  Size    3  multiple components + BE   ← PRD §4.2, 3 screens        │
│  Deps    4  multiple 3rd-party APIs    ← Stripe + bank CSV import   │
│  Unc     3  design decisions in build  ← reconciliation rules TBD   │
│  Risk    5  payments / irreversible    ← rubric: payments = 4–5     │
│  Σ 19  →  L  →  160–400 h                                            │
│  accept · change <factor> <n> · split                               │
└──────────────────────────────────────────────────────────────────────┘
```

Rules:

- Anchors come from `scoring-guide.md` verbatim; the card never paraphrases.
- A card at Σ 11, 17 or 22 shows an edge line: `one point from <tier>; <factor>
  +1 moves this to <band>`.
- Any factor scored 5 shows `review`.
- `scoreProvenance` is `proposed` when the human accepts the card as
  offered, `stated` when they change any cell.
- `split` returns to the clear-vs-assumed gate (loop rule §5 already covers
  this).

### 1.4 PERT cross-check

Under `PERT`, after o/m/p are elicited for a feature's tasks, compare
`Σ pert(task).e` with `band`:

```text
F07  Σ19 → L → 160–400 h
     PERT tasks 85 h        ⚠ below band — tasks missing what the scorer felt?
```

The interviewer must reconcile before writing inputs: adjust the tasks, adjust
the scores, or record why both are right in `bandNote`. Never average.

## 2. Scoring guide (`references/scoring-guide.md`)

New file. Content is `SCORE_GUIDE` from `estimate-template.html:894-925` —
five dimensions × five anchors — with every `derived:` footnote removed.
Format: one markdown table, header `Dimension | 1 | 2 | 3 | 4 | 5`, plus the
tier scale line and a one-paragraph note on `proposed` vs `stated`.

`render.mjs` reads this file and injects the table into the page via
`<!-- slot:GUIDE -->`, so page and interview explain a score in the same
words and the HTML no longer owns the rubric.

## 3. Data model (`estimation-inputs.json`, `lib/schema.mjs`)

### 3.1 Top level

```jsonc
{
  "technique": "SCORING" | "PERT",          // was free text, e.g. "three-point-pert"
  "depth": "STANDARD" | "DEEP",             // PERT only; absent under SCORING
  "calibration": {
    "S": [20, 60], "M": [60, 160], "L": [160, 400], "XL": [400, 800],
    "provenance": "stated" | "proposed"     // org history vs defaults
  }
}
```

`QUICK` is rejected. `calibration.provenance` is new and required —
`proposed` means the defaults are in use, and the page says so.

### 3.2 Per feature

```jsonc
{
  "id": "payment-recon",
  "name": "Payment reconciliation",
  "provenance": "stated",
  "scores": { "tech": 4, "size": 3, "deps": 4, "unc": 3, "risk": 5 },
  "scoreProvenance": "stated" | "proposed",
  "tier": "L",
  "band": [160, 400],
  "bandNote": "…",                          // PERT only; required when Σe ∉ band
  "tasks": [ … ]                            // SCORING: exactly one synthetic task
}
```

Validation added to `checkInputs`:

| Rule | Finding |
| --- | --- |
| all five scores present, integers 1–5 | `feature X: scores.<k> must be an integer 1–5` |
| `tier` equals `tierFor(scores)` under D5 | `feature X: tier "M" does not match Σ19 (L)` |
| `band` equals `calibration[tier]` | `feature X: band does not match calibration L` |
| SCORING: exactly one task, `o/m/p` = band low / mid / high | `feature X: SCORING synthetic task must equal band` |
| PERT: `Σ pert(task).e ∈ band` or `bandNote` non-empty | `feature X: PERT 85h outside band 160–400 and no bandNote` |
| `calibration.provenance` present | `calibration.provenance is required` |

Existing all-or-nothing rules (milestones, components) unchanged.

### 3.3 `estimation.json`

`computed.features[id]` gains `tier`, `band`, `total` (Σ scores) copied from
inputs so the page and `checks.mjs` read one object. No new math.

## 4. Tier scale (D5)

| Where | Today | After |
| --- | --- | --- |
| `estimate-math.mjs` `TIER_BREAKS` | `S ≤10 · M ≤17 · L` | `S ≤11 · M ≤17 · L ≤22 · XL` |
| `techniques.md` §2 | `≤10 S / 11–17 M / ≥18 L` | same as above |
| page `scoreTier` | `S ≤11 · M ≤17 · L ≤22 · XL` | reads `features[].tier`; local function deleted |
| xlsx `rowFormulas` | `S ≤11 · M ≤17 · L ≤22 · XL` | unchanged formula, prices removed (D9) |
| default calibration | `S 20–60 · M 60–160 · L 160–400` | `+ XL 400–800` |

`tierFor` moves from a page-only helper to the single source, imported by
`schema.mjs` for validation and inlined into the template as today's math is.

## 5. Compute

No change to `compute.mjs`, `rollup.mjs`, `estimate-math.mjs` beyond
`TIER_BREAKS` (§4). The bridge task is what the pipeline already consumes.

`checks.mjs` gains:

| Rule | Finding |
| --- | --- |
| `estimation.md` Summary `Tier` cell equals `features[].tier` | `scope row "X": Tier M does not match inputs (L)` |
| `estimation.md` Summary `Range (h)` equals `band` under SCORING | `scope row "X": range must equal band 160–400` |
| calibration line names provenance | `calibration line must state org history or defaults` |

## 6. Page (`assets/estimate-template.html`)

Renders per `inputs.technique`. Predecessor B has already replaced cards,
bars and the what-if rail with the Summary block; this section builds on
that page.

| Element | PERT | SCORING |
| --- | --- | --- |
| Summary — size line | `1,381 h · 25 features · 52 tasks · 6 milestones` | `1,381 h · 25 features · 4 S · 15 M · 6 L` |
| Summary — method line | `PERT, STANDARD depth · scope 25/25 stated` | `factor-scored · calibration: defaults (uncalibrated)` or `org history` |
| Summary — fragility line | — | `3 features on a tier edge` |
| Breakdown columns | Feature · Tech Size Deps Unc Risk · Σ · Tier · Band · Hours · Confidence · Source | Feature · Tech Size Deps Unc Risk · Σ · Tier · Band · Hours · Source |
| Breakdown `Range` column | removed | removed |
| Score cell = 5 | `review` styling (existing CSS) | same |
| Σ at 11 / 17 / 22 | edge marker on the row | same |
| Task drill-down | as today | hidden (one synthetic row = its parent) |
| Scoring guide | fold under the table, from `slot:GUIDE` | same, open on first view |
| Mode toggle (estimate / scores) | removed — one table carries both | removed |
| Method fold | PERT text + "scores cross-checked against tier band" | scores → tier → calibration band → hours |
| Derivation trace (row hover / expand) | `Σ19 → L → 160–400 h · PERT 280 h ✓` | `Σ19 → L → 160–400 h → 280 h` |
| Containers, roadmap, risk register | unchanged | unchanged |

Deleted from the template: `deriveScores`, `TECH_CATEGORY_SCORE`, `band()`
score-banding helper, `scoreTier`, `SCORE_GUIDE`, `bdModePill`, `bdMode`,
the `derived:` strings.

Client view: identical minus rates (existing `redactForClient`). Scores and
tiers are client-facing — they are the clear-vs-assumed split made visible.

## 7. xlsx export

- Score columns export `features[].scores`, not derived values.
- Tier formula unchanged (already the D5 scale).
- Columns `I`/`J` (tier → `$` low/high) removed, with their `totalRowXml`
  sums. Cost lives in scenarios, nowhere else.
- Sheet-2 task tab unchanged.

## 8. Documentation

| File | Change |
| --- | --- |
| `SKILL.md` | Flow step 2 → "Technique and delivery mode"; step 4 folds into it; `scoring-guide.md` listed as a read |
| `references/interview.md` | §2 rewritten (§1.1), §4 sequence (§1.2), new §4a cards (§1.3), §4b cross-check (§1.4) |
| `references/techniques.md` | §1 decision table maps to `SCORING` / `PERT`; §2 tier breaks → D5; bridge paragraph unchanged |
| `references/writing.md` | §1 inputs shape: `scores`, `tier`, `band`, `bandNote`, `calibration.provenance`; §2 skeleton: Summary `Tier` cell must equal inputs; calibration line names provenance |
| `references/scoring-guide.md` | new (§2) |
| `references/ai-multipliers.md` | unchanged by C (pricing table already removed by A) |
| `README.md` | one line: two techniques, scores persisted |

## 9. Migration

| Artifact | Action |
| --- | --- |
| `~/WIP/mine/new-lead-livetest/leads/*/estimation-inputs.json` | both leads are `three-point-pert` at `STANDARD`/`DEEP`. They stay valid against the *old* validator and are not touched by this change. The first time either is re-estimated, the skill runs a **score backfill pass** (cards from §1.3 against existing ARCHITECTURE.md/PRD), renames technique to `PERT`, sets `calibration.provenance: "proposed"` (both use defaults), then re-runs compute + validate; `estimation.md` Summary `Tier` cells are rewritten from the new field. Until then their `proposal.md` is unaffected. |
| Fixtures | `booking-inputs.json`, `agentic-inputs.json`, `estimation-pass.md`, `estimation-fail.md` gain the new fields; any `QUICK` fixture becomes `SCORING`. |
| Old `depth: QUICK` inputs in the wild | none known; validation rejects with `depth QUICK is now technique SCORING`. |

Backfill is a one-time interview, not a script — scores are judgments and
the agent must not invent them from hours (D4).

## 10. Testing

TDD, RED first:

| Test file | Covers |
| --- | --- |
| `schema.test.mjs` | every rule in §3.2; `QUICK` rejected; `XL` accepted; `calibration.provenance` required |
| `estimate-math.test.mjs` | `tierFor` at 11 / 12 / 17 / 18 / 22 / 23 |
| `validate.test.mjs` | `checks.mjs` rules in §5 against `estimation-pass.md` / `-fail.md` |
| `render.test.mjs` | `slot:GUIDE` injected; no `derived:` string in output; drill-down absent under SCORING; Σ edge marker present |
| `browser.test.mjs` | breakdown shows `features[].scores` verbatim; mode pill absent; Summary size line per technique |
| `xlsx-export.test.mjs` | no `I`/`J` price columns; score cells equal inputs |
| `references.test.mjs` | `scoring-guide.md` has five rows × five anchors; `techniques.md` states D5 breaks; `interview.md` names `SCORING`/`PERT` |
| `e2e.test.mjs` | booking fixture under both techniques renders and validates |

Coverage stays ≥ 80 %. Quality gates (20 lines / 3 params / 200-line files)
apply to new code; the template's script block is already exempt by
convention.

## Open decisions

| Decision | Options | Default in this spec |
| --- | --- | --- |
| Client view shows scores | yes / hide | yes — they are the clear-vs-assumed split |
| `XL` default band | `400–800` / other | `400–800` |
| Score backfill on live leads | on next re-estimate / proactively now | on next re-estimate (§9) |
| Edge marker thresholds | Σ = 11, 17, 22 exactly / ±1 | exactly |

## Out of scope

- Feeding actuals back into the calibration table (belongs with
  `record-task`, deferred).
- A second compute path that reads bands directly (approach B in the
  session — revisit only if the bridge task starts lying).
- Any change to scenarios, months, cost, roadmap, or `/proposal`.
