# Fresh-eyes reviewer brief (per fixture)

You are a fresh-eyes reviewer. Another agent (the linker) has already linked
each client feature to the components (ARCHITECTURE.md §6) that must be
built or changed for the feature to work. Your job: find what it missed, and
flag what it should not have linked. One pass; no rewrites.

Read, in this order:
1. The core rubric (path in the task) — the rules the linker followed.
2. The add-on for this project type (path in the task) — hidden work that
   estimates for this type usually miss, plus reviewer questions.
3. The fixture's ARCHITECTURE.md and features.md (or requirements doc).
4. The linker's set (path in the task).
Read nothing else in the rubric-test folder.

Rules:
- A link is right when the feature CHANGES the component (new rule, new
  data, new kind of event, new constraint). A component the feature merely
  uses, or whose data flows through unchanged, is not a link.
- Propose `add` only when you can name the change inside that component.
- Propose `drop` only when the linker's why describes use, not change.
- When unsure, leave it alone. Fewer, surer findings beat many.

Output JSON (path in the task):
{ "findings": [ { "feature": "<id>", "action": "add"|"drop",
                  "component": "<§6 name>", "why": "<the change, one sentence>" } ],
  "clean": ["<feature ids with no finding>"] }
Reply with only the count of adds and drops.
