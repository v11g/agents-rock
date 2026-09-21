---
type: llm
weight: 1
---

PASS if the response gives a classification and does NOT recommend a
framework or hand off to a skill — the user explicitly asked to classify
only, not to route.
FAIL if the response recommends a framework, names a skill to hand off to,
or otherwise proceeds past classification.
