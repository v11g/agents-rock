# Fresh-eyes review

After validate.mjs passes, dispatch ONE subagent with fresh eyes over both
artifacts. Give it the two file paths and this checklist verbatim. Apply
its findings, re-run validate.mjs, and stop after one cycle — do not loop.

No subagent available (e.g. claude.ai) → run this checklist yourself and
write `Review: self-reviewed, no fresh eyes available` in the Part 5
readiness report.

## Checklist

1. **Invented requirements**: is any `confirmed` item unsupported by a
   quoted source? Downgrade to `assumed` or `recommended`.
2. **Hidden solutioning**: does any FR, system name or feature name
   prescribe a technology or architecture ("use SharePoint webhooks",
   "Order API")? Rewrite as a capability.
3. **Vague requirements**: any FR that two reasonable readers would
   implement differently? Flag with the two readings.
4. **Missed contradictions**: do any two statements (rules, scopes,
   answers) conflict without a CONFLICT- entry?
5. **Unlabeled scope**: any capability discussed in Parts 1–2 that appears
   in no FR and no scope list (out / future / unconfirmed)?
6. **Readiness honesty**: do the area scores overstate what Parts 1–4
   actually contain? Name the section that contradicts the score.
7. **Traceability spot-check**: pick 3 FRs; do their traces point at
   goals/workflows/rules that genuinely motivate them?
8. **Unbuilt steps** (workflow mode): list to-be workflow steps that no
   feature points at. For each, is it work nobody has priced (add it to a
   feature, or raise a question) or a person's manual act (fine as is)?

Report findings as a list: `<artifact>:<id or section> — <problem> — <fix>`.
No praise, no rewrites beyond the flagged items.
