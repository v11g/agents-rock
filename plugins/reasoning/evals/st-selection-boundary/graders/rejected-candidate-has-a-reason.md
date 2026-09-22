---
type: llm
weight: 1
---

PASS if the response shortlists a second framework alongside its pick and
gives a specific reason that one was not chosen — a reason that refers to
something in THIS input, not a generic description of the framework.

FAIL if only one framework is ever named, or if a second is listed with no
reason, or with a reason that would read identically for any problem.
