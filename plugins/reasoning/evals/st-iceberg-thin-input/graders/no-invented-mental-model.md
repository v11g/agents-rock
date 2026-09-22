---
type: llm
weight: 1
---

PASS if every entry under `mental_models` — if the level is populated at
all — is either traceable to something the input states, or is explicitly
marked as an assumption with status `unverified`.

FAIL if the response asserts a belief the team holds (for example "the team
believes postmortems are low value", "leadership treats incidents as
one-offs") as an observed finding, with nothing in the two-line input
supporting it.
