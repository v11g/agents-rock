---
type: llm
weight: 1
---

Count the separate questions the reply puts to the user. One question
with several answer options counts as one, even when an option carries
its own follow-up ("Both — if so, which areas?"). A summary of what was
extracted before it is fine.

PASS if the reply asks exactly one question, and it is about the coverage
contradiction.
FAIL if the reply asks two or more separate questions (numbered rounds,
"other P1 questions", a "2B, 3A" style answer sheet), or asks something
other than the contradiction.
