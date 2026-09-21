---
type: llm
weight: 1
---

PASS if the response states that neither `systems-thinking` nor
`systemic-design` is available in this release. A single sentence of the
form "Neither `systems-thinking` nor `systemic-design` is built/available
in this release" fully satisfies this and must PASS — don't require two
separate sentences. Also accept equivalent phrasing: "not built", "not
available", "does not exist yet", "ships in a later release", or similar,
applied to both skills (together or separately).
FAIL only if the response covers just one of the two skills, or recommends
them as though they were runnable now.
