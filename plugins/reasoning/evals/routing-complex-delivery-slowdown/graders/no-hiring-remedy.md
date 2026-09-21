---
type: regex
pattern: 'hire|hiring|add (more )?(people|engineers|headcount)'
flags: i
match: not_contains
target: last_message
---

Fails if the response reaches for the trap answer — hiring or adding
headcount — instead of routing the problem to a reasoning skill.
