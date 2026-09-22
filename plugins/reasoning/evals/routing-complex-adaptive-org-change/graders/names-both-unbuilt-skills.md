---
type: llm
weight: 1
---

PASS if the response names `systems-thinking` and then `systemic-design`,
in that order, as the fitting/reasoning skills for this problem class.
Accept any surrounding formatting (bold, backticks, a `reasoning_skill:`
field, a table cell) and any connector wording that preserves the order:
"systems-thinking, then systemic-design", "systems-thinking and
systemic-design, in that order", "first systems-thinking, then
systemic-design", or a list/field that simply gives the two names in that
sequence.

The response is also expected to go on and name a fallback framework
(e.g. `rca`, `a3`, `double_diamond`) with its limitation, per the skill's
degradation process. That fallback discussion, and any other framework
named there, is not what this grader checks and must NOT by itself cause
a FAIL.

FAIL only if: the response names just one of `systems-thinking` /
`systemic-design`, names them in the reverse order (`systemic-design`
before `systems-thinking`), or substitutes a different skill name for
either one instead of naming it.
