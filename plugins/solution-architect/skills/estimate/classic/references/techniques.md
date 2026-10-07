# Techniques — which method fits which evidence, and how to run each

Read when choosing a sizing technique and again while eliciting numbers for
it. Defines the decision table that picks a technique from evidence quality,
then the mechanics of each named technique.

## 1. Decision table

| Evidence quality | Recommended technique | Precision |
| --- | --- | --- |
| Vague RFP, no history | factor-scored tiering (5 factors) at feature level | ±100%, bands |
| Detailed backlog or ARCHITECTURE.md | task-level three-point PERT | ±50% |
| Backlog + codebase + calibration data | PERT + analogy cross-check; flag divergence >30% | ±25% |
| Change request on a known repo | analogy to similar past change + code-scan sizing | ±25% |

The skill states its recommended technique and the reason it picked that row
(evidence quality observed during the interview), then lets the user confirm
or override before any numbers are elicited.

## 2. Factor-scored tiering

Used for row 1 — a vague RFP with no delivery history, no task breakdown
yet. This is also the technique QUICK depth commits to. Score each feature
1-5 on five factors:

- tech complexity
- feature size
- dependencies
- uncertainty
- risk

Weight and sum the five scores per feature — `weightedScore()` in
`pricing.mjs` computes SUMPRODUCT(scores, weights) × 5 using `WEIGHTS`
(tech 20%, size 10%, deps 20%, unc 30%, risk 20% — see `scoring-guide.md`
for why size and uncertainty are weighted asymmetrically). The result
(5–25) lands in one of four bands (`BANDS` in `pricing.mjs`):

| Tier | Score | Price |
| --- | --- | --- |
| S | 5–11.5 | $500–$1,500 |
| M | 11.5–17.5 | $1,500–$4,000 |
| L | 17.5–22.5 | $4,000–$10,000 |
| XL | 22.5–25 | $10,000–$25,000 |

Bands are continuous, not discrete steps: `pointEstimate()` interpolates
linearly between a band's price floor and ceiling by where the score sits
inside it, so two features tiered M do not price the same unless their
scores match. The band **is** the price — nothing downstream converts a
tier letter, or an hour figure, into money.

At STANDARD/DEEP the five scores are persisted on every feature (`scores`,
`scoreNote`, `scoreProvenance` — `interview.md` §4 step 3) and `pricing.mjs`
prices the feature straight from them. Task-level PERT hours (§3 below) are
still computed for planning — they size the roadmap's milestone shares —
but they no longer cross-check or gate the price. Scores are never derived
from hours, and hours are never derived from scores.

At QUICK depth this is the only technique in play: the five factors still
give a rough tier for a gut-check, but nothing is persisted (`schema.mjs`
refuses `scores`/`scoreNote`/`scoreProvenance` at QUICK) and no price is
computed — `compute.mjs` only prices STANDARD/DEEP features. QUICK is
reconnaissance, not a quote; move to STANDARD once the scope is worth
pricing.

## 3. Three-point PERT

Used for row 2 — a detailed backlog or an existing `ARCHITECTURE.md` gives
enough to break work into tasks (STANDARD/DEEP depth). Alone, this is
±50% precision; combined with the analogy cross-check below (row 3, once
codebase evidence and a calibration table also exist), precision tightens
to ±25%. Elicit three numbers per task — optimistic (O), most-likely (M),
pessimistic (P) — and feed them to `pert()` in `estimate-math.mjs`, which
computes `(O + 4M + P) / 6`.

Elicitation guidance, asked in this order:

- **O (optimistic):** "if everything goes right — no surprises, no
  rework — how many hours?"
- **M (most likely):** "realistically, accounting for the normal amount of
  friction, how many hours?"
- **P (pessimistic):** "if the risks you can actually name land — not the
  worst thing you can imagine, but a specific named risk (a dependency
  slips, a library doesn't do what the docs say) — how many hours?"

P must anchor to a named risk, never to "worst imaginable." An unanchored P
inflates the buffer for no reason and erodes trust in the range.

## 4. Analogy cross-check

Two applications, both anchored to a comparable past delivered item:

- **Row 3 — cross-check on top of PERT.** Once backlog, codebase, and a
  calibration table are all available, compare the PERT total for the
  current scope against the actual hours the past item took (or its own
  PERT total, if it was never closed out). If the two diverge by more than
  30%, flag it and reconcile — either the current breakdown is missing
  tasks the analogy remembers, or the analogy isn't as comparable as it
  looked — before writing anything to `estimation-inputs.json`. Do not
  average the two numbers away; the divergence itself is the useful signal.
- **Row 4 — standalone technique for a change request on a known repo.**
  No fresh PERT elicitation: size the change by comparing it directly to a
  similar past change on the same repo, then confirm that comparison with a
  codebase scan (how many call sites, how many tests, how much of the
  touched code is boilerplate vs logic vs novel). The same >30% divergence
  flag-and-reconcile rule applies between the analogy's hours and the
  code-scan's implied hours before the number ships.

## Sources

Cite these when stating a recommendation (step 4) — attribution + link only,
never quoted text:

- Three-point weighting `E = (O + 4M + P) / 6` and `σ = (P − O) / 6` — PERT
  (US Navy Special Projects Office, 1958). Applied to software estimates per
  Atomic Object, *Better Custom Software Estimates*
  (atomicobject.com/client-resources/better-custom-software-estimates).
- Project buffer `√Σσ²`, range estimates, decomposition, discrete buckets,
  risk = probability × impact, assumptions register — same Atomic Object
  article.
- Factor-scored tiering — this team's own delivery practice (5-factor
  spreadsheet); tier breaks calibrated to it.
- Depth tiers and per-row confidence ratings — Modular-Earth
  solutions-architecture-agent, `skills/estimate/SKILL.md` (github.com).
- AI-adjusted sizing — Kmino, *Software Estimation with AI*
  (kmino.io/blog/software-estimation-with-ai); details and constants in
  `ai-multipliers.md` Sources.
