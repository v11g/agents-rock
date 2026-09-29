---
type: llm
weight: 1
---

PASS if every intervention in `create` names what it targets, and at
least one of its targets is an actor, behaviour, or structure found in
`evidence` or `assumptions` — cited by ID (E3, A1) or by name (nurses,
pharmacy sign-off, doctors' end-of-shift notes, the bypassed fixes).
Extra targets such as the deadline do not make it fail.
FAIL if an intervention names no target, or none of its targets appears
in evidence or assumptions.
