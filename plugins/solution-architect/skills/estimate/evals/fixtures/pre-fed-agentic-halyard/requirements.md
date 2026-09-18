# Halyard Marine — Parts Catalogue Search Revamp · Requirements

Status: READY_FOR_ARCHITECTURE · Depth: STANDARD · Updated: 2026-09-12

## 1. Business context

Catalogue search only matches exact part codes, so counter staff fall back to
paper microfiche and customers get sent the wrong impeller (G-001: halve
wrong-part returns in two quarters).

## 2. Requirements

| Id | Requirement | Label |
| --- | --- | --- |
| FR-001 | Search matches by engine make, model and year, not only part number | confirmed |
| FR-002 | Results show superseded parts and link to the replacement | confirmed |
| FR-003 | Fitment index rebuilds nightly from the supplier feed | assumed |
| FR-004 | Counter staff can filter results by depot stock | recommended |

## 3. Rules, integrations, data

- BR-001 — a superseded part number resolves to its newest live replacement.
- INT-001 — supplier catalogue feed, weekly CSV drop (confirmed).
- 180,000 part rows; about 1.2M fitment rows once expanded.
- NFR-001 — search returns within 400ms at the counter.

## 4. Constraints and assumptions

- CON-001 — work lands in the existing `halyard-catalog` repo (Next.js +
  Postgres), no rewrite.
- CON-002 — no new infrastructure; search stays on the existing Postgres.
- ASM-001 — the supplier feed carries fitment data for the top 20 engine makes.

## 5. Open questions

- Q-001 (P2) — how deep do supersession chains go in the current data?

## Out of scope

- Public consumer storefront
- Supplier onboarding portal
