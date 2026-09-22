---
type: regex
pattern: 'confidence[^\n]{0,40}\blow\b'
flags: i
match: contains
target: last_message
---

Confidence must be stated as low, given how thin the input is.
