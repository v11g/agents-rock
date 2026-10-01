---
type: llm
weight: 1
---

The input gives no dates.

PASS if every `when` on an h2 move also appears in `assumptions` with
status `unverified` (or the move says the timing is unknown).
FAIL if any `when` carries a date, quarter, or duration that is not also
recorded as an unverified assumption.
