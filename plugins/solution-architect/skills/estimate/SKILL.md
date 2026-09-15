---
name: estimate
description: Interview-driven project estimation with AI-aware delivery scenarios. Use when the user asks for an estimate, effort sizing, a quote, a timeline, staffing, or "how long would this take" — with or without existing architecture docs.
---

# estimate

Produce an honest, validated estimate: confirmed scope split from assumptions,
a technique that fits the evidence, AI-assisted staffing scenarios, and an
interactive page served on localhost.

## Hard rules

1. Every estimate row carries confidence + assumptions. A row nobody estimated
   renders `not estimated` — never `0`.
2. Every scope item is labeled `stated` or `proposed` — no unlabeled scope.
3. Agent judges, script computes: every number in a deliverable comes from
   `scripts/compute.mjs`. Never total, average, or price by hand.
4. Never apply one blanket AI multiplier to a whole project — per-task
   category only (`references/ai-multipliers.md`).
5. `node scripts/validate.mjs` must exit 0 before the page renders.
6. Agentic estimates: baselines and confidence come from scripts reading
   measurements.jsonl — the agent never writes a duration, confidence, or
   evidence row.

## Flow

1. **Detect evidence**: requirements/RFP? ARCHITECTURE.md? codebase? none?
   State findings; the user can override. (`references/interview.md` §1)
2. **Depth and delivery mode**: ask QUICK / STANDARD / DEEP, then TRADITIONAL
   / AGENTIC (`references/interview.md` §2b). Delivery mode decides step 4.
3. **Interview**: follow `references/interview.md` — pre-fill from evidence,
   ask only holes, run the clear-vs-assumed gate before sizing. Before
   proposing milestones, read `references/slicing.md` — slices are judged
   there, not computed.
4. **Technique**: TRADITIONAL-only — recommend from `references/techniques.md`,
   state why, cite the method's sources (its §Sources — attribution + link,
   never quoted text), confirm. AGENTIC reads
   `references/agentic-estimation.md` and `references/task-shapes.md`
   instead: no technique to recommend, shape + scope + seed minutes per task.
5. **Size**: write judgments to `estimation-inputs.json`
   (`references/writing.md` — the booking fixture is the canonical shape).
6. **Compute**: `node scripts/compute.mjs --inputs estimation-inputs.json --out estimation.json`
7. **Write**: estimation.md per `references/writing.md`.
8. **Validate**: `node scripts/validate.mjs --md estimation.md --json estimation.json`
   — fix findings, re-run until clean.
9. **Render + serve**:
   `node scripts/render.mjs --json estimation.json --md estimation.md --out <dir>`
   (add `--client-only` for a client-safe file; add `--figures proposal-figures.json`
   once `/proposal` has written it, so the Summary shows the client's quoted
   range) — render re-runs the validation
   checks itself and refuses on findings, so an unvalidated page cannot ship.
   `deliveryMode: "agentic"` routes rendering to the agentic HTML template
   automatically; nothing to choose here. Then serve with the
   analyze-requirements skill's `serve.mjs`; report the URL.

## Companion mode

When ARCHITECTURE.md exists: §6 components seed the WBS, §15 risks seed the
risk register, seed the `components` roster from §6 rows (use the LikeC4
model's container and component ids where one exists — dotted ids like
`atlas.goldStore`) and tag every feature with the component it implements,
flip the `electedDocs` estimation entry to `elected: true`,
place estimation.md beside ARCHITECTURE.md so the analyze-requirements viewer picks it
up as a companion page; link the interactive page from it. Render
estimate.html **into `<dir>/dist/`** — the same folder the viewer renders
into. When a rendered viewer exists, add `--viewer index.html` for the
back-link (internal view only; the client render strips it) — index.html and
estimate.html then ship as one self-contained folder, and the viewer's
estimation tab links the copy inside it.

## Dependency

Node ≥ 20. No npm install needed — the scripts are dependency-free.
