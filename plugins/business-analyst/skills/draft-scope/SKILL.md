---
name: draft-scope
description: Draft a workflow-based scope document (problems, systems, workflow steps, features, assumptions, client questions) from raw client emails, call transcripts or notes, as an editable DOCX the PO corrects before using the business-analyst skill. Use when the user has only raw client material, no scope document yet, and asks to draft the scope, systems, workflows or features from it.
---

# draft-scope

Turns raw client material into a first draft of the scope document a PO
would otherwise write by hand: systems, their workflow steps, features,
assumptions and exclusions, plus the problems heard and the questions to
ask the client. The PO edits the DOCX in Word or Google Docs, then uses it
with the business-analyst skill.

## Rules that hold in every step

1. Ask the user nothing. Every gap becomes a client question (step 3f).
2. Every line cites a source id (E1, C1, N1). Quotes are the source's exact
   words. Anything you cannot source, cut.
3. One draft only. No alternative drafts, no ranking of features.
4. Follow `references/rules.md` for every text you write.

## Flow

0. **Intake.** Number every source: emails E1, E2…, calls C1…, other notes
   N1…, in date order. Save each source's text as `sources/<id>.txt` in the
   working folder (pasted text included), so quotes can be checked.
1. **Discover.** Read `steps/discover.md`. One note per source.
2. **Define** and 3. **Draft.** Read `steps/draft.md`, and
   `steps/assumptions.md` for the assumptions. Write `draft.json` in the
   shape of `references/draft-schema.md`.
4. **Check** and 5. **Build.** Read `steps/check.md`:
   `python3 scripts/check.py --draft <dir>/draft.json` until it prints
   `draft clean`, then
   `python3 scripts/build_docx.py --draft <dir>/draft.json --out <dir>/draft-scope.docx`.

No shell or no Python (some sandboxes): skip the scripts, run the checks in
`steps/check.md` yourself, and show the draft in your reply in the same
section order as the docx.

## Finish

claude.ai: present `draft-scope.docx` and `discover-notes.md`. Claude Code:
give their paths. Then one line: "Edit it in Word or Google Docs, then use
it with the business-analyst skill."

Credits: `references/credits.md`.
