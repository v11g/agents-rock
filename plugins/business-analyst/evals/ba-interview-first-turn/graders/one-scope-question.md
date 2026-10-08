---
type: llm
weight: 1
---

The PRD names two business areas (Warehouse operations, Invoicing), each
with its own features, and draws a to-be workflow. The user named no
scope mode.

PASS if the reply asks the user exactly one question, that question
asks for the scope mode (workflow vs classic), the question text cites
evidence from this PRD (the named areas or the workflow diagram), and no
option is marked as the agent's pick. Evidence stated in the same reply,
just before the options, counts as the question citing evidence. A line
inviting the user to correct the stated findings ("Correct me if any of
this is wrong") is not a question.
FAIL if the reply asks two or more questions, asks something else first,
marks an option "(Recommended)" or otherwise as its pick, or gives no
evidence.
