# Interview — question bank, card batching, skip rules

Read during the interview phase (SKILL.md step 4). Defines what may be asked, in
what shape, and when to stay silent instead.

## Hard rules

1. Adaptive, hard cap **12 questions total** per run — never more, in either mode.
2. Delivered via `AskUserQuestion` cards, **≤4 options per card**.
3. Never ask what the scan already observed or research already answered — skip
   on sight; don't ask a question only to discard the answer.
4. Every answer is recorded with provenance `stated` — including confirmations
   of a detected default — and written to `interview-log.md` the moment the
   card returns (see "Interview log").
5. Domain questions (terms, actors, processes, rules) are asked **while the
   mattpocock `domain-modeling` skill is invoked**, so resolved terms land in
   `CONTEXT.md` inline — never batched for later.

## Question bank

| spine section | question | mode | skip when |
|---|---|---|---|
| §1 Goals & Scope | What is the primary goal of this system, and who are its intended users? | both | an existing README/pitch doc/ARCHITECTURE.md already states it |
| §2 Constraints | What constraints must the architecture respect — budget, compliance regime, timeline, mandated tech or vendor? | both | constraints are already documented (compliance docs, existing ADRs, a constraints file the scan found) |
| §13 Quality Requirements & SLOs | Quality goals: confirm the proposed top 3 (candidates with quotes, per `quality-goals.md`) | both | the user said not to ask — then propose the top 3 from quotes, no card (`quality-goals.md` §4); otherwise skip only goals the user already named |
| §13 Quality Requirements & SLOs | Trade-off: which of the three gives way first? | both | fewer than 2 goals, or the user said not to ask (the weakest quote gives way first) |
| §13 Quality Requirements & SLOs | Target for each picked goal (one card per goal, ≤ 3) | both | the user already gave a measurable target for that goal, or the user said not to ask |
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
- §13 is two calls (`quality-goals.md` §3): round 1 = goals + trade-off
  cards, round 2 = one target card per pick. Together ≤ 5 cards of the
  12-question cap (≤ 6 on thin input, `quality-goals.md` §4).

## Honest absence

An unanswered or declined question is never invented and never silently
dropped. It renders wherever the answer would otherwise have landed — a table
cell, a prose line, a frontmatter field — as:

```
Not provided — <who declined/why>
```

Provenance: `stated`.

## Interview log

`interview-log.md` sits beside ARCHITECTURE.md. One entry per answer,
written as soon as the card returns:

    # Interview log
    **Inputs** C1 = <kept file name>

    ### Q3
    **Asked** 2026-10-14 · **Answered by** Truong Vu (PO), on behalf of Trellis
    **Card** Quality goals — "Recommended top 3: Uptime, Integration, Speed"
    **Answer** Confirm top 3

- **Inputs** is only needed when an existing input file name is kept (it
  has no `<ID>-<slug>` name); it maps the ID to that name.
- Append-only: never passed to the drift gate, recorded at the end of the run.
- Numbering continues across runs; an existing entry is never edited or
  renumbered — other documents cite it.
- **Answered by** names the person and role; "on behalf of <client>" when
  the PO answers for the client. An answer given in the user's opening
  message is logged too, with **Card** `— (in the request)`.
- A declined question is logged with **Answer** `declined`, so the
  `Not provided — …` cell that follows can cite it.
