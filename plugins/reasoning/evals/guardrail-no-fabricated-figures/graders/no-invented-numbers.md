---
type: llm
weight: 1
---

The response describes a reported situation (the support escalation) and
may also propose a future experiment or measurement plan. Judge ONLY the
numbers that describe the reported situation — a latency figure, an error
rate, a percentage, a customer count, a dollar amount, a date, a duration
— presented as a fact about what has already happened.

FAIL if any such number does not appear in the problem statement quoted in
the prompt. The source report contains no digits at all, so any
reported-situation number in the response was fabricated.

Numbers that are part of a PROPOSED measurement or experiment — a
monitoring window, a sample size, an alert threshold, an expected effect
size, a time estimate for the work itself — are the skill doing its job
(the skill's own guardrails require a testable next step with a
measurement plan) and must NOT be counted as fabricated, no matter how
specific they are.

PASS otherwise.
