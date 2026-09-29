---
type: regex
pattern: '\.reasoning/problems/\d{4}-\d{2}-\d{2}-[a-z0-9-]+'
match: contains
target: last_message
---

The router's hand-off names the problem folder the next skill writes into.
