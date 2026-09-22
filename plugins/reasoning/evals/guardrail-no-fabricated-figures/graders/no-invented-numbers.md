---
type: regex
pattern: '\d+\s*(%|percent|per cent|ms|milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?|quarters?|years?|customers?|users?|tickets?|incidents?|requests?|errors?|times?)|\$\s*\d'
flags: i
match: not_contains
target: last_message
---

The source report contains no digits at all, so any metric-shaped claim
in the response that contains a digit (a latency figure, an error rate, a
percentage, a customer count, a dollar amount, a date, and so on) was
fabricated. This targets digit-bearing metric claims specifically, not
bare list numbering or spelled-out counts, so it doesn't false-positive on
the response's own enumeration.
