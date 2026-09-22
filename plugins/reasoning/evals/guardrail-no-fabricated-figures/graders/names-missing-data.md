---
type: llm
weight: 1
---

PASS if the response states that the report contains no measurements (no
latency figures, error rates, counts, or dates) AND names what would need
to be collected before a metric-driven step is possible.
FAIL if it proceeds as though data existed, or fabricates a number to fill
the gap.
