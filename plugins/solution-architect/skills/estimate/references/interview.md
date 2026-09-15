# Interview — evidence first, depth, gate, question sequence

Read during the interview phase (SKILL.md step 2). Defines what to pre-fill
before asking, what order to ask in, and the gate that stands between a scope
guess and a sized number.

## 1. Evidence detection table

Scan for evidence before asking anything. Each source pre-fills specific
fields and stamps them with a provenance label — carry that label straight
into `estimation-inputs.json`, never upgrade it on your own judgment.

| Source | Pre-fills | Provenance label |
| --- | --- | --- |
| Requirements doc / RFP / backlog | feature list, scope text, named deadlines | `stated` |
| `ARCHITECTURE.md` (companion mode) | tech stack, existing components, integration points | `stated` |
| Codebase scan (brownfield, no docs) | languages, frameworks, existing test coverage, rough size of touched areas | `observed` |
| None found (greenfield, no docs, no code) | nothing — every field starts as a hole | — |

Show the pre-filled scope table, with its provenance column, **before**
asking a single question. Then ask only the holes the scan left open — never
re-ask what a document already stated or a scan already observed. A hole the
user declines to answer is filled with the skill's best guess and labeled
`proposed`, never silently upgraded to `stated`.

## 2. Depth question — ask first

Depth sizes every question that follows it, so it is the first thing asked,
before scope confirmation and before any factor scoring.

| Depth | What it drives | Precision |
| --- | --- | --- |
| QUICK | feature-level factor-scored tiering only | ±wide |
| STANDARD | task-level three-point PERT | ± moderate |
| DEEP | STANDARD plus per-scenario detail (multiple team/AI-assistance combinations sized individually) | ± narrower |

## 2b. Delivery mode — ask second

| Mode | Meaning | Sizing path |
| --- | --- | --- |
| TRADITIONAL | humans write the code | technique menu (`techniques.md`) |
| AGENTIC | AI coding agents write the code, humans plan and review | measurement-based (`agentic-estimation.md`) |

AGENTIC replaces the technique question and AI-category scoring entirely.
Follow-ups it adds: which agent + model executes (calibration context,
written to `agentContext`; ask whether planning uses a different model —
per-task `model` override); which repository the work targets (optional
`agentContext.repository`, matching the `repository` field of measurement
records — omit it and the script falls back to `project`, but set it when
the project's repo name differs from `project` so rung 1 of the retrieval
ladder can match); per task, a shape from `task-shapes.md`, scope
attributes, and seed minutes (o/m/p) used only when no baseline exists.

## 3. Clear-vs-assumed gate

Before any sizing happens, present two lists side by side:

- **confirmed scope** — what the evidence stated or the user confirmed.
- **assumptions I'm making** — every gap filled by a guess, each one paired
  with its impact-if-wrong (what changes, and by how much, if the guess is
  wrong).

The user corrects this pair of lists before sizing starts. Every assumption
here transfers verbatim into the `assumptions` array of
`estimation-inputs.json` and, from there, into the deliverable's Assumptions
table — do not paraphrase it between the gate and the file.

## 4. Question sequence

Ask one thing at a time, in this order:

1. **Scope confirm** — walk the clear-vs-assumed gate; get sign-off or
   corrections.
2. **Milestone grouping** (STANDARD/DEEP only) — propose a grouping of the
   confirmed features into ordered milestones ("M1 - <name>", "M2 - …");
   the user confirms, reorders, or declines. Declining skips the roadmap
   entirely (the `milestone` field stays off every feature). Ordering
   provenance is `proposed` unless the client stated the order — then
   `stated`, recorded in the deliverable's Roadmap section.
