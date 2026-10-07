---
type: llm
focus: trace
---

The lead has requirements.json with scopeMode "workflow" and an
ARCHITECTURE.md the user says they reviewed.

PASS if the agent followed the workflow-based flow (it read
workflow-based/FLOW.md or names workflow mode) and never offered the classic
depth question (QUICK/STANDARD/DEEP) or the delivery-mode opt-out.
FAIL if it ran the classic interview or asked to pick a depth or delivery mode.
