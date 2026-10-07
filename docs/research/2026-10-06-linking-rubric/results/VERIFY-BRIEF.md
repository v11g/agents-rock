# Verifier brief — one proposed link

You verify ONE proposed addition to an estimate's feature→component links.
Read-only except for one output file. You know nothing about who proposed it.

Read the fixture's ARCHITECTURE.md (§6 component table, §9 externals) and
its features list (paths in the task). Then answer, for the proposed link:

1. Does the §6 Responsibility of this component ALREADY describe the
   behaviour the proposal says the feature needs? (e.g. "partitions and
   retains tables", "fails the build on a breaking diff"). If yes, the
   feature only uses it → REJECT.
2. Does the feature's one-line description ask for this work, or is it
   operational scope nobody asked for (monitoring, alerting, tests, docs
   added "because it would be good")? If not asked for → REJECT.
3. Can you name the concrete change inside this component — a new rule,
   a new field, a new event kind, a new constraint — that this feature
   requires and that §6 does not already list? If yes → ACCEPT.

Decide ACCEPT or REJECT. One sentence why, quoting (≤15 words) the §6
Responsibility text you relied on.

Output JSON (path in the task):
{ "verdict": "ACCEPT"|"REJECT", "why": "...", "quoted": "..." }
Reply with the verdict and why only.
