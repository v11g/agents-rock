---
name: proposal
description: Assemble a pre-sales client proposal from analyze-requirements and estimate outputs — interviewed client context, one offered scenario as a price range, and a print-ready client page. Use when the user asks for a proposal, a client pitch document, a quote document, or "something I can send the client".
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
3. One scenario reaches the client — the one picked in the interview,
   presented as a range. The others never leak.
4. `node scripts/validate.mjs` must exit 0 before the page renders;
   `render.mjs` re-runs the same checks and refuses on findings.
5. Human review of proposal.md before anything is rendered for or sent to
   a client.

## Flow

1. **Prereq gate**: ARCHITECTURE.md and estimation.json both exist, or stop.
   Then check for `review-report.md` beside ARCHITECTURE.md. Missing, or
   stamped with an older revision than ARCHITECTURE.md's `updated`, is not a
   stop — say so in one line and let the user decide. A proposal built on an
   architecture nobody reviewed is a normal thing to send knowingly and a bad
   thing to send unaware.
2. **Interview**: follow `references/interview.md` — client context, tech
   level, scenario pick, validity, firm profile (with storage-scope choice).
3. **Figures**: `node scripts/derive.mjs --estimation <dir>/estimation.json
   --scenario <id> --out <dir>/proposal-figures.json` — the only numbers
   allowed in the document.
4. **Write**: proposal.md per `references/writing.md` (ten sections,
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
