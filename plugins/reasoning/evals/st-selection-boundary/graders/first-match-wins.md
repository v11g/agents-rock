---
type: llm
weight: 1
---

This input matches several rows of the skill's selection table at once: it
asks where to push (row 1), names four actors with unclear relationships
(row 3), and describes a recurring symptom with unexamined layers (row 4).

PASS if the response selects `leverage_points`, because row 1 matches first
and the table is read top-down with the first match winning. The response
must make clear that the selection came from the "where should we be
pushing" ask, not from a general impression of fit.

FAIL if the response selects `iceberg`, `system_map`, or `causal_loop`
without the human having overridden the recommendation, or if it selects
`leverage_points` while giving a reason unrelated to the intervention ask.
