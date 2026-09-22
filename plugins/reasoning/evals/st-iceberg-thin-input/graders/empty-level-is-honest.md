---
type: llm
weight: 1
---

This input supports an event and a pattern. It says nothing about the
structures or beliefs underneath.

PASS if at least one of `structures` or `mental_models` is rendered empty
(or as explicitly unsupported), together with a statement of what evidence
would fill it.

FAIL if all four levels are populated with confident content, or if an
empty level is left bare with no indication of what would fill it.
