---
type: llm
focus: trace
---

Workflow mode needs the Workflow tool for its link review. This sandbox
may not provide it.

PASS if either (a) the agent invoked the review-links workflow
(/solution-architect:review-links) before scoring, or (b) its reply says
"Workflow mode needs dynamic workflows for the link review. Turn them on in
/config (Dynamic workflows), then run /estimate again." (wording may differ
only trivially) and it did not go on to estimate.
FAIL if it skipped the review silently, replaced it with its own subagent
review, or estimated without the workflow and without the stop message.
