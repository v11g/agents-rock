---
type: llm
focus:
  source: file
  path: proposal-inputs.json
---

Workflow mode: the agent writes only the sentences, in proposal-inputs.json
beside estimation.json. You are shown that file. The estimate's milestones
are "M1 - Walking skeleton", "M2 - Money" and "M3 - Operations".

PASS if the file has client "Sin Kowa", title "Sin Kowa Digital
Transformation", firm "Code Engine Studio", an ISO date, techLevel
"non-tech", a non-empty scopeIntro, and a "milestones" entry for each of
the three milestone names with a "name" and a "demonstrates" sentence; and
no sentence in it carries a price, a currency amount or an internal ID such
as FEAT-001 or SYS-002.
The keys of "systems" ARE system IDs (e.g. "SYS-001") and the keys of
"milestones" are the estimate's milestone names: both are required by the
format and are not sentences. Check only the string values for prices and
IDs.
FAIL if the file is missing or empty, or if any required key or milestone
entry is missing.
