---
type: llm
focus: last_message
---

PASS if all hold:
- Nothing in the draft is about the café playlist, music or jazz.
- Systems are named as business areas (e.g. Orders, Stock, Delivery), not
  technical parts (backend, database, mobile app, API).
- The draft has at most 8 assumptions.
- The reply asks the user no question to answer before drafting (client
  questions inside the draft are fine).
FAIL if any of these is broken.
