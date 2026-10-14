---
type: llm
focus: last_message
---

E2 promises "next-morning delivery"; C1 says "Same day, if the order is in
before 10am."

PASS if one client question puts both promises side by side (quoting or
naming next-morning and same-day) and asks which holds.
FAIL if the draft picks one silently, or never mentions the conflict.
