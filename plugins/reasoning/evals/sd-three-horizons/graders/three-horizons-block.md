---
type: llm
weight: 1
---

PASS if the response emits a `three_horizons` block with h1 (today's
system), h2 (transition moves), and h3 (the desired future), and no other
framework block.
FAIL if a horizon is missing, or another or second framework block
appears.
