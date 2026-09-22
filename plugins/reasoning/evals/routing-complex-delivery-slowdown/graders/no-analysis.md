---
type: llm
weight: 1
---

PASS if the response routes only: it classifies the problem, explains why
it landed on that class (citing the input's evidence and describing the
mechanism that evidence shows — e.g. a feedback loop, actors adapting
around a prior fix), recommends a skill/framework or names the
unavailable one plus a fallback with the fallback's limitation stated,
and stops there. All of the following are normal parts of routing, not
analysis, and must NOT by themselves cause a FAIL: justifying the class
at length; naming each rejected framework with a one-line reason;
presenting the human with routing options to choose between (which
fallback framework to use, whether to wait, whether to classify-only).

FAIL only if the response asserts a specific root cause for the team's
underlying problem (as opposed to a reason for the classification),
proposes a concrete fix or countermeasure aimed at the team's situation,
or produces a list of interventions meant to solve the problem — as
opposed to a list of framework or routing options for the human to pick
from. That determination is the job of the skill this response routes
to, not this response.
