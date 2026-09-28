---
name: proposal
description: Assemble a pre-sales client proposal from analyze-requirements and estimate outputs — interviewed client context, the estimate's price as a range, and a print-ready client page. Use when the user asks for a proposal, a client pitch document, a quote document, or "something I can send the client".
---

# proposal

Assemble a pre-sales client proposal: proposal.md as the source of truth and
a self-contained, print-ready proposal.html the user can send or print to
PDF.

## Hard rules

1. Assembly only — never re-analyze. Architecture facts come from
   ARCHITECTURE.md; every number comes from estimation.json via
   `scripts/derive.mjs`. A number the derivation didn't produce does not
   go in the document.
2. Both prerequisites are hard: no ARCHITECTURE.md or no estimation.json →
   stop and name the skill to run (`analyze-requirements` / `estimate`).
3. The client sees one price — the cost range and single-number figure the
   estimate computed. No staffing plan, internal scoring, or timeline
   leaks.
4. `node scripts/validate.mjs` must exit 0 before the page renders;
   `render.mjs` re-runs the same checks and refuses on findings.
5. Human review of proposal.md before anything is rendered for or sent to
   a client.

## Flow

1. **Prereq gate**: ARCHITECTURE.md and estimation.json both exist, or stop.
2. **Interview**: follow `references/interview.md` — client context, tech
   level, validity, firm profile (with storage-scope choice).
3. **Figures**: `node scripts/derive.mjs --estimation <dir>/estimation.json
   --out <dir>/proposal-figures.json` — the only numbers allowed in the
   document.
4. **Write**: proposal.md per `references/writing.md` (nine sections,
   frontmatter contract, tech-level language).
5. **Validate**: `node scripts/validate.mjs --md <dir>/proposal.md
   --estimation <dir>/estimation.json` — fix findings, re-run until clean.
6. **Fresh-eyes review**: dispatch a subagent per `references/review.md`;
   fix findings, re-run validate; one re-review cycle max.
7. **Human review**: show the user proposal.md and wait for approval.
8. **Render**: `node scripts/render.mjs --md <dir>/proposal.md
   --estimation <dir>/estimation.json --mermaid-bundle <path> --out <dir>/dist`
   — reuse the mermaid bundle built for the analyze-requirements viewer
   (analyze-requirements `references/viewer.md` §1). `<dir>/dist/` is the one
   rendered-pages folder: proposal.html ships beside index.html and
   estimate.html; proposal.html itself carries no link back.
9. **Serve**: `node ../analyze-requirements/scripts/serve.mjs <dir>`; report the URL.

## Placement

proposal.md lives beside ARCHITECTURE.md and estimation.md. proposal.html
follows the estimate.html rule: into the rendered viewer's directory when
one exists, else beside proposal.md.

## Dependency

Node ≥ 20. Scripts are dependency-free.