3. **Factor scores per feature** — all depths. Read
   `references/scoring-guide.md` first; every anchor you show is quoted from
   it verbatim, never paraphrased. TRADITIONAL-only: in AGENTIC mode this
   step is replaced entirely — ask shape + scope + seed minutes per task
   instead (§2b, `task-shapes.md`).

   **Review channel** — ask once, before the first card, with a one-line
   reason per option and a recommendation from the feature count
   (≤ 8 → terminal, 9–14 → csv, 15+ → html; the human overrides freely):

   ```text
   25 features to score. How do you want to review them?
     1. terminal   cards here, 4–6 per turn, reply "accept" or "F03 deps 4"
                   — fastest for ≤ 8 features, no file to open
     2. csv        I write scores-draft.csv, you edit in Sheets/Excel, say "done"
                   — all rows on one screen, notes column, fits the workbook habit
     3. html       I write scores-review.html, you open it, set dropdowns, copy
                   the feedback block back here
                   — anchor text on hover, edge/XL badges, best for 15+ features
   Recommended: 2 (25 features).
   ```

   For csv and html, write your proposals as `draft.json` (`{ project,
   features: [{ id, name, scores, scoreNote, scoreProvenance }] }`), then
   `node scripts/score-review.mjs --write draft.json --format csv|html --out
   <file>`. When the human says done, `node scripts/score-review.mjs --read
   <file> --draft draft.json` prints the diff and the re-anchored features;
   report the diff (`3 changes: F07 risk 5→4, … — all stated. Σ moves F12 to
   L. Proceed?`) before writing them into `estimation-inputs.json`.

   **Cards** (terminal channel, and the shape every channel's row carries):
   one per feature, 4–6 per turn, every cell filled from evidence you already
   read, cite inline. The human answers `accept`, `<factor> <n>`, `why
   <text>`, or `split`.

   ```text
   ┌ F07  Payment reconciliation ──────────────────────────────────── proposed ┐
   │  Tech  4  Non-trivial algorithms, real-time systems, ML inference,        │
   │           complex data transforms                                         │
   │           ← ARCHITECTURE.md §6: fuzzy match bank rows to invoices         │
   │  Size  3  Medium feature with multiple components and backend logic       │
   │           ← PRD §4.2: 3 screens + nightly job                             │
   │  Deps  4  Multiple third-party APIs or tightly coupled internal systems   │
   │           ← Stripe API + bank CSV import                                  │
   │  Unc   3  Some open questions, design decisions to be made during build   │
   │           ← PRD §4.2: "reconciliation rules undecided"                    │
   │  Risk  5  Core infrastructure, compliance requirements, irreversible ops  │
   │           ← payments; rubric puts payments at 4–5, chose 5: irreversible  │
   │  Σ 19  →  L  →  160–400 h                                                 │
   │  Why (client): handles payments and two outside services; matching       │
   │                rules still to be decided                                  │
   │  accept · change <factor> <n> · why <text> · split                        │
   └───────────────────────────────────────────────────────────────────────────┘
   ```

   Rules: the anchor is the guide's full sentence for that factor and score;
   the cite quotes the fact it rests on; no evidence for a factor → the cell
   is `?` and you ask, never a silent 3. Σ at 11, 17 or 22 shows `one point
   from <tier>; <factor> +1 moves this to <band>`; Σ > 22 recommends `split`
   before `accept`; any 5 shows `review`. `Why` is one plain sentence for a
   non-technical reader — what the feature touches and what is still
   unknown; no file names, no factor names, no rubric wording. `split`
   returns to the clear-vs-assumed gate (§5).

   **Writing it down.** STANDARD/DEEP: every feature gets `scores` (per
   factor `{ n, anchor, cite }`), `scoreNote` (the `Why` sentence) and
   `scoreProvenance` — `proposed` when accepted as offered, `stated` when
   any cell or the note was changed. QUICK: use the scores for the tier and
   the calibration band as today; do not write them (`schema.mjs` refuses
   them at QUICK).

3b. **Tasks + O/M/P** — STANDARD/DEEP only, per `techniques.md` §3. After a
   feature's tasks are sized, compare `Σ pert(e)` with its tier's calibration
   band. Outside the band, say so once — `Σ19 → L → 160–400 h, tasks sum to
   85 h; tasks missing or scores high?` — and let the human decide. Nothing
   is refused and nothing new is written; the page marks the row ⚠.
4. **Team + rates + seniority mix** — how many engineers, what they cost
   per hour, and whether each is junior/mid/senior. Default is **one team**
   → one scenario; ask "compare staffing options?" and only then collect
   more rosters. With two or more, ask why the recommended one wins and
   write it to `recommendedReason` — the page shows a choice it must be
   able to explain.
5. **AI-assisted delivery** — per scenario, default **yes**; ask only
   "humans unaided?" as the opt-out. Then **tooling cost per seat per
   month** — one number, vendor-neutral (a Claude Max seat, Codex, Cursor —
   whatever the client will actually run), written to `toolingCostPerSeat`.
   The human may skip it: write `null` and add an assumption to the gate
   whose text names the tooling cost gap and its impact-if-wrong (~2% of
   total at typical seat prices). The validator refuses a null seat cost on
   an AI-assisted scenario without that assumption.
6. **Deadline / constraints** — any hard date or budget ceiling.
7. **calibration table** — ask for the org's own tier → hour-band history; if
   none exists, offer the defaults `S 20-60h, M 60-160h, L 160-400h, XL 400-800h`.
8. **Expose-rates-to-client** — y/n; controls whether the client-facing render
   shows labor rates or only totals.

## 5. Loop rule

If answering a later question (factor scoring, team sizing, whatever)
surfaces a scope hole — a feature nobody named, a dependency nobody
mentioned — stop and go back to the clear-vs-assumed gate. Never absorb new
scope silently mid-sizing; the gate is the only place scope changes.
