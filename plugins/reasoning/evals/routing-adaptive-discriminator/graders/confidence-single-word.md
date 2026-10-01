---
type: regex
pattern: 'confidence\W{0,4}(low|medium|high)\s*[-/]\s*(low|medium|high)'
flags: i
match: not_contains
target: last_message
---

Confidence is one word — low, medium, or high. A blend like
"medium-high" fails.
