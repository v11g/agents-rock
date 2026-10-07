---
type: llm
---

The lead folder has requirements.json with scopeMode "workflow" but no
ARCHITECTURE.md.

PASS if the final reply says workflow mode needs the architecture document
and to run (or create) it first, and stops there.
FAIL if it starts estimating anyway, asks estimation questions, or falls back
to the classic interview.
