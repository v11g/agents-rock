# AI multipliers — categories as vocabulary, not math

Read while assigning a `category` to each task. Defines what each
AI-speedup category means concretely, and the reasoning that used to keep
an agent from inventing a project-wide speedup number — now reframed as
why v2's scoring weights land where they do.

**Pricing moved to scores.** `pricing.mjs`'s weighted score and bands
(`references/scoring-guide.md`, `references/techniques.md`) price every
STANDARD/DEEP feature; nothing here computes an hour figure or a dollar
figure any more. `taskHours()`/`aiAdjust()` are gone from
`estimate-math.mjs` — do not describe a formula that isn't there. The
categories below survive as **planning vocabulary only**: tagging a task's
shape for the task table, and a gut-check for `seedMinutes` on an
uncalibrated agentic shape (`references/agentic-estimation.md`). They no
longer discount anything.

**In AGENTIC delivery mode this model plays no pricing role at all** —
measurement-based baselines (`references/agentic-estimation.md`) replace
category scoring entirely; agentic tasks carry a `shape`, not a `category`,
and `schema.mjs` rejects `category` on an agentic task outright.

## 1. Category table

| Category | AI speedup range | Example tasks |
| --- | --- | --- |
| `boilerplate` | 50-80% | CRUD endpoint, DB migration, form scaffold, DTO/type definitions, config wiring, standard test scaffolding |
| `logic` | 20-40% | validation rules, state machines, pricing/scheduling rules, non-trivial data transforms, API integration glue |
| `novel` | 0-10% | new algorithm design, novel UX interaction, unfamiliar third-party API with thin docs, performance-critical tuning, security-sensitive design |

Pick the category per task, not per feature or per project — a feature that
mixes a CRUD endpoint (`boilerplate`) with a pricing rule engine (`logic`)
has tasks in both categories.

## 2. Blanket-multiplier prohibition — hard rule, now a weighting rule

**Never apply a single AI speedup percentage to a whole project or a whole
feature.** The reason still holds: a project that is 70% faster on its CRUD
tasks is not 70% faster overall — the CRUD tasks might be 20% of the total,
the rest is `logic` and `novel` work AI barely moves the needle on.
Blending speedup at the project level erases that mix and produces a number
nobody can defend.

v2 encodes this directly in the score weights instead of a per-task
formula: feature **size** is the lightest weight at 10% (raw volume of code
is cheap when an agent writes most of it), and **uncertainty** is the
heaviest at 30% (unclear requirements are not cheap regardless of who
writes the code). The weights are the fix now, not a per-task calculation —
see `references/scoring-guide.md` and `references/techniques.md` §2.

## Sources

- Category definitions and per-category reduction ranges — Kmino,
  *Software Estimation with AI* (kmino.io/blog/software-estimation-with-ai).
  Published practitioner observations, not peer-reviewed data.
- Blanket-multiplier prohibition — Kmino's caveat, carried forward as the
  reasoning behind v2's asymmetric factor weights.
