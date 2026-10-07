# business-analyst

Requirements discovery for pre-sales leads. Feed it raw client input —
emails, meeting notes, transcripts, briefs — and it interviews you to fill
the gaps, then writes a validated requirements package:

- `requirements.md` — discovery brief, process analysis, requirements,
  acceptance scenarios, readiness report (five parts, one file)
- `requirements.json` — machine-readable handoff with stable IDs

Designed to run before the solution-architect plugin's chain
(`analyze-requirements` → `estimate` → `proposal`); its `new-lead`
orchestrator offers this skill as step 0 when installed. Also works
standalone: `/business-analyst` in any project directory.

The package is gated by `scripts/validate.mjs`: schema, ID traceability,
label discipline, an ambiguity lint on requirement text, readiness math,
and md↔json consistency.

Two scope modes. `classic` (default) is the package above. `workflow` adds
systems → to-be workflows → features for a proposal organised by system;
`scripts/scope.mjs` writes a To-be scope section (mermaid workflows and
feature tables, no ids) that the product owner reads, and estimate prices
those features.

Requires Node ≥ 20 or Python ≥ 3.10 (`scripts/validate.py` is a
parity-tested port of the validator, so the skill also runs on claude.ai —
zip this folder and upload it under Settings → Features). No dependencies
either way.
