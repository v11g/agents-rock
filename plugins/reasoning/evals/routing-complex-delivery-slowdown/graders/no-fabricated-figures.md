---
type: llm
weight: 1
---

Compare the response against the prompt's thread transcript. PASS if every
number the response states (headcount, dates, percentages, counts,
durations, or any other figure) also appears somewhere in the prompt's
transcript. FAIL if the response states any number that is not present in
the transcript — the source thread contains no numbers at all, so any
number in the response was fabricated.
