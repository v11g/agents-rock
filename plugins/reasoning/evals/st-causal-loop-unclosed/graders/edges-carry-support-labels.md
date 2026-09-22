---
type: llm
weight: 1
---

PASS if every causal link carries exactly one support label from
`correlation` / `hypothesized` / `evidenced`, AND the March price rise
followed by April churn is labelled `correlation` or `hypothesized` — either
honours the input giving sequence, not demonstrated causation. `hypothesized`
is a legitimate label here: proposing price rise as the cause of the churn
that followed it is exactly what `hypothesized` is for.

FAIL if any link is unlabelled, if a link carries more than one label, or if
the pricing-churn link is labelled `evidenced` — the input never states or
demonstrates the causation, so `evidenced` claims more than the input gives.
