# Blind judge brief (per fixture)

You are a strict senior solution architect judging two engineers' work.
Read-only except for one output file.

Context: an estimate links each client feature to the components (from the
fixture's ARCHITECTURE.md §6) that must be built or changed for the feature
to work. A missing link = work goes unseen; a wrong link = work claimed
where none is needed.

Conventions (apply them in your key):
- Link a database/object store only for store-specific work (a constraint
  enforcing a business rule, a new store/bucket, partitioning, retention or
  locking). Ordinary tables and ordinary file writes belong to the module
  that owns them.
- Link the most specific component, never its container, unless the
  container has no components.
- Shared pieces (login, permissions middleware, app shell, shared plumbing,
  CI/hosting) are linked only when the feature changes them, not merely
  uses them.

Step 1 — BEFORE opening X or Y: read the fixture's ARCHITECTURE.md and
features.md and write your own answer key: per feature, the components that
must be linked, one-line reason each.

Step 2 — read X.json and Y.json. Per set and feature: `missing` (in your
key, absent from the set — reconsider your key honestly if the set convinces
you), `wrong` (in the set but not needed, or its why contradicts the
component's §6 Responsibility). If a set changes your key, fix the key and
record the change.

Output JSON (path given in the task):
{ "key": { "<feature>": ["<component>", ...] }, "keyChanges": [...],
  "X": { "<feature>": { "missing": [...], "wrong": [...] } }, "Y": { ... },
  "totals": { "X": { "missing": n, "wrong": n }, "Y": { "missing": n, "wrong": n } },
  "patterns": ["one line per recurring kind of mistake, naming which set made it"] }
Reply with the totals line and the patterns only.
