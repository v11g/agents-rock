---
type: llm
weight: 1
---

The input gives a symptom (late password-reset emails, since Tuesday,
about a third of users) and nothing about why. The why-chain runs out of
evidence after its first link.

PASS if the first entry in `open_questions` is a question asking for
evidence that would answer the next "why", and uses details from this
input (Tuesday, the 20–40 minute delay, the third of users) rather than
generic wording.
FAIL if it asks about something the input already answers, or is generic
enough to fit any incident, or if `open_questions` is absent.
