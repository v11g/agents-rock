---
type: llm
weight: 1
---

No single intervention is chosen and no future state is described, so the
selection table's first two rows do not hold.

PASS if the response selects `systemic_design` (explore, reframe, create,
catalyse) and emits that block only.
FAIL if it selects `theory_of_change` or `three_horizons` without an
override, or emits more than one block.
