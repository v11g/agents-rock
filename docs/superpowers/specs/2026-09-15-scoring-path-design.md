# Real Scores at STANDARD Depth — Design Spec

Date: 2026-09-15
Skill: `plugins/solution-architect/skills/estimate/`
Predecessors (shipped on `feat/estimate-ai-assisted`, no spec):
  A — `plan` → `aiAssisted` + `toolingCostPerSeat` on scenarios
  B — page Summary block replaces scenario cards, cost bars, what-if rail

Supersedes the two earlier drafts in this file (a `SCORING`/`PERT` technique
fork, then a SCORING-only split). Both were dropped on 2026-09-15 once the
team confirmed the spreadsheet is the deliverable: its scoring tab and its
task tab must both be filled from one estimate.

## Summary

The interview already asks five factor scores per feature at every depth
(`interview.md` §4 step 3). At STANDARD and DEEP those scores are then thrown
away: nothing in `estimation-inputs.json` holds them, and the HTML page and
xlsx export re-derive five "scores" backwards from hours (`deriveScores`).
Measured on the two live leads, 43 features: Uncertainty is 4 or 5 on every
row, Risk never reaches 1 or 4, Tech never reaches 1, zero features tier S.
The rubric asks about spec clarity and business impact; the derivation
answers with PERT spread and estimate confidence.

After this change, at STANDARD and DEEP the human's scores are written to
inputs next to the tasks, validated, and read verbatim by the page and the
spreadsheet. QUICK is untouched. Compute, scenarios, cost, roadmap,
`/proposal` are untouched.

## Decisions

