---
type: llm
weight: 1
---

PASS if the response classifies this problem as `complex`, not
`complex-adaptive`, and grounds that on the absence of any actor changing
behaviour in response to the fixes — the input states plainly that nobody
has changed how they work.

FAIL if it classifies the problem as `complex-adaptive`, `simple`, or
`ambiguous`, or gives `complex` without distinguishing it from
`complex-adaptive` on evidence.
