# analyze-requirements — top-3 quality goals, strategy traced to them, cited `stated` facts

Status: design approved in chat 2026-10-14; this spec awaits review.
Branch: `feat/quality-goals` (from `main` at `fd36fb5`).

## Summary

`analyze-requirements` writes down an architecture but nothing makes the
design follow from what the client needs. Four gaps:

1. §13 asks the same three questions on every project (one quality
   attribute, availability, RPO/RTO). Availability and RPO/RTO get a reflex
   answer ("99.9%") even when nobody needs them, and the second and third
   real drivers are never asked.
2. §4 Solution Strategy links each decision to an ADR, but no rule ties a
   decision to a §13 goal. "Microservices" can sit next to a small budget and
   nothing flags it.
3. §4 is a bullet list; the provenance validator checks tables only, so §4
   decisions carry no `src`.
4. `stated` says the client said it, not where. Interview answers are never
   saved, so they cannot be cited.

The fix borrows the "why before how" rules of *Fundamentals of Software
Architecture* (Richards & Ford, ch04–05, ch18) in our own words: pick the
**top 3** quality goals from evidence, record which one **gives way first**,
and make every strategy decision name the goal it **serves**. Every `stated`
fact cites its source: a transcript quote checked word for word, or a saved
interview answer.

```
inputs/ (transcripts) ─[extract subagents]─► facts + quotes ─[check-quotes]─► main agent
                                                                                │
             interview: propose top 3 → confirm / swap → gives way first → targets
                                                                                │
             ARCHITECTURE.md  §13 top 3 ◄── §4 "Serves" ── every `stated` cites C1 / Q3
```

Ships in two parts, one plan each; Part 1 does not need Part 2.

- **Part 1** — top-3 quality goals, §4 as a table with `Serves`, validator.
- **Part 2** — `stated` citations, interview log, transcript extraction, quote check.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Top 3 **replaces** the three fixed §13 questions. Availability and RPO/RTO are asked only when picked. | Fixed questions assume they matter everywhere; reflex answers inflate the estimate. |
| D2 | The agent proposes; the user confirms. Candidates come from a fixed catalogue (`references/quality-goals.md`, 11 goals), 4–6 shown, 3 recommended, each with an exact quote from the input. The full catalogue is never shown. | 20 options get "all important". The filter is the useful part (book: top 3, unordered). |
| D3 | A candidate passes only if the input shows it **and** it changes the design. A goal every system needs but which needs nothing special (e.g. card payments handled by the payment provider) goes to "Also considered" with its reason. | The book's 3-part test, criterion 2: architectural only if you must design something for it. |
| D4 | One goal is marked **gives way first** (the cull). | Records the trade-off before design, so the PO can hold scope. |
| D5 | Thin input (fewer than 3 quote-backed candidates): the empty slots fall back to today's open question "which quality matters most, with a measurable target?". A slot still empty after that (user declined, or said "don't ask") renders a Goal cell `Not provided — <reason>`; such a row is not a goal for D8. Goals the user already named in their message are taken as answered (interview hard rule 3) — no card for them. | The guard against inventing goals with no evidence; honest absence, as everywhere else. |
| D6 | §13 is a 4-column table, exactly 3 rows: `Goal · Target · Brief says · src`. "(gives way first)" sits in one Goal cell. `Brief says` is the evidence the goal was picked; `src` is the source of the Target (they can differ: quote from E1, target from interview Q4). Part 2's quote check also checks every `Brief says` quote against the inputs. Below it, an "Also considered" list, each line ending in a backticked provenance word. | 4 columns keep it a table; the viewer turns ≥5 columns × ≤3 rows into cards (`md-wide.mjs`). |
| D7 | §4 becomes a table, ≤5 rows: `Decision · Serves · ADR · src`. `Serves` names one or more §13 goals, spelled as in §13. | A table gets `src` checked by the existing validator, and `Serves` becomes a column a check can read. |
| D8 | New validator check `strategy`: every §4 `Serves` name is a §13 goal; every §13 goal is served by ≥1 row; §13 has 3 goal rows and exactly one "gives way first". A §4 still written as bullets → `WARN`, not `FAIL`. | Enforces the tie. Old sets keep validating. |
| D9 | `stated` must cite. Transcript: `stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "exact quote"`. Interview: `stated [Q3 · 2026-10-14](interview-log.md#q3)`. Applies to every table in every section. Bare `stated` → `WARN` in this release; `FAIL` is a follow-up. | Traceability. Warning first so existing sets don't all go red at once. |
| D10 | New `interview-log.md` beside ARCHITECTURE.md, one `### Q<n>` per answer: asked date, answered by (name, role, "on behalf of <client>" when the PO answers), card text, answer. Written as each answer arrives; recorded by `record.mjs` like any file the skill writes. | Interview answers had nowhere to live, so nothing could cite them. |
| D11 | Transcripts live in `inputs/` beside ARCHITECTURE.md, named `<ID>-<slug>.<txt\|md>`; IDs follow draft-scope: `C` call, `E` email, `N` note, `D` other document. The skill reads them, never edits them. | One place, stable relative links, the same IDs the PO already sees in draft-scope. |
| D12 | A new workflow `workflows/extract.js` runs one subagent per input file, in parallel. It returns facts `{fact, quote, src, section}` against a fixed checklist (goals, users, constraints, quality, integrations, data, deployment, security). The main agent never reads raw inputs. A follow-up question about one file ("what does C1 say about hosting?") reruns the workflow on that file only. | Keeps a 1-hour transcript (~13k tokens) out of the main context; it receives ~600 tokens per file. Same pattern as `workflows/research.js`. |
| D13 | Quotes are checked by a script, not an agent: `scripts/check-quotes.mjs` (lib `validate-quotes.mjs`). Whitespace is normalised; otherwise exact. A miss prints the closest sentence in that file. A failed extract quote goes back to its subagent once; if it still fails, the fact is dropped and reported like research's `dropped`. `validate.mjs` runs the same check on every quoted citation in the set. | Text matching is free and deterministic; a model checking a model is neither. |
| D14 | `validate.mjs` gets `--inputs <files…>`; inputs and `interview-log.md` join the file list the link check resolves against. | `validate-links.mjs` only accepts targets in its `files` list; without this every citation fails as "target file missing". |
| D15 | Ideas from the book are written in our own words; the source is named in `quality-goals.md`. Nothing copied from the `software-architecture-fundamentals` skill, and no runtime dependency on it. | That skill lives in another repo and plugin; copying four rules is cheaper than coupling two plugins. |

