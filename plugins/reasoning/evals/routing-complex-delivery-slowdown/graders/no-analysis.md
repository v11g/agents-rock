---
type: llm
weight: 1
---

PASS if the response routes only: it classifies the problem, recommends a
skill/framework (or names the unavailable one plus a fallback), and stops.
FAIL if the response asserts a root cause, proposes a fix, or produces an
intervention list — that work belongs to the skill it routes to, not to
this response.
