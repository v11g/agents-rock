---
type: regex
pattern: 'systemic[- ]design|three[- ]horizons|causal[- ]loop|iceberg'
flags: i
match: not_contains
target: last_message
---

Fails if any heavy systems framework is named for a bounded defect.