## Part 1 — top-3 quality goals and the strategy tie

### Catalogue (`references/quality-goals.md`)

Plain name first, the book's term in brackets, one line on what it changes in
the design:

| Goal | Book term | Changes the design when… |
| --- | --- | --- |
| Speed | performance | a user waits on a step with a number attached |
| Spike handling | elasticity | load jumps by a stated multiple in a short window |
| Growth | scalability | users or data grow steadily past one machine |
| Uptime | availability | an outage window costs money or trust |
| Data recovery | recoverability (RPO/RTO) | lost or late data has a stated cost |
| Reliability | reliability | a failure must never leave wrong or half-written state |
| Security | security | data or actions need protection beyond standard login |
| Integration | interoperability | a named external system is the source of record |
| Low cost | cost | a budget or running-cost ceiling is stated |
| Ease of change | evolvability | rules, partners or products change often |
| Simplicity | simplicity | a small team or short timeline must maintain it |

The file also holds the filter (D3), the quote rule (D2) and the fallback (D5).

### Interview (`references/interview.md`)

The three §13 rows in the question bank are replaced by:

```
Round 1 — one AskUserQuestion call, 2 cards
  Card "Quality goals"   candidates 4–6, ★ top 3, each with its quote
                         options: Confirm top 3 (Recommended) · Swap in <strongest runner-up>
                                  · Swap in <second runner-up> · Other
  Card "Trade-off"       "If budget forces it, which gives way first?"
                         options: the three picks, recommended first
Round 2 — one call, one card per pick (≤3)
  Card "<goal> target"   2 suggested measurable targets (recommended first) · "No target yet"
```

5 cards of the 12-question cap (today: 3). Runners-up beyond the strongest
two stay visible as text in the card, reachable through Other. An answer of
"No target yet" renders `Not provided — no target set` in the Target cell.

