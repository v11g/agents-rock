---
type: regex
pattern: '```mermaid'
flags: i
match: not_contains
target: last_message
---

An iceberg is a four-level stack, not a cycle. Under the contract's
rendering rule a diagram appears only where the structure contains a cycle,
so this run must produce prose.
