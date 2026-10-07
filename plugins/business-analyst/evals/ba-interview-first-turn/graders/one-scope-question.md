---
type: llm
weight: 1
---

The PRD names two business areas (Warehouse operations, Invoicing), each
with its own features, and draws a to-be workflow. The user named no
scope mode.

PASS if the reply asks the user exactly one question, that question
confirms the scope mode (workflow vs classic), workflow is the
recommended option, and the recommendation cites evidence from this PRD
(the named areas or the workflow diagram).
FAIL if the reply asks two or more questions, asks something else first,
recommends classic, or recommends workflow without naming any evidence.
