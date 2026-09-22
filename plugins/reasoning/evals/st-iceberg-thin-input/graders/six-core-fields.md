---
type: llm
weight: 1
---

PASS if the response emits all six core contract fields: `problem`,
`framework_used`, `framework_reason`, `evidence`, `assumptions`, and
`open_questions`. Accept heading, field, or table rendering, and accept an
empty list where the field genuinely has no content, provided the field
itself is present.

FAIL if any of the six is absent entirely.
