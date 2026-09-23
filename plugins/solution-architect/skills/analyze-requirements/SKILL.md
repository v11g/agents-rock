---
name: analyze-requirements
description: Create or update professional architecture documentation through a structured interview, live research, and code scanning. Use when the user asks for architecture docs, system documentation, an architecture review doc, C4 diagrams, ADRs, a threat model, or to document an existing codebase.
---

# analyze-requirements

Produce provenance-tagged architecture documentation with interactive diagrams,
served on localhost for review.

## Hard rules

1. Every fact carries provenance: `observed` | `stated` | `researched` (with source) | `proposed`. A claim nobody verified must never render like one that was.
2. One home per fact — diagrams own topology, tables own properties, prose owns neither.
3. Unknowns render as honest absences (`Not applicable — <reason>`, `not estimated`, `Not provided`) — never placeholders, never `[TODO]`, never `0`.
4. Validation blocks rendering: `node scripts/validate.mjs` must exit 0 before the viewer is generated.
5. mattpocock files (`CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/`) are written into their existing formats — never restructured. Invoke the `domain-modeling` skill for term work.

## Flow

1. **Detect mode**: target has source code → brownfield, else greenfield. State the detection and let the user override.
2. **Scan** (brownfield): `index_repository` if needed, then `get_architecture` — clusters seed §6 Core Components. Read `manage_adr` if present; never write it.
3. **Interview**: follow `references/interview.md`. Detect project type per `references/project-types.md`. Turn the §13 answers into scenarios per `references/drivers.md`.
4. **Research**: run `workflows/research.js` per `references/research.md`. Surface dropped items before writing.
5. **Write**: model first (`references/likec4.md`), then ARCHITECTURE.md and companions (`references/writing.md`).
6. **Validate**: export the model with `node scripts/likec4-export.mjs --dir ... --out ...`, then `node scripts/validate.mjs --arch ... --model ...` (add `--mode brownfield --clusters ...` when applicable). Fix findings; re-run until clean.
7. **Render + serve**: follow `references/viewer.md`; report the URL.

## Supporting knowledge

Load only when the step in hand needs it; never preload.

- `references/decision-rules.md` — defaults, thresholds, smells. Read before
  settling the decomposition and deployment shape in step 5.
- `references/patterns.md` — techniques with their costs. Read when a §7 flow,
  §8 store, or §11 concern needs a mechanism rather than a name.
- `references/decisions.md` — significance tests, the four technology costs,
  acceptance. Read when a choice might warrant an ADR, and again when writing
  one. `writing.md` §6 still owns where ADRs live and what the format requires.
- `references/validation.md` — what gets checked and what has been checked.
  Read when electing `validation-plan.md`, and again when writing it.

Both are working knowledge, not sources. A document cites the project's drivers,
never these files.

## Dependency

Node ≥ 20 with npm (`npx likec4`). State this upfront; without it, stop before step 5.
