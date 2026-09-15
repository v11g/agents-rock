# AI multipliers — categories, formula, seniority, the blanket-multiplier ban

Read while assigning a `category` to each task and again while choosing
`verificationPct`. Defines what each AI-speedup category means concretely,
how the formula in `estimate-math.mjs` uses it, and the one rule that keeps
an agent from inventing a project-wide speedup number.

**In AGENTIC delivery mode this model is retired from estimation** —
measurement-based baselines (`references/agentic-estimation.md`) replace
category scoring and the formula below entirely; agentic tasks carry a
`shape`, not a `category`, and `schema.mjs` rejects `category` on an agentic
task outright. This doc's model survives only as intuition for
`seedMinutes` on an uncalibrated shape — the categories below are a useful
gut-check for an o/m/p seed guess, nothing more, in that one case. For
TRADITIONAL scenarios (humans code, with or without AI-assisted plans), the
categories and formula below are unchanged.

## 1. Category table

| Category | AI speedup range | Example tasks |
| --- | --- | --- |
| `boilerplate` | 50-80% | CRUD endpoint, DB migration, form scaffold, DTO/type definitions, config wiring, standard test scaffolding |
| `logic` | 20-40% | validation rules, state machines, pricing/scheduling rules, non-trivial data transforms, API integration glue |
| `novel` | 0-10% | new algorithm design, novel UX interaction, unfamiliar third-party API with thin docs, performance-critical tuning, security-sensitive design |

Pick the category per task, not per feature or per project — a feature that
mixes a CRUD endpoint (`boilerplate`) with a pricing rule engine (`logic`)
has tasks in both categories.

## 2. Formula

The blended AI-adjusted estimate for a task is:

```
(AO + 2×AR + TR) / 4
```

where `TR` is the task's seniority-scaled hours with no AI help, `AR` is TR
reduced by the category's average speedup, and `AO` is TR reduced by the
category's *maximum* speedup — the optimistic case weighted at 1, the
average case weighted at 2, so a single lucky run doesn't drag the whole
estimate down. This doc explains the formula; the code computes it, in
`taskHours()`/`aiAdjust()` in `scripts/lib/estimate-math.mjs`. Never
re-derive this arithmetic by hand or in prose — call the function.

## 3. Seniority scaling

Task PERT hours assume a mid-level engineer. `SENIORITY_FACTOR` scales the
**base effort** on every path — traditional and AI alike:

| Seniority | Factor | Effect |
| --- | --- | --- |
| junior | 1.15 | slower baseline — same task takes 15% longer |
| mid | 1.0 | baseline, no scaling |
| senior | 0.85 | faster baseline — same task takes 15% less |

The AI reduction itself is a property of the task category, not of the
engineer: scaling the reduction by seniority (an earlier draft of this
model) made juniors come out *faster than seniors* on AI plans, which no
delivery data supports. With base-effort scaling, a senior with AI is always
at or below a junior with AI on the same task.

## 4. Verification overhead

Default `verificationPct` is **12%**, added on top of the blended AI-adjusted
hours. AI output is not free to trust: someone still reads the diff, runs
it, and checks it against the actual requirement. Skipping this line item
means the estimate only counts the time to generate code, not the time to
ship code — the two are not the same number.

## 5. Blanket-multiplier prohibition — hard rule

**Never apply a single AI speedup percentage to a whole project or a whole
feature.** Assign category and speedup per task, and let the formula roll
totals up from there.

The reason: a project that is 70% faster on its CRUD tasks is not 70% faster
overall. The CRUD tasks might be 20% of total hours; the other 80% is
`logic` and `novel` work where AI barely moves the needle. Blending at the
project level erases that mix and produces a number nobody can defend.

## Tooling seat cost

Seat pricing is an interview input (`toolingCostPerSeat`, per seat per
month, any vendor), not a constant — see `interview.md` §4 question 5. It
prices `toolingCost = months × seat cost × team size` and never touches
hours; only `aiAssisted` gates the per-category reduction above.

## Sources

- Formula `(AO + 2×AR + TR) / 4`, per-category reduction ranges, and the
  non-uniform-acceleration warning — Kmino, *Software Estimation with AI*
  (kmino.io/blog/software-estimation-with-ai). Published practitioner
  observations, not peer-reviewed data. Kmino also varies AI gains by
  seniority; this skill departs from that and scales base effort instead
  (see §3 for why).
- Blanket-multiplier prohibition — Kmino's caveat, promoted to hard rule here.
- Capacity and calibration constants (`HOURS_PER_MONTH`, `COORDINATION_TAX`,
  seniority factors, 12% verification overhead) — this skill's own defaults,
  not sourced; tune against real delivery history.
- Plan prices — manual snapshot, see the dated table above.
