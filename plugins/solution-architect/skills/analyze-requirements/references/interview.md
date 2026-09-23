# Interview — question bank, card batching, skip rules

Read during the interview phase (SKILL.md step 3). Defines what may be asked, in
what shape, and when to stay silent instead.

## Hard rules

1. Adaptive, hard cap **12 questions total** per run — never more, in either mode.
2. Delivered via `AskUserQuestion` cards, **≤4 options per card**.
3. Never ask what the scan already observed or research already answered — skip
   on sight; don't ask a question only to discard the answer.
4. Every answer is recorded with provenance `stated` — including confirmations
   of a detected default. A number nobody gave is `assumed`, never `stated`,
   and on a §13 `must` row it is a blocker (`drivers.md` §3).
5. §13 answers are written as scenarios, not adjectives. `drivers.md` owns the
   conversion and the shape of the cell.
6. Domain questions (terms, actors, processes, rules) are asked **while the
   mattpocock `domain-modeling` skill is invoked**, so resolved terms land in
   `CONTEXT.md` inline — never batched for later.

## Question bank

| spine section | question | mode | skip when |
|---|---|---|---|
| §1 Goals & Scope | What is the primary goal of this system, and who are its intended users? | both | an existing README/pitch doc/ARCHITECTURE.md already states it |
| §2 Constraints | What constraints must the architecture respect — budget, compliance regime, timeline, mandated tech or vendor? | both | constraints are already documented (compliance docs, existing ADRs, a constraints file the scan found) |
| §13 Quality Requirements & SLOs | Which single quality matters most, and under what conditions and workload must it hold — with the measurable target (e.g. p99 < 200ms at 400 concurrent users)? | both | never — this cannot be observed or researched |
| §13 Quality Requirements & SLOs | What availability target must this system meet, and what is the worst tolerable loss on failure — data loss window (RPO) or downtime (RTO)? | both | never — this cannot be observed or researched |
| §13 Quality Requirements & SLOs | Which three qualities matter most, in any order — and if you had to drop one of the three, which goes? | both | optional probe — skip when the run is at the 12-question cap; it is dropped before either §13 row above, never ahead of them |
| CONTEXT.md (terms) | What are the key domain terms in this system, and how do you define each precisely? | greenfield or thin CONTEXT.md | `CONTEXT.md` already has 5 or more resolved terms |
| DOMAIN-OVERVIEW.md (actors) | Who are the actors/personas that interact with or are affected by this system? | greenfield or thin CONTEXT.md | same as above, or the project is not domain-heavy |
| DOMAIN-OVERVIEW.md (processes) | What are the key business processes, described as actor-level steps? | greenfield or thin CONTEXT.md | same as above |
| DOMAIN-OVERVIEW.md (rules) | What business rules must hold, and which component enforces each? | greenfield or thin CONTEXT.md | same as above |
| frontmatter `projectType` | Detected project type is `<type>` — confirm or correct? | both | detector confidence is high (unambiguous signal match — see `project-types.md`) |
| §10 Deployment & Infrastructure | What is the target deployment environment (cloud/on-prem, region, orchestration)? | greenfield | brownfield (observed from existing deployment config/CI) |
| frontmatter `team` | Which team or individual owns this system going forward? | both | already documented (CODEOWNERS, README, org chart) |

## Card batching

- Group cards by spine section — one `AskUserQuestion` call per section, not
  one call per question.
- **Max 3 cards per call.**
- Within a card, the recommended option is listed first and labeled
  `(Recommended)`.

## Honest absence

An unanswered or declined question is never invented and never silently
dropped. It renders wherever the answer would otherwise have landed — a table
cell, a prose line, a frontmatter field — as:

```
Not provided — <who declined/why>
```

Provenance: `stated`.
