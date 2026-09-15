# estimate

Produce an honest, validated project estimate, then serve it on localhost as an
interactive what-if page.

## What it produces

**`estimation.md`** — scope split into `stated` vs `proposed` items, a task-level
backlog with confidence and assumptions per row, an AI-aware scenario comparison
(team composition × AI assistance), and the technique used, all backed by
`estimation.json` (the numbers every table cell comes from — nothing in the
doc is hand-totaled).

**An interactive page** (`estimate.html`) — the same data rendered as a
self-contained, offline-capable HTML file with live what-if controls (swap
team/AI assistance, see months and cost recompute), served on `localhost:4173` (or the
next free port).

## Two run modes

- **Standalone** — no existing docs. estimate runs its own interview, sizes
  from evidence you provide, and writes `estimation-inputs.json` +
  `estimation.md` from scratch.
- **Companion** — an `ARCHITECTURE.md` already exists (from the `analyze-requirements`
  skill). estimate seeds the WBS from its §6 Core Components and the risk
  register from its §15 Risks, seeds a `components` roster from §6 so every
  feature is tagged with the component it implements (untouched components
  are caught by validation), then places `estimation.md` beside it so the
  analyze-requirements viewer picks it up as a companion page. `estimate.html` renders
  into the shared `dist/` output folder (falling back to beside
  `estimation.md`), so viewer and estimate ship as one folder; the viewer
  links it from the estimation tab, and `render.mjs --viewer <path>` adds
  the internal-only back-link.

## Run it

```
node scripts/compute.mjs --inputs estimation-inputs.json --out estimation.json
node scripts/validate.mjs --md estimation.md --json estimation.json
node scripts/render.mjs --json estimation.json --md estimation.md --out .
```

`validate.mjs` must exit 0 before `render.mjs` will produce a page — an
unvalidated estimate cannot ship. Add `--client-only` to `render.mjs` for a
client-safe file with rates and the labor/tooling cost breakdown stripped from
both the embedded data and the task register (totals and months stay) —
unless `exposeRatesToClient: true` is set in `estimation-inputs.json`, which
keeps them.

## Dependency

Node ≥ 20. The scripts are dependency-free — no `npm install` needed to run
them.

The root `package.json`'s `engines: >=18.3` is a different, lower number for a
different job: it's the floor for the *installer* (`npx agents-rock`), which
only copies skill files and creates symlinks. This skill's own runtime needs
Node ≥ 20, declared in `SKILL.md`, the same as `analyze-requirements`.

## Why the honesty rules

An estimate that hides its guesses is worse than no estimate — it looks precise
right up until a date slips. estimate labels every scope item `stated` or
`proposed`, renders anything nobody sized as `not estimated` rather than `0`,
and never applies one blanket AI-speedup multiplier across a whole project —
only per task category, because boilerplate and novel logic don't speed up the
same amount.
