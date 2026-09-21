# problem-router

Classifies a problem and recommends which reasoning skill and framework fit
it, then stops and lets the human decide.

Run `/reasoning:problem-router` (or just describe a problem with no chosen
framework) and the skill extracts what the input states, classifies it as
`simple`, `ambiguous`, `complex`, or `complex-adaptive`, and recommends a
skill + framework with its reasoning — naming what it rejected and why.
Questions are asked only when a different answer would actually change the
routing: a clean, fully-specified problem gets zero, a genuinely split one
gets up to three. It never analyses the problem itself.

## When to reach for it

- The problem arrives with no framework attached: "why does this keep
  happening", "where do I even start", "is this a bug or something bigger".
- You want a second opinion on which framework fits before committing.

Skip it when the problem already names its framework — "run a 5 Whys on
this outage" goes straight to `problem-solving`.

## Worked example

Input: "Our checkout API throws a null pointer exception in
`OrderService.calculateTotal()` whenever a cart has zero items. Reproduces
every time in staging, stack trace attached."

The router classifies this `simple` (one function, reproducible trigger, no
recurrence across teams) without asking anything — the input already
answers the only question that would matter. It recommends
`problem-solving` with `five_whys`, rejecting `Double Diamond` (nothing to
discover, the problem is already well-defined) and `systems-thinking` (no
cross-team dependency in evidence). The human confirms, overrides, or asks
for classification only.

## What it deliberately does not do

- Doesn't name a root cause or propose a fix — that's the receiving skill's
  job, after hand-off.
- Doesn't interrogate a problem that's already clear. Question count scales
  with how ambiguous the input actually is.
- Doesn't downgrade a `complex`/`complex-adaptive` classification just
  because `systems-thinking` and `systemic-design` aren't built yet — it
  says so and offers the closest available option with its limitation named.
- Doesn't emit numeric confidence — only `low` / `medium` / `high`.
