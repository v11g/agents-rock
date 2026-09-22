---
type: llm
weight: 1
---

PASS if the response carries all six core fields from the output contract:
the problem restated, the framework used, the reason for that framework,
evidence, assumptions, and open questions.

Rendering varies and any of it counts: a markdown heading ("## Open
questions"), a YAML key (`open_questions:`), a bold label ("**Framework
reason:**"), or a labelled table row. The snake_case name and its prose
spelling both count. For a routing run `framework_used` names the router
itself, because no analysis framework ran — that still counts as present.

A field counts as present when it is both labelled and carries content.
Content may be an explicit statement of emptiness ("none", "no evidence in
the input") — that is a finding, not an omission.

FAIL if any of the six is missing: not labelled anywhere in the response, or
labelled with nothing at all under it.