| # | Decision |
| --- | --- |
| D1 | Depth names stay `QUICK` / `STANDARD` / `DEEP`. No technique fork. QUICK's flow (scores → tier → calibration band → one synthetic task) is not modified and still does not persist scores. |
| D2 | At `STANDARD` and `DEEP`, every feature carries `scores` (each factor: number, rubric anchor verbatim, evidence cite), a plain-words `scoreNote`, and `scoreProvenance`. `schema.mjs` refuses their absence at those depths and their presence at `QUICK`. |
| D3 | Scores are never derived from hours. `deriveScores`, `TECH_CATEGORY_SCORE`, the `band()` score helper, `scoreTier`, `SCORE_GUIDE`, `bdModePill`, `bdMode` and every `derived:` string leave the template. |
| D4 | One tier scale: `S ≤ 11 · M ≤ 17 · L ≤ 22 · XL > 22` (the workbook's sheet-1 formula). `TIER_BREAKS` in `estimate-math.mjs` and `techniques.md` §2 are updated; the default calibration table gains `XL 400–800 h`. `tierFor` is the single source, inlined into the page beside `pert`. |
| D5 | The rubric moves from the HTML to `references/scoring-guide.md`. The interviewer reads it before proposing a score; `render.mjs` injects it into the page through `<!-- slot:GUIDE -->`. |
| D6 | Score elicitation is evidence-first: the agent proposes all five scores per feature from the evidence it has read, labels them `proposed`, batches 4–6 cards per turn; the human accepts or corrects. Accepted as offered → `scoreProvenance: "proposed"`; any cell changed → `"stated"`. |
| D7 | Soft cross-check. When a feature's PERT hours fall outside its tier's calibration band the page marks the row `⚠` and the interviewer says so once after o/m/p. Nothing is refused, nothing new is written. Hardening to a validator rule is a later decision. |
| D8 | The xlsx export keeps its tier → `$` columns (I–K) and its Task Breakdown tab. Sheet 1 score cells read `features[].scores`; at QUICK they are blank. Sheet 1 gains column N `WHY THIS TIER` (the plain-words `scoreNote`, for sales and client readers) and the workbook gains a fifth tab `Score Rationale` (one row per feature × factor: score, anchor, cite, provenance, for engineers). |
| D9 | Live leads are backfilled through the interview (D6 cards against their existing evidence), never by script. |
| D10 | The human picks the review channel for the proposed scores: terminal cards, a CSV the agent writes and reads back, or an HTML review page. The agent asks once per estimate, gives a one-line reason for each option, and recommends one from the feature count. All three produce the same `scores` + `scoreProvenance`. |

## 1. Interview (`references/interview.md`)

§4 step 3 today:

> **Factor scores per feature** — five factors, each scored 1-5 … (STANDARD/DEEP also want task-level O/M/P)

becomes two steps:

```text
3.  Factor scores per feature   all depths — read scoring-guide.md first,
                                ask review channel §1.2, then cards §1.1
    STANDARD/DEEP: write scores + scoreProvenance on every feature
    QUICK:         use them for the tier as today; nothing else changes
3b. Tasks + O/M/P               STANDARD/DEEP only, as today (techniques.md §3)
    after each feature: compare Σ pert(e) with the tier band; if outside,
    say so once — "Σ19 → L → 160–400 h, tasks sum to 85 h; tasks missing or
    scores high?" — human decides, nothing is written
```

Steps 1, 2, 4–8 unchanged. The calibration table (step 7) is unchanged and
still asked at every depth; at STANDARD/DEEP it feeds only the ⚠ check.

### 1.1 Score cards

One card per feature, 4–6 per turn. The agent fills every cell from
evidence and cites the source inline; the human answers `accept`, `<factor>
<n>`, or `split`.

```text
┌ F07  Payment reconciliation ──────────────────────────────────── proposed ┐
│  Tech  4  Non-trivial algorithms, real-time systems, ML inference,        │
│           complex data transforms                                         │
│           ← ARCHITECTURE.md §6: fuzzy match bank rows to invoices         │
│  Size  3  Medium feature with multiple components and backend logic       │
│           ← PRD §4.2: 3 screens + nightly job                             │
│  Deps  4  Multiple third-party APIs or tightly coupled internal systems   │
│           ← Stripe API + bank CSV import                                  │
│  Unc   3  Some open questions, design decisions to be made during build   │
│           ← PRD §4.2: "reconciliation rules TBD"                          │
│  Risk  5  Core infrastructure, compliance requirements, irreversible ops  │
│           ← payments; rubric puts payments at 4–5, chose 5: irreversible  │
│  Σ 19  →  L  →  160–400 h                                                 │
│  Why (client): handles payments and two outside services; matching       │
│                rules still to be decided                                  │
│  accept · change <factor> <n> · why <text> · split                        │
└───────────────────────────────────────────────────────────────────────────┘
```

Rules:

- `Why` is one plain sentence for a non-technical reader: what the feature
  touches and what is still unknown. No file names, no factor names, no
  rubric wording. The human may rewrite it (`why <text>`); a rewrite marks
  the feature `stated` like a score change.

- Anchors come from `scoring-guide.md` verbatim, full sentence, never
  truncated or paraphrased; the cite quotes the fact it rests on. The
  engineer checks two things per row: right rubric sentence, evidence
  supports it.
- Every score shows its anchor and its cite, in every channel. No evidence
  for a factor → the cell is `?` and the agent asks; it never fills a 3.
- A card at Σ 11, 17 or 22 shows an edge line: `one point from <tier>;
  <factor> +1 moves this to <band>`.
- Σ > 22 (XL): the card recommends `split` before `accept`.
- Any factor scored 5 shows `review`.
- `split` returns to the clear-vs-assumed gate (loop rule §5 already covers
  this).

### 1.2 Review channel (D10)

Asked once, after the clear-vs-assumed gate and before the first card:

```text
25 features to score. How do you want to review them?
  1. terminal   cards here, 4–6 per turn, reply "accept" or "F03 deps 4"
                — fastest for ≤ 8 features, no file to open
  2. csv        I write scores-draft.csv, you edit in Sheets/Excel, say "done"
                — all rows on one screen, notes column, fits the workbook habit
  3. html       I write scores-review.html, you open it, set dropdowns, copy
                the feedback block back here
                — anchor text on hover, edge/XL badges, best for 15+ features
Recommended: 2 (25 features).
```

Recommendation rule: ≤ 8 → terminal, 9–14 → csv, 15+ → html; the human
overrides freely. Whatever the channel, every proposed cell carries its
anchor and its cite, and the agent reports the diff before writing:
`3 changes: F07 risk 5→4, F12 unc 2→3, F19 deps 3→4 — all stated. Σ moves
F12 to L. Proceed?`

| Channel | Agent writes | Human does | Agent reads back |
| --- | --- | --- | --- |
| terminal | cards (§1.1) in chat | replies per batch | parses the reply |
| csv | `scores-draft.csv`: `id, feature, tech, tech_why, tech_cite, … risk, risk_why, risk_cite, sum, tier, why_this_tier, note` — each `*_why` is the anchor sentence verbatim, `*_cite` the evidence, `why_this_tier` the plain-words note | edits numbers or the plain note, optional `note` to the agent, says "done" | `scripts/score-review.mjs --read scores-draft.csv` diffs against the proposal it wrote |
| html | `scores-review.html` from `assets/scores-review-template.html`: one row per feature, a `<select>` per score, anchor sentence as cell title, cite column, ⚑ edge and XL badges, live Σ/tier, "copy feedback" button that puts a JSON block on the clipboard | sets dropdowns, pastes the block | parses the pasted JSON (same shape as the csv diff) |

`score-review.mjs` owns both file formats: `--write <draft.json> --format
csv|html` and `--read <file>`. It is the only new script; it does no
scoring, only serialisation and diff. The HTML page reuses the estimate
template's palette and table CSS, embeds the scoring guide table under a
fold, and has no internal/client split. A `note` from csv or html lands in
the feature's `assumptions` only if the human says so; by default it is
shown in the diff and discarded. The free-text `note` column exists in the
CSV channel only; the HTML page has the `scoreNote` textarea and the chat for
anything else, so `window.__feedback()` never carries a `note`.

`--read` also prints `needsReason`: every changed score with its old cite.
A changed score keeps a cite that argued for the old number, so the agent
asks once per cell what makes it the new score (`AskUserQuestion` when
available, one question per cell, options = the agent's best guesses at the
reason + "keep it, no reason" + "agree — back to <old>"), writes the answer
as `cite: "reviewer: <answer>"`, may push back once with quoted evidence,
and writes `reviewer: no reason given` when the reviewer declines. The
reviewer always wins; silence is recorded, never blocked. A rewritten
`scoreNote` needs no reason.

## 2. Scoring guide (`references/scoring-guide.md`)

New file. Content is `SCORE_GUIDE` from `estimate-template.html` — five
dimensions × five anchors — with every `derived:` footnote removed. Format:
one markdown table, header `Dimension | 1 | 2 | 3 | 4 | 5`, the tier scale
line (D4), and one paragraph on `proposed` vs `stated`.

`render.mjs` reads the file and injects the table via `<!-- slot:GUIDE -->`,
so page and interview explain a score in the same words and the HTML no
longer owns the rubric.

## 3. Data model

### 3.1 Per feature (STANDARD / DEEP)

```jsonc
{
  "id": "payment-recon",
  "name": "Payment reconciliation",
  "provenance": "stated",
  "scores": {
    "tech": { "n": 4, "anchor": "Non-trivial algorithms, real-time systems, ML inference, complex data transforms", "cite": "ARCHITECTURE.md §6" },
    "size": { "n": 3, "anchor": "…", "cite": "PRD §4.2" },
    "deps": { "n": 4, "anchor": "…", "cite": "Stripe + bank CSV import" },
    "unc":  { "n": 3, "anchor": "…", "cite": "PRD §4.2 — reconciliation rules TBD" },
    "risk": { "n": 5, "anchor": "…", "cite": "rubric: payments" }
  },
  "scoreNote": "Handles payments and two outside services; matching rules still to be decided",
  "scoreProvenance": "stated" | "proposed",
  "tasks": [ … ]                            // unchanged
}
```

`anchor` must equal one of the five anchor sentences for that factor in
`scoring-guide.md` (the validator checks it verbatim), so the reason a score
was given cannot drift from the rubric the way the scores drifted from the
hours.

QUICK features keep today's shape. `tier` and `band` are not stored: the
page and `checks.mjs` compute them from `scores` through `tierFor` and the
calibration table already in inputs.

### 3.2 Validation (`schema.mjs`)

| Rule | Finding |
| --- | --- |
| STANDARD/DEEP: `scores` has exactly `tech size deps unc risk`; each `n` an integer 1–5 | `feature X: scores.<k>.n must be an integer 1–5` |
| STANDARD/DEEP: each `anchor` equals the guide's anchor for that factor and score | `feature X: scores.<k>.anchor is not the guide's sentence for <k> = <n>` |
| STANDARD/DEEP: each `cite` non-empty string | `feature X: scores.<k>.cite is required` |
| STANDARD/DEEP: `scoreNote` non-empty, contains no factor name, no `.md`, no `§` | `feature X: scoreNote must be one plain sentence (no file names, factor names or section marks)` |
| STANDARD/DEEP: `scoreProvenance` is `stated` or `proposed` | `feature X: scoreProvenance must be stated\|proposed` |
| QUICK: `scores` or `scoreProvenance` present | `feature X: scores are not persisted at QUICK depth` |
| `depth` is `QUICK\|STANDARD\|DEEP` | `depth must be QUICK\|STANDARD\|DEEP` |

`depth` is currently free text in inputs and unread by any script; this is
the first rule that names it. Agentic mode is unaffected (its features carry
no scores; the STANDARD/DEEP rule applies to traditional delivery only).

### 3.3 `estimation.json`

At STANDARD/DEEP, `computed.features[id]` gains `scoreTotal` and `tier`
(from `tierFor`) so page, `checks.mjs` and xlsx read one object. No new
math.

## 4. Tier scale (D4)

| Where | Today | After |
| --- | --- | --- |
| `estimate-math.mjs` `TIER_BREAKS` | `S ≤10 · M ≤17 · L` | `S ≤11 · M ≤17 · L ≤22 · XL` |
| `techniques.md` §2 | `≤10 S / 11–17 M / ≥18 L` | same as above |
| page `scoreTier` | `S ≤11 · M ≤17 · L ≤22 · XL` (local copy) | deleted; reads `computed.features[].tier` |
| xlsx `rowFormulas` | `S ≤11 · M ≤17 · L ≤22 · XL` | unchanged |
| default calibration | `S 20–60 · M 60–160 · L 160–400` | `+ XL 400–800` |

## 5. Checks (`checks.mjs`)

| Rule | Finding |
| --- | --- |
| STANDARD/DEEP: `estimation.md` Summary `Tier` cell equals `computed.features[].tier` | `scope row "X": Tier M does not match scores (L)` |

The `Tier` column already exists in the skeleton (`writing.md` §2) with
nothing producing it. At QUICK the agent still types the tier it chose, as
today, unchecked.

## 6. Page (`assets/estimate-template.html`)

One template. Column set chosen once from `inputs.depth`.

| Element | QUICK | STANDARD / DEEP |
| --- | --- | --- |
| Breakdown columns | Feature · Effort · Confidence · Source (today's estimate table) | Feature · Tech Size Deps Unc Risk · Σ · Tier · Effort · Confidence · Source |
| Task drill-down | as today | as today |
| Score cell = 5 | — | `review` styling (existing CSS) |
| Σ at 11 / 17 / 22 | — | edge marker on the row |
| Hours outside tier band | — | `⚠` on the row, title `PERT 85 h below L band 160–400 h` |
| Score cell hover | — | anchor sentence + cite |
| Feature row subline | — | `scoreNote` in plain words, same slot the task assumptions use |
| Scoring guide | — | fold under the table from `slot:GUIDE`, open on first view |
| Mode toggle (estimate / scores) | removed | removed |
| `download xlsx` | as today | as today |
| Summary, containers, roadmap, risks, method | unchanged | unchanged |

Client view: identical minus rates (existing `redactForClient`). Scores and
tiers are client-facing — they are the clear-vs-assumed split made visible.

## 7. xlsx export

- Sheet 1 score cells B–F read `features[].scores.*.n`; blank at QUICK.
- Sheet 1 column N `WHY THIS TIER` = `scoreNote`, header styled like L/M
  (`MILESTONE`, `CONTAINER`), autofilter widened to N.
- New tab `Score Rationale` (sheet5, registered like Task Breakdown):
  `FEATURE | FACTOR | SCORE | ANCHOR | EVIDENCE | PROVENANCE`, five rows per
  feature, header frozen, autofilter. Empty at QUICK.
- Tier formula (H), `$` columns (I–K), totals, Scoring Guide and Tier
  Reference tabs, Task Breakdown tab: unchanged.
- The "rows arrive with `.scores` already derived" comment goes with
  `deriveScores`.

## 8. Documentation

| File | Change |
| --- | --- |
| `SKILL.md` | flow step for the interview lists `scoring-guide.md` as a read |
| `references/interview.md` | §4 step 3 split into 3 / 3b (§1); review channel question (§1.2); cards (§1.1) |
| `references/techniques.md` | §2 tier breaks → D4; one sentence: at STANDARD/DEEP the scores are persisted and the band is a cross-check |
| `references/writing.md` | §1 inputs shape gains `scores` (n / anchor / cite), `scoreNote`, `scoreProvenance`, with the plain-words rule for the note; §2: Summary `Tier` cell must match scores at STANDARD/DEEP |
| `references/scoring-guide.md` | new (§2) |
| `README.md` | one line |

## 9. Migration

| Artifact | Action |
| --- | --- |
| `~/WIP/mine/new-lead-livetest/leads/{montalvo,residental-app}` | 18 + 25 features, `three-point-pert` at DEEP / STANDARD. Backfill interview (D9): cards from §1.1 against their ARCHITECTURE.md / PRD, ~8 turns, then `depth` written if absent, compute re-run (hours byte-identical), `estimation.md` Summary `Tier` cells rewritten, validate. |
| Fixtures | `booking-inputs.json` gains scores on every feature; `estimation-pass.md` Tier cells match; a QUICK fixture (if added) carries none. |
| Inputs in the wild | any STANDARD/DEEP inputs without scores now fail validation with the §3.2 finding. Same hard-break posture as predecessor A. |

## 10. Testing

TDD, RED first:

| Test file | Covers |
| --- | --- |
| `schema.test.mjs` | every rule in §3.2, both directions (missing at STANDARD, present at QUICK); depth enum |
| `estimate-math.test.mjs` | `tierFor` at 11 / 12 / 17 / 18 / 22 / 23 |
| `compute.test.mjs` | `scoreTotal`, `tier` in computed features; hours unchanged on the booking fixture |
| `validate.test.mjs` | §5 Tier rule against `estimation-pass.md` / `-fail.md` |
| `render.test.mjs` | `slot:GUIDE` injected; no `derived:` string; no `deriveScores`; `tierFor` inlined |
| `browser.test.mjs` | breakdown shows `features[].scores` verbatim; mode pill absent; `⚠` on an out-of-band row; QUICK inputs render today's columns |
| `xlsx-export.test.mjs` | score cells equal inputs; column N equals `scoreNote`; Score Rationale tab has 5 rows per feature with anchor and cite; blank/empty at QUICK; I–K and Task Breakdown unchanged |
| `references.test.mjs` | `scoring-guide.md` five rows × five anchors; `techniques.md` states D4 breaks; `interview.md` has step 3b and names the three channels |
| `score-review.test.mjs` (new) | csv write → edit two cells → read returns exactly those two diffs; html page renders one `<select>` per score with the anchor as title; "copy feedback" JSON round-trips to the same diff; untouched rows stay `proposed` |

Coverage stays ≥ 80 %. Quality gates apply to new module code; the
template's script block is exempt by convention.

## Open decisions

| Decision | Options | Default |
| --- | --- | --- |
| Client view shows scores | yes / hide | yes |
| `XL` default band | `400–800` / other | `400–800` |
| Edge marker thresholds | Σ = 11, 17, 22 exactly / ±1 | exactly |
| Who drafts the cards | main interview agent inline / a fresh subagent per batch (rubric at top of a ~10k context, accepted scores passed in for sibling consistency) | subagent per batch — inline drifts past ~10 features |

## Out of scope

- Any change to QUICK beyond the tier-scale constant it already shares.
- Hard validator refusal on hours outside band (D7 keeps it soft).
- Feeding actuals back into the calibration table.
- Any change to scenarios, months, cost, roadmap, or `/proposal`.
