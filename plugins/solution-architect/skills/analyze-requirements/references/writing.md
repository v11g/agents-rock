# Writing — spine contract, one-home-per-fact, src-column rules

Read during the writing phase (SKILL.md step 5), after research completes.
This file is the writer's single source for ARCHITECTURE.md's structure and
for the conventions every companion and mattpocock-convention file follows.

## 1. The 16-heading spine

Copied verbatim from spec §3.1 — this is the fixed structure. Headings never
change; a non-applicable section renders `Not applicable — <reason>`
(`project-types.md` owns per-type table-column variants and elections):

**How to write these as markdown.** The table below separates the number from the
title for readability; the heading itself carries both, as `## 1 Goals and Scope`.
Real sets also spell out "and" where this table prints "&". Both spellings are
accepted — the viewer's section explainers normalise the heading before looking up
their text (`scripts/lib/section-help.mjs`, `normTitle`), dropping the leading
number and folding `&` to `and`, so numbering that shifts when a section is
omitted cannot misalign them. The number is presentation, never a key.

```
frontmatter: name · repo · team · updated · mode · projectType · docVersion · electedDocs

 1  Goals & Scope
 2  Constraints
 3  Project Structure            brownfield only: fs-generated tree depth ≤2 + boundary map
 4  Solution Strategy            ≤5 bullets, each links an ADR, never restates rationale
 5  Architecture Model           LikeC4 C1/C2/C3 views, no prose
 6  Core Components              table: responsibility, tech, deploy unit, key paths, context, invariants
 7  Runtime Behaviour            2–4 LikeC4 dynamic views, named flows only
 8  Data Stores                  mermaid ER + table: type, purpose, retention, PII, migration tool
 9  External Integrations        table: method, auth + credential home, failure mode, rate limit/cost,
                                 data leaving boundary, lock-in
10  Deployment & Infrastructure  LikeC4 deployment view + per-env table + CI/CD stage table
11  Crosscutting Concepts        observability, error handling, validation, config/secrets,
                                 auth mechanics, testing strategy
12  Security                     mermaid DFD + trust boundaries, authz model, link to threat model
13  Quality Requirements & SLOs  table: scenario, measure, target, priority — never adjectives
14  Decisions                    generated index of docs/adr/ (root + per-context)
15  Risks & Technical Debt
16  Glossary                     generated from all CONTEXT.md files; omitted if <5 terms, and says so
```

### 1a. Why "arc42 + 2", not more

arc42 has 12 chapters. Only one of them draws a seam that matches ours: Context
and Scope (Ch3) has two named subsections in arc42 itself, 3.1 Business context
and 3.2 Technical context, and we give each its own heading (§1, §9) — that
split is arc42's, not ours. Building Block View (Ch5) and Crosscutting Concepts
(Ch8) are different: arc42 subsections Ch5 by decomposition level (5.1/5.2/5.3),
each level mixing diagram and blackbox description together, not by a
diagram-vs-table seam; and Ch8 mentions security only in one inline example
sentence next to a topic diagram, never as a named subsection. Pulling
Architecture Model apart from Core Components, and Security out of Crosscutting
Concepts, are choices *we* made, not seams arc42 drew. They're still splits and
not new content — both halves of each still trace back to the same arc42
chapter — so neither counts toward the "+2": both splits are ours, not arc42's.
Only two of our sixteen have no arc42 chapter behind them at all — those two
are what `README.md`'s "arc42 + 2 additions" means.

