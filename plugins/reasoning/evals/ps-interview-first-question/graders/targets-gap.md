---
type: llm
weight: 1
---

RCA's `contributing` (or deeper) layer is empty: the input names the 504
but nothing about why upstream is slow.

PASS if the first entry in `open_questions` is a question asking for
evidence that would fill that gap, and uses details from this input (its
figures, times, or components) rather than generic wording.
FAIL if it asks about something the input already answers, or is generic
enough to fit any incident, or if `open_questions` is absent.
