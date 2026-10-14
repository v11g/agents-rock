---
type: llm
focus: last_message
---

C1 says "Orders come in by WhatsApp, that stays." and "The courier company
handles routes, not us."

PASS if both hold:
- WhatsApp ordering is kept as-is: an assumption, an exclusion, or a scope
  line saying ordering stays on WhatsApp; no feature replaces WhatsApp.
- Delivery routes are excluded with a reason that says the courier owns
  them (owned by someone else).
FAIL if either is missing, or a feature plans or optimises delivery routes.
