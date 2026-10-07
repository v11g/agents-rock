# Research brief — project-type add-on for the linking rubric

Context: an estimating agent links each client feature to the components
(from an ARCHITECTURE.md §6 table: Component | Responsibility | Tech |
Deploy unit | ...) that must be built or changed for the feature to work.
The core rubric is in ../linking-v3-core.md — read it first. It is
project-agnostic. Your job: an ADD-ON for one project type, listing the
components that type usually has and the work that estimates for that type
usually miss.

Research first (web). Use at least 4 reputable sources: vendor reference
architectures (AWS/Azure/GCP well-architected or solution libraries),
well-known books or engineering blogs, standards bodies. No content farms.
Cite each claim: source title + URL. Do not quote more than 15 words from
any source.

Write two files into THIS folder (addons/):

1. `addon-<type>.md` (≤ 80 lines):
   ## Components this type usually has
   table: Component kind | What it does | Rubric question that finds it (1–8) | Source
   ## Work estimates for this type usually miss
   bullets, each: the hidden work, why it's missed, which component it lands in, source
   ## Linking hints
   3–6 one-line rules specific to this type (e.g. "a RAG feature that adds a
   new document type links ingestion, chunking AND the eval set")
   ## Sources
   numbered list, title + URL

2. `fixture-<type>/ARCHITECTURE.md` (≤ 120 lines) — a small but realistic
   reference system of this type, modelled on one of your sources:
   - §5: C4 containers, 3–6 of them, one line each (name, tech, who uses it)
   - §6: component table with EXACTLY these columns:
     | Component | Responsibility | Tech | Deploy unit | src |
     12–18 components, each inside one of the §5 containers (name the
     container in Deploy unit). Responsibility is 1 sentence, specific.
   - §9: external systems, 2–4 rows: | System | Used for | Component that integrates |
   And `fixture-<type>/features.md`: 6 client-facing features of that
   system, format `- <id>: <name> — <one-sentence what the user gets>`.
   Pick features that exercise different parts (at least one that is
   triggered without a person, one that stores something, one that talks
   outside).

Reply with only: the two file paths and the number of sources used.
