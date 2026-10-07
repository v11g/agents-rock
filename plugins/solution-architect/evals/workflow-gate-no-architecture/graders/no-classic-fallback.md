---
type: regex
pattern: '\b(QUICK|DEEP)\b|technique'
flags: i
match: not_contains
target: last_message
---

No depth question (QUICK/STANDARD/DEEP) and no technique menu: those belong
to the classic flow.