### ARCHITECTURE.md

```markdown
## 4 Solution Strategy

| Decision | Serves | ADR | src |
| --- | --- | --- | --- |
| Single web app + one database | Uptime, Low cost | [ADR-001](docs/adr/0001-single-app.md) | proposed |
| Sage adapter with a retry queue | Integration, Uptime | [ADR-002](docs/adr/0002-sage-adapter.md) | proposed |
| Search index refreshed every 15 min | Speed | [ADR-003](docs/adr/0003-search-index.md) | proposed |

## 13 Quality Requirements and SLOs

| Goal | Target | Brief says | src |
| --- | --- | --- | --- |
| Uptime | 99.9% 07:00–09:00 | "depots order before 9am" | stated [C1 · 2026-09-10](inputs/C1-kickoff-call.txt) "depots order before 9am" |
| Integration | order in Sage < 5 min | "Sage 200 is the system of record" | stated [E1 · 2026-09-08](inputs/E1-intro-email.md) "Sage 200 is the system of record" |
| Speed (gives way first) | p95 < 2s on 14,000 SKUs | "14,000 products" | stated [Q4 · 2026-10-14](interview-log.md#q4) |

Also considered:
- Security — standard B2B login; nothing needs special design. `proposed`
- Growth — ~200 known branch customers; no growth pressure. `proposed`
```

(The `src` cells above use Part 2's citations; in Part 1 alone they read
plain `stated`.)

Section explainers (`assets/section-help.json`): §4 "good" adds "each
naming the top-3 goal it serves"; §13 "what"/"good" become "the top three
quality goals, each with a measurable target, and which one gives way first".
`references/writing.md` spine line for §4 changes from "≤5 bullets, each
links an ADR" to the table above; "never restates rationale" stays —
`Serves` is a pointer, the reasoning stays in the ADR.

### Validator (`scripts/lib/validate-strategy.mjs`)

Reads `tables` from `buildInputs`:

- §13 table with no `Goal` column (a set written before this change) →
  `WARN [strategy] §13 predates top-3 goals`; the other §13 checks and the
  `Serves` checks are skipped.
- §13 table with a `Goal` column must have exactly 3 rows → else `FAIL`.
  A Goal cell starting `Not provided` is a row but not a goal.
- with 2 or more goals, exactly one Goal cell contains `(gives way first)`;
  with fewer, at most one → else `FAIL`.
- §4: no table but bullets present → `WARN [strategy] §4 is a list; rewrite as Decision · Serves · ADR · src`.
- §4 table: each `Serves` name (comma-split, trimmed, case-insensitive,
  "(gives way first)" stripped from §13 names) is a §13 goal → else `FAIL`.
- each §13 goal appears in ≥1 `Serves` → else `FAIL`; a row with an empty `Serves` → `FAIL`.
- §13 or §4 rendered `Not applicable — <reason>` → check skipped.

`validate.mjs` gains a `WARN` line kind: printed, never changes the exit code.

## Part 2 — cited `stated` facts

### Flow change (SKILL.md)

```
1 Detect mode
2 Scan (brownfield)
3 Extract   NEW — when inputs/ has files: Workflow workflows/extract.js → node scripts/check-quotes.mjs
4 Interview   proposes top 3 from extracted facts; writes interview-log.md as answers arrive
5 Research    unchanged; statedFacts now carry their citation
6 Write · 7 Validate (add --inputs) · 8 Render + serve
```

### `workflows/extract.js`

```
args = { files: [{ id: 'C1', path: 'inputs/C1-kickoff-call.txt', date: '2026-09-10' }], question?: string }
returns { facts: [{ fact, quote, src, date, section }], dropped: [{ item, reason }] }
```

One `agent()` per file with a fixed schema. Without `question`, the agent
works through the checklist (D12). With `question`, it answers that one
question for that one file. The prompt requires exact quotes and forbids
facts without one.

### `interview-log.md`

```markdown
# Interview log

### Q3
**Asked** 2026-10-14 · **Answered by** Truong Vu (PO), on behalf of Trellis
**Card** Quality goals — "Recommended top 3: Uptime, Integration, Speed"
**Answer** Confirm top 3
```

