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
| DEEP | STANDARD's task-level PERT and scoring, with no shortcuts — every anchor cited, every task assumption named, nothing left as a `?` | ± narrower |

## 2b. Delivery mode — assume second, ask only to leave it

| Mode | Meaning | Sizing path |
| --- | --- | --- |
| AGENTIC (default) | AI coding agents write the code, humans plan and review | measurement-based (`agentic-estimation.md`) |
| TRADITIONAL | humans write the code | technique menu (`techniques.md`) |

Assume **AGENTIC**; ask only "humans writing the code?" as the opt-out. A
client who is hand-writing the code will say so; one who is not should not
have to answer for it every interview.

Write `deliveryMode` into `estimation-inputs.json` either way, explicitly. An
absent field still reads as traditional, which is what estimates written
before this default relied on — the interview no longer leaves it to that.

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
                   — anchor on hover, a plot of where every feature lands,
                     best for 15+ features
   Recommended: 2 (25 features).
   ```

   For csv and html, write your proposals as `draft.json` (`{ project,
   features: [{ id, name, scores, scoreNote, scoreProvenance }] }`), then
   `node scripts/score-review.mjs --write draft.json --format csv|html --out
   <file>`. When the human says done, `node scripts/score-review.mjs --read
   <file> --draft draft.json` prints the diff and the re-anchored features;
   report the diff (`3 changes: F07 risk 5→4, … — all stated. Σ moves F12 to
   L. Proceed?`) before writing them into `estimation-inputs.json`.

   **html channel — the page ships designed.** `--write --format html`
   renders the reviewer page from `assets/scores-review-template.html`,
   which is the deliverable, not a baseline to redesign. Write it into the
   lead directory and hand the human the path; do not run a design pass on
   it per lead. Any edit to the template keeps the read-back contract or
   `--read` cannot parse the feedback: one `<select data-id="<feature id>"
   data-key="<tech|size|deps|unc|risk>">` per score (values 1–5, `title` =
   the rubric anchor), `[data-total="<id>"]` and `[data-tier="<id>"]` text
   updated on change, one `<textarea data-note="<id>">` for the plain note,
   `window.__feedback()` returning `{ features: [{ id, scores: { k: n },
   scoreNote }] }`, a `#feedback` textarea holding that JSON and a `#copy`
   button that puts it on the clipboard, and the scoring guide visible on
   the page.

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
   │  Σ 19  →  L  →  $4,000–$10,000 band, point ≈$5,800                        │
   │  Why (client): handles payments and two outside services; matching       │
   │                rules still to be decided                                  │
   │  accept · change <factor> <n> · why <text> · split                        │
   └───────────────────────────────────────────────────────────────────────────┘
   ```

   Rules: the anchor is the guide's full sentence for that factor and score;
   the cite quotes the fact it rests on; no evidence for a factor → the cell
   is `?` and you ask, never a silent 3. A weighted score within a point of a
   band edge (11.5, 17.5, 22.5) shows `near <tier>` — say so, but don't
   guess which single factor would cross it: weights differ per factor
   (`WEIGHTS` in `pricing.mjs`), so a flat "+1" on any of them no longer
   moves the total by one point. Σ ≥ 22.5 flags `Deep estimate required`
   (`SPLIT into sub-features` instead, when feature size alone scored 5)
   before `accept`; any 5 shows `review`. `Why` is one plain sentence for a
   non-technical reader — what the feature touches and what is still
   unknown; no file names, no factor names, no rubric wording. `split`
   returns to the clear-vs-assumed gate (the loop rule, §5).

   **Writing it down.** STANDARD/DEEP: every feature gets `scores` (per
   factor `{ n, anchor, cite }`), `scoreNote` (the `Why` sentence) and
   `scoreProvenance` — `proposed` when accepted as offered, `stated` when
   any cell or the note was changed. QUICK: score for a rough tier only, as
   a gut-check; do not write the scores (`schema.mjs` refuses them at
   QUICK) and do not price the feature — QUICK produces no price
   (`techniques.md` §2).

   **Ask why.** A changed score keeps a cite that argued for the *old*
   number, so every entry in `--read`'s `needsReason` list is a question you
   owe the reviewer before writing: show the old anchor with its cite, the
   new anchor, and ask what makes it that score. Use `AskUserQuestion` when
   available — one question per changed cell, up to four per call, with
   your best guesses at the reason as options plus "keep it, no reason" and
   "agree — back to <old>" — and plain chat otherwise. The answer becomes
   the cite as `reviewer: <answer>`. You may push back **once** when the
   answer contradicts evidence you read (quote it); the reviewer's second
   word is final. Declining is allowed: write `reviewer: no reason given` so
   the gap is visible on the page and in the Score Rationale tab, and never
   ask twice. A rewritten `Why` sentence needs no reason — it is the
   reviewer's own words.

3b. **Tasks + O/M/P** — STANDARD/DEEP only, per `techniques.md` §3. Task
   hours feed planning only — they size the roadmap's milestone shares —
   not the price; the feature's score already set that. Nothing here is
   refused and nothing new is written.
4. **Context factors** — five project-wide multipliers from
   `CONTEXT_FACTORS` in `project-price.mjs` (`codebaseMaturity`,
   `stackFamiliarity`, `specQuality`, `compliance`, `clientDecisions`), each
   a level 1–4 written to `contextLevels` with a matching
   `contextProvenance` entry (`{ level, anchor, cite, source:
   "derived"|"stated" }` — `writing.md` §1). Four are **derived**, never
   asked outright — each arrives as a proposal with its evidence named, and
   the human can override it in review:

   | Factor | Derived from |
   | --- | --- |
   | `specQuality` | the business-analyst skill's readiness score and status |
   | `compliance` | BA layer 8 (NFRs), plus `ARCHITECTURE.md` §8's PII column |
   | `clientDecisions` | BA layer 2 — the deciders and approvers named for the stakeholders |
   | `codebaseMaturity` | `ARCHITECTURE.md`'s `mode` frontmatter, plus §3, §11 and §15 |

   One is **asked**: `stackFamiliarity`, a pick-list seeded from
   `ARCHITECTURE.md` §6's tech column ("how familiar is the delivery team
   with each of: <§6 tech list>?" — 1 never used it, 4 shipped it before).

   **Standalone mode** — no `ARCHITECTURE.md`, no business-analyst
   companion doc — asks all five directly; there is nothing to derive from.
   Context factors are skipped entirely at QUICK depth and in agentic mode
   (`context-schema.mjs`).
5. **Deadline / constraints** — any hard date or budget ceiling.
6. **Expose-the-pricing-working** — y/n; sets `exposeRatesToClient`. Default
   no: the client render carries the presented range, the single number and
   the contingency rate, but not the working behind them — the context
   multiplier, the overhead lines, the adjusted base, and the tier and price
   band each feature landed in. Answer yes only when the client has asked to
   see how the number was built and the team is content to show it.

## 5. Loop rule

If answering a later question (factor scoring, team sizing, whatever)
surfaces a scope hole — a feature nobody named, a dependency nobody
mentioned — stop and go back to the clear-vs-assumed gate. Never absorb new
scope silently mid-sizing; the gate is the only place scope changes.
