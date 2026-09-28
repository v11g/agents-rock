# proposal

Pre-sales client proposal assembled from the analyze-requirements and estimate skills'
outputs: `proposal.md` as the editable source of truth and `proposal.html`
as a self-contained, print-ready page you can send to a client or print to
PDF.

## What it needs

Both are hard prerequisites — the skill stops without them:

- `ARCHITECTURE.md` (analyze-requirements skill)
- `estimation.json` (estimate skill)

## What it asks

A short interview: who the client is, how technical they are (a non-tech
client gets a jargon-free document, enforced by the validator), and how long
the proposal stays valid. Your firm profile is asked once and cached
(`.claude/proposal-profile.json`, project or global scope — your choice).

## What it guarantees

- Every number traces to `estimation.json` — the validator recomputes the
  client-facing ranges and refuses anything hand-invented.
- The client sees one price: the estimate's own presented range and single
  number, split across milestones by effort share. An estimate with no
  scored features (agentic delivery) has no price to quote, and the skill
  refuses rather than send a $0.
- No internal leakage: feature scores, tiers, the pricing working, provenance
  tags, and the internal risk register never appear.
- Validation gates rendering; a fresh-eyes subagent review and your own
  sign-off gate delivery.

## Pipeline

interview → derive.mjs → proposal.md → validate.mjs → fresh-eyes review →
human review → render.mjs → serve.mjs
