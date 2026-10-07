---
type: llm
focus: trace
---

Workflow mode asks at most three things: whether a human reviewed
ARCHITECTURE.md (the user already said yes, so re-asking is allowed but not
required), the score-review hand-off, and a closing "anything to change?".

PASS if every question the agent asked the user is one of those three.
Asking no question at all is a PASS: a run that stops at a gate asks nothing.
FAIL if it asked about depth, delivery mode, agent or model, milestones,
scope confirmation, review channel, stack familiarity, deadline or budget.
Stating a fixed choice ("agentic + STANDARD") is not a question.
