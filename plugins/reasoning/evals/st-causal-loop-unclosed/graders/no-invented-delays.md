---
type: llm
weight: 1
---

PASS if `delays` is empty or absent.

FAIL if the response records a delay it inferred on the support-load loop —
for example "there is roughly a one-quarter lag between documentation time
and knowledge gaps" — as a `delays` entry rather than as an assumption.

FAIL if the response records the March-to-April gap as a `delays` entry —
for example "one-month lag between price rise and churn." The input gives
sequence between two dated observations, not a stated causal lag. A delay
describes how long a causal influence takes to propagate, and the
pricing-churn link's causation is not established — the input shows the
events in order, nothing more. A delay cannot sit on a link whose
causation hasn't been established, so recording this gap in `delays` is
invented regardless of the dates being real.
