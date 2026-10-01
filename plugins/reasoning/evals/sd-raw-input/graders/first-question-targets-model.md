---
type: llm
weight: 1
---

PASS if the first entry in `open_questions` asks for a missing piece of
the system model — why the offices ignore the policy, how they are
measured, who enforces pricing — using this input's details (regional
sales offices, the pricing policy, head office).
FAIL if it asks about something the input answers, is generic enough to
fit any problem, or `open_questions` is absent.
