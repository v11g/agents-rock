---
type: llm
weight: 1
---

Only two setup questions are forbidden: choosing a depth mode (QUICK /
STANDARD / DEEP), and asking where the user's answers will come from (the
client vs their own understanding).

PASS if the reply asks neither. A statement of the depth ("Depth:
STANDARD", "STANDARD, the default") is not a question. A question about
scope mode (workflow vs classic) is allowed and does not count.
FAIL only if the reply asks the user to pick a depth, offers depth modes
as choices, or asks where their answers come from.
