---
type: regex
pattern: '\d+\s*(%|percent|per cent|days?|weeks?|months?|quarters?|years?|hours?|engineers?|people|devs?|developers?|tickets?|incidents?|PRs?|points?)|\$\s*\d'
flags: i
match: not_contains
target: last_message
---

The source thread contains no digits at all, so any metric-shaped claim in
the response that contains a digit (a percentage, a headcount, a duration,
a dollar figure, and so on) was fabricated. This targets digit-bearing
metric claims specifically, not bare list numbering or spelled-out counts,
so it doesn't false-positive on the response's own enumeration.