Heading `### Q3` slugifies to `q3` (`validate-links.mjs` `slugify`), so the
existing anchor check covers broken citations.

### Provenance check (`validate-provenance.mjs`)

- `stated` with no `[…](…)` citation → `WARN [provenance] "<section>" row "<first cell>": stated has no citation`.
- citation target missing → existing `links` check fails it (D14).
- quoted citation not found in its file → `FAIL [quotes]`, with the closest
  sentence.

### Viewer

Citations render through `md-inline.mjs` unchanged: chip + link + quote.
Clicking a link opens `interview-log.md` (rendered as a companion doc) or
the raw input file.

## Files

```
plugins/solution-architect/skills/analyze-requirements/
├── SKILL.md                         flow: Extract step, --inputs
├── references/quality-goals.md      NEW  catalogue, filter, quote rule, fallback
├── references/interview.md          §13 rows → 2-round flow; log-as-you-go rule
├── references/writing.md            §4 table, §13 table, citation format, interview-log + inputs/
├── assets/section-help.json         §4, §13 wording
├── workflows/extract.js             NEW (Part 2)
├── scripts/check-quotes.mjs         NEW (Part 2)
├── scripts/validate.mjs             strategy + quotes checks, WARN lines, --inputs
├── scripts/lib/validate-strategy.mjs  NEW
├── scripts/lib/validate-quotes.mjs    NEW (Part 2)
├── scripts/lib/validate-provenance.mjs  citation warning (Part 2)
├── scripts/test/                    tests + fixtures per check
└── evals/evals.json                 eval 0 updated; new transcript eval
plugins/solution-architect/.claude-plugin/plugin.json   3.0.1 → 3.1.0 (Part 1) → 3.2.0 (Part 2)
```

## Testing

- **validate-strategy**: one failing fixture per rule (2 goal rows; no
  gives-way-first; two gives-way-first; `Serves` names a non-goal; a goal
  nobody serves) + §4 bullets → WARN only, exit 0 + clean pass.
- **validate-quotes / check-quotes**: reworded quote fails and prints the
  closest sentence; whitespace-only difference passes; missing file fails.
- **validate-provenance**: bare `stated` → WARN, exit 0; cited `stated`
  passes; `observed`/`proposed` unaffected.
- **links**: citation to `interview-log.md#q9` with no Q9 → FAIL; to an
  input not passed via `--inputs` → FAIL.
- **Evals**:
  - eval 0 (`unknowns-gate-interview`): the "never-skippable availability /
    RPO" assertion becomes "proposes top 3 or, on thin input, asks the open
    quality question with a measurable target".
  - new `quality-goals-from-transcript`: one call transcript + one email
    (fictional client, no real data) with planted traps, each with a grader:
    a spike ("ten times the orders when the sale opens") → Spike handling
    proposed with that quote; "must be fast" with no number → Speed target
    asked, not invented; "we pay for Azure already" → constraint cited
    `stated [C1 …]`; card payments via Stripe → Security in Also considered,
    not top 3; café music small talk → absent; every `stated` cites;
    main-agent transcript never contains the raw input text beyond quotes.

## Out of scope

- §15 risk score (impact × likelihood) — separate spec.
- Fitness functions / automated checks per goal.
- Making `Serves` names links to §13 rows.
- `FAIL` on bare `stated` — follow-up once existing sets are migrated.
- Any change to draft-scope or estimate.

## Risks

- **Candidate quality** depends on the extract agents; a missed fact never
  reaches the interview. Guards: the fixed checklist and the targeted
  follow-up (D12); the user can Swap or answer Other.
- **Estimate**: it reads §3, §6, §8, §11, §15 (`estimate/classic/references/interview.md`,
  `FLOW.md`), not §4 or §13, so the new tables do not reach it. It copies
  ARCHITECTURE.md facts as `stated`; a cited cell (`stated [C1 …] "…"`) is
  read by the model, not parsed. The plan's first task greps estimate for
  any `src` parsing to confirm.
- **Viewer serving inputs**: whether `serve.mjs` serves `inputs/*.txt` is
  unverified; the plan's first Part 2 task checks it before anything links there.
- **Warning flood** on old sets (every bare `stated`): intended, and why
  this release warns instead of fails.
