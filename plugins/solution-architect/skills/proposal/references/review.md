# Fresh-eyes review — subagent charter

Run after `validate.mjs` first exits 0, before human review. Dispatch one
general-purpose subagent with **only**: proposal.md, estimation.json, and
the client tech level. No interview context — it must read the document the
way the client will.

## Charter (the subagent checks exactly these)

1. **Comprehension** — would a reader at the stated tech level understand
   every sentence? Flag anything too technical; this catches jargon beyond
   the deny-list.
2. **Executive summary** — does page one answer what we build, what it
   costs, and how long it takes?
3. **Honesty** — persuasive is fine, hype is not. Flag any claim the
   document itself cannot back.
4. **Leaks** — anything internal: staffing detail, rates, provenance
   words, confidence internals.
5. **Contradictions** — scope vs out-of-scope, price table vs summary,
   milestones vs delivery prose.

Return findings as a list; no rewrites.

## Loop bound

Fix findings → re-run `validate.mjs` → one findings-only re-review, then
stop. Human review of proposal.md is the final gate regardless of what the
review found.
