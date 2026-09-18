# Trellis Garden Supply — Wholesale Ordering Portal · Requirements

Status: READY_FOR_ARCHITECTURE · Depth: STANDARD · Updated: 2026-09-08

## 1. Business context

Trade buyers order by phone and fax. Two sales desk staff re-key every order
into Sage 200 and quote stock from memory. Trellis wants trade customers
placing their own orders (G-001) and the re-keying gone (G-002).

## 2. Requirements

| Id | Requirement | Label |
| --- | --- | --- |
| FR-001 | Authenticated trade customer builds and submits an order from a catalogue | confirmed |
| FR-002 | Each customer sees their own contract pricing, not list price | confirmed |
| FR-003 | Submitted orders push into Sage 200 with no manual re-entry | confirmed |
| FR-004 | Live stock availability per depot shows on the catalogue | assumed |
| FR-005 | A buyer can repeat a previous order in one action | recommended |

## 3. Rules, integrations, data

- BR-001 — contract pricing is per customer account and overrides list price.
- INT-001 — Sage 200 ERP, bidirectional (confirmed).
- INT-002 — Stripe card-on-account payments (assumed, not yet confirmed).
- 14,000 SKUs, about 900 trade accounts.

## 4. Constraints and assumptions

- CON-001 — Trellis's two in-house developers write and own the code; the
  vendor pairs with them.
- CON-002 — live before the spring buying season, 1 March 2027.
- ASM-001 — Sage 200 REST API is available on the client's licence tier.
- ASM-002 — contract pricing is imported from Sage, not re-modelled.

## 5. Open questions

- Q-001 (P2) — does live stock come from Sage or the depot WMS?

## Out of scope

- Consumer (retail) storefront
- Route planning for depot vans
