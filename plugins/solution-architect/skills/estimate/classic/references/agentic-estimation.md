# Agentic estimation — measurement-based, not multiplier-based

Read once the interview's delivery-mode question (`references/interview.md`
§2b) returns AGENTIC. Defines the whole measurement-based pipeline: where the
data lives, how a task's baseline is found, how the math turns a baseline
into an estimate, what decomposition the deliverable requires, and how
confidence is labeled. This doc describes what `lib/baselines.mjs`,
`lib/measurements.mjs`, and `lib/agentic-checks.mjs` actually compute — never
re-derive this arithmetic by hand or in prose; call the code.

## 1. When

`deliveryMode: "agentic"` in `estimation-inputs.json` means AI coding agents
write the code and humans plan and review. In this mode, measurement-based
estimation **replaces the technique menu entirely** — there is no factor
scoring, no three-point PERT judgment, no AI-category assignment
(`references/techniques.md` and `references/ai-multipliers.md`'s category
table do not apply). Every task instead gets a `shape`
(`references/task-shapes.md`), a `scope`, and `seedMinutes`; the script does
the rest.

## 2. Dataset

Historical execution data lives in one global, append-only file:
`~/.agents-rock/measurements.jsonl` (`DEFAULT_MEASUREMENTS_PATH` in
`lib/measurements.mjs`). One JSON object per completed task, written by the
(deferred) `record-task` skill. `estimation-inputs.json` may override the
path via top-level `measurementsPath` (used by tests, and by any project
that wants a scoped dataset).

Each measurement record carries a `repository` field. `agentContext.repository`
in `estimation-inputs.json` (optional, validated non-empty when set by
`lib/schema.mjs`) tells the ladder which repository's history this estimate
targets; when absent, `lib/rollup.mjs` falls back to the top-level `project`
name. Set it explicitly whenever the project's repo name differs from
`project` — rung 1 of the ladder (below) can only match on `repository` when
it means the same string on both sides.

A missing file is the cold-start case, not an error: every task renders
UNCALIBRATED and the estimate still produces a full deliverable — this is
designed behavior, not a degraded mode. Corrupt lines are skipped with a
warning, never fatal.

## 3. Ladder

Per task, filter measurements to matching `task_shape`, then walk rungs
top-down and stop at the first rung with enough samples:

```text
1. shape + repository + agent + model   (>= 3 samples)
2. shape + agent                        (>= 3 samples)
3. shape + similar scope (affectedFiles within ±50%)   (>= 3 samples)
4. shape alone (global)                 (>= 1 sample)
5. no match → UNCALIBRATED (use seedMinutes)
```

Rungs 1–3 require at least 3 samples before they're trusted; rung 4 accepts
any evidence over none. A task matches against its own **effective model**:
the task's own `model` override if it set one, else `agentContext.model` —
so a plan-with-frontier / code-with-cheaper workflow matches planning tasks
against the planning model's history and coding tasks against the coding
model's history, even inside the same estimate.

## 4. Math

Three bands, keyed on how many samples the ladder matched (`n`):

```text
n >= 5:
  σ_log  = ln(p95 / p50) / 1.645     # lognormal fit from percentiles
  e      = p50 · exp(σ_log² / 2)     # lognormal MEAN — means sum, medians don't
  σ_task = e · √(exp(σ_log²) − 1)

1 <= n < 5:
  e = median(matched actual_minutes)
  σ = (seed.p − seed.o) / 6          # spread borrowed from the seed

n = 0:
  e, σ from seedMinutes via the existing pert() — UNCALIBRATED
```

At `n >= 5` there's enough data to fit percentiles into a lognormal
distribution and take its mean — task expected values are **lognormal
means**, so they sum correctly across a feature (medians don't sum). Below 5
samples there isn't enough to fit a distribution, so the matched median
stands in for `e` and the seed's spread stands in for `σ`. With zero samples
the task falls back entirely to the agent's own `seedMinutes` judgment
through the existing PERT formula.

No `verificationPct` in agentic mode: `actual_minutes` in a measurement
record is full-cycle wall clock — AI execution, corrections, tests, **and**
human review — so the baseline already contains review time. Adding a
verification percentage on top would double-count it.

Risks use the same `risks` array as team mode, but agentic entries carry
`impactMinutes` (the script converts to hours) instead of `impactHours`, and
every risk requires a `probability`, an impact, and a `reason` — a generic
"+30 min contingency" with no reason is refused the same as in team mode.

## 5. Decomposition rule

An agentic decomposition must include human-side operations, not just agent
typing time: **at least one `planning`-shaped task**, or the validator
refuses the deliverable (`agenticFindings` in `lib/agentic-checks.mjs`).
Planning captures the human time to design, sequence, and decompose the
work — real time, and it belongs in the estimate.

`seedMinutes` (`o`/`m`/`p`, optimistic/most-likely/pessimistic) is the
agent's **only** duration judgment call in this mode, and it only surfaces
in the final number when history is missing (`n = 0`, band 3 above). When a
baseline exists, the seed is ignored for `e` and used only to borrow spread
at `1 <= n < 5`.

## 6. Confidence

| Samples | Variance | Confidence |
| --- | --- | --- |
| ≥ 10 | low (p80/p50 < 2) | HIGH |
| ≥ 10 | high (p80/p50 ≥ 2) | MED |
| 3–9 | any | MED |
| 1–2 | any | LOW |
| 0 | — | UNCALIBRATED |

A large sample count alone doesn't earn HIGH: if the matched history itself
is unpredictable (p80 is at least double p50), confidence is demoted to MED
even at 10+ samples — the variance rule catches a shape whose duration
genuinely varies a lot, where a tight point estimate would be dishonest.
UNCALIBRATED is never rendered as a measured confidence level, and it ranks
below LOW project-wide: one uncalibrated task on the critical path stamps the
whole estimate UNCALIBRATED.

## Sources

- Bernhardsson, *Why software projects take longer than you think: a
  statistical model* (erikbern.com, 2019) — lognormal task-duration
  distributions, and why the mean (not the median) is the number that sums
  correctly across a project.
- Vacanti, *Actionable Agile Metrics for Predictability* — percentile-based
  cycle-time forecasting from historical data, non-normal distributions.
- Atomic Object (atomicobject.com) — risk as probability × impact, and the
  root-sum-of-squares (`√Σσ²`) spread arithmetic. Agentic mode keeps a σ per
  task but builds no project buffer; team mode uses `√Σσ²` only for the price
  spread in `project-price.mjs`.
- The `1.645` constant is the standard normal 95th-percentile z-score,
  applied in log space to fit a lognormal from `p50`/`p95`.

The constants above — `1.645`, the ±50% scope-similarity window, and the
sample thresholds (3 for rungs 1–3, 5 for the lognormal fit, 10 for HIGH
confidence) — are documented starting points, not settled science: tune them
against real measurement data as `measurements.jsonl` grows.
