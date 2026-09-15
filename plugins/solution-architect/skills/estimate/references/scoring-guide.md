# Scoring guide — five factors, 1–5 each

Read before proposing any score (interview step 3). Every anchor below is
quoted verbatim on a score card, in `estimation-inputs.json`
(`scores.<factor>.anchor`), on the page and in the xlsx Score Rationale tab.
`schema.mjs` refuses an anchor that is not one of these sentences.

| Dimension | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Tech complexity | Standard CRUD, well-documented library usage, copy-paste patterns | Minor customisation of standard patterns, simple state management | Custom business logic, moderate algorithm complexity, multiple states | Non-trivial algorithms, real-time systems, ML inference, complex data transforms | Novel architecture, distributed systems, low-level optimisation, R&D territory |
| Feature size | Single UI element or micro-function, <1 day of work | Small self-contained feature, simple form or display component | Medium feature with multiple components and backend logic | Large feature spanning frontend, backend, DB, and tests | Epic-scale feature, multiple sub-features or screens |
| Dependencies | Fully standalone, no external services or shared state | One internal dependency (e.g. auth check) | 2–3 internal services or one third-party API | Multiple third-party APIs or tightly coupled internal systems | Deep cross-system dependencies, legacy integrations, or shared infrastructure changes |
| Uncertainty | Fully defined spec, clear acceptance criteria, precedent exists | Minor ambiguities, can be resolved with one clarifying question | Some open questions, design decisions to be made during build | Significant unknowns, exploratory work needed, spec may change | Highly experimental, no clear solution path, outcomes unclear |
| Risk | Fully reversible, no user data, isolated module | Low stakes, easy rollback, minimal user impact | Moderate impact if broken, requires testing, affects multiple users | Payments, auth, data migrations, or PII — high business impact | Core infrastructure, compliance requirements, irreversible operations |

Tier scale (sum of the five scores): S ≤ 11 · M 12–17 · L 18–22 · XL 23+.
Default calibration bands when the org has no history: S 20–60 h · M 60–160 h
· L 160–400 h · XL 400–800 h. A card at Σ 11, 17 or 22 sits one point from
the next tier and says so; Σ 23+ recommends splitting the feature.

Provenance: a score the human accepted as the agent proposed it is
`proposed`; a score the human changed — or a rewritten plain-words note — is
`stated`. One `scoreProvenance` per feature: `stated` if any cell changed.
