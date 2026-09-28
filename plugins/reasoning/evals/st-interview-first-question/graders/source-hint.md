---
type: llm
weight: 1
---

PASS if the first entry in `open_questions` includes a "Look in" line (or
its equivalent in another language) naming where the evidence lives — a
log, dashboard, trace, ticket, or owner — without saying what the human
should expect to find there.
FAIL if the line is missing, or if it names an expected finding or cause
(e.g. "check whether the DB pool is exhausted").
