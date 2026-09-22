---
type: llm
weight: 1
---

PASS if, for any element kind the response recorded but produced no
intervention for, it says so explicitly with a reason ("none identified,
because …") rather than omitting the kind silently.

FAIL if a recorded kind simply disappears between `elements` and `points`
with no statement either way.
