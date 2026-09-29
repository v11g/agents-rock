---
type: llm
weight: 1
---

The input names: 09:15, Monday, the transfer API, 504 Gateway Timeout,
about 85% of requests, requests hanging before they fail.

PASS if the first entry in `open_questions` offers two answer options, and
each option names at least one of those details or a dimension that splits
them (for example "only transfers" vs "all payment types", "failing
requests hang the full timeout" vs "fail fast").
FAIL if there are no options, if either option would read the same for any
outage (for example "check the logs", "yes / no"), or if an option asserts
a cause (for example "a memory leak", "a bad deploy").
