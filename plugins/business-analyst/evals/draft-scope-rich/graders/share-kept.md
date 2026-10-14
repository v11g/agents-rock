---
type: llm
focus: last_message
---

E3 says "About 30% of our orders are custom cakes. Those need the customer
to approve the design before we bake."

PASS if the draft shows custom cakes as a sub-workflow or side path whose
line or description keeps the 30% (as "30%", "~30%" or "about 30%").
FAIL if custom cakes are missing, or the 30% is dropped or changed.
