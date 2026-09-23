---
name: review-architecture
description: Review an existing architecture package for the judgement a validator cannot check — measurable drivers, credible alternatives, honest evidence — and report findings with a readiness verdict. Use when the user asks to review, audit, critique, or sanity-check architecture documentation, an ADR, or a design before it goes to a client or a build team.
---

# review-architecture

Read a finished architecture package and say what is wrong with it. Never
write into it.

## Hard rules

1. **Never review a document written in this same context.** The writer
   cannot grade the writer. If `analyze-requirements` ran in this session,
   dispatch the review to a subagent per `references/gates.md` §0 instead of
   performing it here.
2. **Findings only, never repairs.** Fixing is a separate pass, so the
   reviewer never grades its own repair.
3. **Agent judges, script computes.** Every ratio in the report comes from
   `node scripts/coverage.mjs`. Never count rows by hand.
4. **Never re-report what `validate.mjs` already enforces.** Missing `src`
   columns, broken links and model disagreement are gated before rendering.
   Repeating them buries the findings only a reader can make.
5. **A finding names evidence.** File and section or ADR id, every time. A
   finding with no location is an opinion.
6. **One readiness verdict, and validation reported separately.** Complete
   documentation is not acceptance; acceptance is not production readiness.

## Inputs

Required: `ARCHITECTURE.md`. Read alongside it, when present: `docs/adr/`
(root and per-context), `model.json`, `validation-plan.md`, `threat-model.md`.

No `ARCHITECTURE.md` → stop and name `analyze-requirements`.

## Flow

1. **Locate** the package. State what was found and what was absent — an
   absent companion is context for the gates, not a finding in itself.
2. **Count**: `node scripts/coverage.mjs --arch <path> --adr <dir>`
   (add `--plan <path>` when a validation plan exists). Keep the JSON.
3. **Gate**: work `references/gates.md` in order. Each gate yields findings
   or passes; a gate with nothing to check reports that, never a pass.
4. **Report**: assemble per `references/reporting.md` — findings by
   severity, the counted ratios, one readiness verdict, validation stated
   separately.

## Output

`review-report.md` beside `ARCHITECTURE.md`, stamped with the reviewed
revision (`docVersion` and `updated` from the frontmatter) so a later reader
can tell whether the review still describes the document.

It is not an elected companion. A review is a point-in-time judgement about
a revision, not a part of the set the way a threat model is.

## Dependency

Node ≥ 20. The script is dependency-free.
