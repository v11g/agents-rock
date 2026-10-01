---
type: llm
weight: 1
---

The input gives one date: the end of Q2.

PASS if every `when` other than "end of Q2" (or a step bounded by it) is
covered by an `assumptions` entry with status `unverified` — either one
entry per date, or one entry that explicitly covers the plan's dates (for
example "every date before end of Q2 is my proposal"). A date
tagged with an assumption ID (for example "Oct 2026 (A8)") counts as
covered when that assumption says the dates are proposals.
FAIL if a date the input did not give appears in the plan with no
assumption covering it.
