---
type: llm
weight: 1
---

The iceberg's `structures` level is empty: the input gives an event and a
pattern, nothing about what produces them.

PASS if the first entry in `open_questions` is a question asking for
evidence that would fill that gap, and uses details from this input (its
figures, times, or components) rather than generic wording.
FAIL if it asks about something the input already answers, or is generic
enough to fit any incident, or if `open_questions` is absent.
