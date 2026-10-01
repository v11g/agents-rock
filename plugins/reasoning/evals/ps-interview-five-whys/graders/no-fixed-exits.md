---
type: regex
pattern: 'Stop, analyze now|[`"*/|•-][ \t]*Don.t know[ \t]*([`"*/|]|\n|$)'
flags: i
match: not_contains
target: last_message
---

Headless, the first open question carries its two options without the
fixed exits. "Don't know" counts only as an option label (set off by a
separator, quote, or bullet), not in a sentence like "I don't know why".
