# Grade a reviewer's findings against an answer key

Read-only except for one output file. Inputs (paths in the task):
- the answer key JSON (field "key": feature → required components; it may
  carry keyReasons/keyChanges — use them to understand intent)
- the linker's original set (features[].links[].component)
- the reviewer's findings JSON ({ findings: [ {feature, action, component, why} ] })
- the fixture ARCHITECTURE.md + features (for tie-breaks only)

Classify every finding:
- add  → `goodAdd`  if component ∈ key[feature] and ∉ linker set
         `badAdd`   otherwise (not in key, or linker already had it)
- drop → `goodDrop` if component ∉ key[feature]
         `badDrop`  if component ∈ key[feature]
Also compute `stillMissing`: components in key[feature] that are neither in
the linker set nor in a goodAdd.

If a reviewer finding convinces you the key itself was wrong, you may note it
under "keyDisputes" with one sentence — but still grade against the key.

Output JSON (path in the task):
{ "perFinding": [ { ...finding, "grade": "goodAdd"|"badAdd"|"goodDrop"|"badDrop" } ],
  "totals": { "goodAdd": n, "badAdd": n, "goodDrop": n, "badDrop": n, "stillMissing": n },
  "keyDisputes": [...], "patterns": [...] }
Reply with the totals line and patterns only.
