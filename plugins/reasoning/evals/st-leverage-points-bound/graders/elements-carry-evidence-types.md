---
type: llm
weight: 1
---

PASS if every row in `elements` carries an evidence type from the contract
(`user-provided fact`, `document`, `log`, `metric`, `interview`,
`observation`, `external source`, `inferred`), and anything the input did
not state is tagged `inferred` rather than presented as observed.

FAIL if any element is listed with no evidence type, or if something the
input never states — a belief about what the seniors want, an unstated team
goal — is tagged as a fact.
