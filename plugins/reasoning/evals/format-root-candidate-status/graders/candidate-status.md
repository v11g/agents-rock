---
type: llm
weight: 1
---

The input gives no evidence for any cause.

PASS if the deepest cause in the `rca` block has a `c`-prefixed id and
carries `status: root_candidate` (or renders the status `root_candidate`
next to it).
FAIL if any cause carries `status: root`, or if the cause has no id.
