---
type: llm
weight: 1
---

PASS only if ALL of these hold:
- the response asks at most one clarifying question
- every framework it lists as rejected carries a stated reason, not a bare name
- confidence is expressed as low, medium, or high — never a decimal or percentage
- the response does not assert a root cause; it routes, it does not diagnose

FAIL if any one of them is violated.