| # | our heading | arc42 chapter | relationship |
|---|---|---|---|
| 1 | Goals & Scope | Ch1 Introduction and Goals + Ch3 Context and Scope (3.1 Business context) | merge |
| 2 | Constraints | Ch2 Constraints | direct |
| 3 | Project Structure | none | **addition** — no arc42 chapter documents repo/filesystem layout |
| 4 | Solution Strategy | Ch4 Solution Strategy | direct |
| 5 | Architecture Model | Ch5 Building Block View | split (ours); Ch5's own subsections are its decomposition levels (5.1/5.2/5.3); shares Ch5 with §6 |
| 6 | Core Components | Ch5 Building Block View | split (ours), shares Ch5 with §5 |
| 7 | Runtime Behaviour | Ch6 Runtime View | direct |
| 8 | Data Stores | none | **addition** — no arc42 chapter addresses data stores or ER models at all |
| 9 | External Integrations | Ch3 Context and Scope (3.2 Technical context) | split (arc42's own seam), shares Ch3 with §1 |
| 10 | Deployment & Infrastructure | Ch7 Deployment View | direct |
| 11 | Crosscutting Concepts | Ch8 Crosscutting Concepts | split (ours — security is one inline example here, not a subsection), shares Ch8 with §12 |
| 12 | Security | Ch8 Crosscutting Concepts | split (ours), shares Ch8 with §11 |
| 13 | Quality Requirements & SLOs | Ch10 Quality Requirements | direct |
| 14 | Decisions | Ch9 Architecture Decisions | direct |
| 15 | Risks & Technical Debt | Ch11 Risks and Technical Debt | direct |
| 16 | Glossary | Ch12 Glossary | direct |

Count: 16 headings, 3 splits (Ch3, Ch5, Ch8 each backing two), 2 with no
counterpart (Project Structure, Data Stores) → arc42's 12 + 2 additions.

Contract notes, verbatim:

- The ER diagram is not the domain model. ER = persistence shape; domain =
  concepts and invariants. They legitimately differ (event sourcing, CQRS).
  Two diagrams, two homes.
- Contested facts have one home: observability → §11 · auth mechanics → §11,
  auth model → §12 · threat list → threat-model doc · decision rationale →
  ADR files · debt → §15.
- Every table row carries a `src` column: `observed` / `stated` /
  `researched [link]` / `proposed` / `assumed`. Prose facts carry an inline
  tag. Diagrams carry a view-level provenance note.

## 2. One home per fact

Diagrams own topology, tables own properties, prose owns neither. Before
writing a fact anywhere, check the router below — writing the same fact in
two homes is a defect, not redundancy:

| contested fact | home |
|---|---|
| Observability | §11 Crosscutting Concepts |
| Auth mechanics (how auth works) | §11 Crosscutting Concepts |
| Auth model (who is allowed to do what) | §12 Security |
| Threat list | threat-model.md |
| Decision rationale | ADR files (§4 bullets link, never restate) |
| Technical debt | §15 Risks & Technical Debt |

## 3. Table format rules

- Leading **and** trailing pipes on every row: `| cell | cell |`, never a
  bare `cell | cell`.
- `src` is the last column, header spelled exactly `src` (the provenance
  validator looks up that literal header name).
- Values are one of the five provenance words: `observed` · `stated` ·
  `researched` · `proposed` · `assumed`. `researched` is always followed by a
  bracketed source: `researched [source]`.
- `proposed` and `assumed` are not interchangeable. `proposed` is a
  recommendation this document is making and standing behind. `assumed` is a
  value nobody supplied that was invented so the work could continue — it is a
  hole, and §13 treats an `assumed` target on a `must` row as a blocker. Never
  promote one to the other to make a section look settled.
- Generated-index tables are exempt: `Decisions` (§14) and `Glossary` (§16)
  carry no `src` column — they're derived from `docs/adr/` and `CONTEXT.md`
  files, not asserted facts.

## 3b. Diagram embed convention

- **LikeC4 views**: a marker on its own line, `<!-- likec4:view <view-id> -->`.
  The renderer swaps it for the interactive `<c4-view>` webcomponent. Used in
  §5 (C1/C2/C3), §7 (runtime dynamic views), §10 (deployment view).
- **Mermaid**: stays in fenced ` ```mermaid ` blocks, rendered as static
  diagrams per `viewer.md`'s mermaid rules. Used in §8 (ER) and §12 (security
  DFD) — the only two sections that use mermaid instead of LikeC4.

Never mix the two for the same view: a LikeC4-modeled view always uses the
marker, never a hand-drawn mermaid equivalent.

## 3c. Key paths ↔ clusters (brownfield)

The §6 "key paths" column holds **file paths** (comma-separated), never symbol
names. The brownfield validator matches each path against the `packages` of
the `get_architecture` clusters — a row matches a cluster when one of its key
paths equals a cluster package or sits under it (`backend/src` matches package
`backend`). Every high-cohesion cluster needs a matching row, and every §6 row
needs a matching cluster — except rows that name a §8 data store (MongoDB has
no functions, so it can never match a cluster and is exempt).

## 4. Frontmatter contract

Fields: `name · repo · team · updated · mode · projectType · docVersion ·
electedDocs`. `electedDocs` is a **one-line JSON array**, one entry per
companion doc, each `{ name, elected, reason? }`. Exact convention (from
Task 7's fixture, `scripts/test/fixtures/docs-pass/ARCHITECTURE.md`):

```yaml
---
electedDocs: [{"name":"threat-model","elected":false,"reason":"CLI-only fixture, no external attack surface"},{"name":"interface-contract","elected":false,"reason":"no public API exposed by this fixture"},{"name":"estimation","elected":false,"reason":"user declined effort estimates"},{"name":"domain-overview","elected":false,"reason":"thin domain: fixture repo"},{"name":"validation-plan","elected":false,"reason":"no must-level quality rows in this fixture"}]
---
```

All five companions (`threat-model`, `interface-contract`, `estimation`,
`domain-overview`, `validation-plan`) always get an entry, elected or not — an
un-elected companion with no `reason` fails validation. Never drop an entry to
avoid writing a reason.

## 5. Companion contracts

- **DOMAIN-OVERVIEW.md** has exactly three parts, each cross-linked, plus
  nothing else:
  - **Actors** — same persona names as the C1 context view; threat model
    reuses them.
  - **Processes** — actor-level steps naming CONTEXT-MAP contexts; each
    links its §7 flow.
  - **Rules** — business statements, each linking the §6 component that
    enforces it and the ADR it came from.
  - Excluded, home elsewhere: terms → `CONTEXT.md` · domain events →
    CONTEXT-MAP relationships / AsyncAPI contract · context relationships →
    `CONTEXT-MAP.md`.
- **threat-model.md** deliverable: a DFD, trust boundaries, a threat list,
  and mitigations per threat — never just the diagram or just the list.
- **estimation.md** is not written here: when elected, the `estimate` skill
  produces it (computed, validated — see `project-types.md`). Its honesty
  rule still binds whoever renders it: every row carries confidence +
  assumptions; a row nobody estimated renders `not estimated` — **never
  `0`**, which would misread as "estimated at zero effort."
- **validation-plan.md** carries one row per load-bearing claim: method,
  condition, threshold, status. `planned` until something has actually run,
  and a planned check never renders as passed. `validation.md` owns the
  contract, including what evidence has to carry before it replaces a plan.
  Elect it when §13 has a `must` row or an ADR rests on an unmeasured number.

## 6. mattpocock integration

`CONTEXT.md` and `CONTEXT-MAP.md` are mattpocock's formats — write into them
using their existing structure, never restructure or replace them. Rules:

- Multi-context repos keep mattpocock's layout: `src/<context>/CONTEXT.md`
  per context, and a per-context `docs/adr/` alongside it. Root `docs/adr/`
  holds system-wide decisions only.
- §14 (Decisions) and §16 (Glossary) generators scan **all** `docs/adr/` and
  `CONTEXT.md` files — root and every context — never just the root.
- ADRs always include **Considered Options**, even though mattpocock's own
  format lists it as optional. The rest of mattpocock's three-part gate
  (offer an ADR only when a decision is hard to reverse, surprising without
  context, and the result of a real trade-off) still governs whether an ADR
  gets written at all — this project only strengthens what's inside it.
  `decisions.md` says how to answer that gate, and what an ADR carries once
  it passes: significance tests, the four technology costs, and acceptance.

## 7. ER ≠ domain model

Verbatim, spec §3.1 contract notes: the ER diagram is not the domain model.
ER = persistence shape; domain = concepts and invariants. They legitimately
differ (event sourcing, CQRS). Two diagrams, two homes — §8 owns the ER,
`CONTEXT.md`/DOMAIN-OVERVIEW.md own the domain model. Never let one section
substitute for the other because they look similar.
