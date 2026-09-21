---
type: llm
weight: 1
---

Read fixtures/delivery-slowdown-thread.md and compare it against the
response. PASS if every number the response states (headcount, dates,
percentages, counts, durations, or any other figure) also appears
somewhere in fixtures/delivery-slowdown-thread.md. FAIL if the response
states any number that is not present in that file — the source thread
contains no numbers at all, so any number in the response was fabricated.
