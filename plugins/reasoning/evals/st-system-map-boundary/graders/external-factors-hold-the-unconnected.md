---
type: llm
weight: 1
---

The CRM migration and the compliance deadline are named in the input, but
the input states no relationship between either of them and the
sales/provisioning/platform flow.

PASS if both are placed in `external_factors`, or are otherwise explicitly
held outside the system boundary.

FAIL if either is wired into `relationships` or `dependencies` with a
connection the input never states, or if either is silently dropped from the
output entirely.
