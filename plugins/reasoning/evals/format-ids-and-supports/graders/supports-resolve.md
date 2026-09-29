---
type: llm
weight: 1
---

PASS if every `evidence` entry shows an id (`e1`, `e2`, …) and a
`supports` list, and every id in those lists names a `c`-prefixed item
that appears in the `five_whys` block.
FAIL if any evidence entry has no id, has no `supports` list, or lists an
id that no framework item carries.
An empty list `[]` counts as a list and passes.
