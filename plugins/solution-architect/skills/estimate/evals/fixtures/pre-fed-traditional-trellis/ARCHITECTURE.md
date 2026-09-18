---
name: Trellis Wholesale Ordering Portal
repo: trellis-wholesale
team: Trellis in-house dev team (2) + vendor pair
updated: 2026-09-10
mode: greenfield
projectType: web-application
docVersion: 1
electedDocs: [{"name":"threat-model","elected":true},{"name":"interface-contract","elected":false,"reason":"no public API exposed to third parties in v1"},{"name":"estimation","elected":false,"reason":"not run yet"},{"name":"domain-overview","elected":true}]
---

# Trellis Wholesale Ordering Portal — Architecture

## 1 Goals and Scope

Trade buyers self-serve their reorders against contract pricing, and orders
land in Sage 200 without a human re-keying them (requirements G-001, G-002).
Consumer retail is out of scope.

## 2 Constraints

| Constraint | src |
| --- | --- |
| Trellis's two in-house developers write and own the code | stated |
| Live before the spring buying season, 1 March 2027 | stated |
| Hosting stays on the client's existing Azure tenant | stated |

## 5 Architecture Model

C1/C2 views live in `c4-src/`. Two containers: the buyer-facing web app and the
ordering API, with a scheduled sync worker between the API and Sage 200.

## 6 Core Components

| Component | Responsibility | Tech | src |
| --- | --- | --- | --- |
| `trellis.web` | Renders catalogue, basket and order history for trade buyers | React + Vite | proposed |
| `trellis.api` | Order capture, account auth, contract-price resolution | Node + Fastify | proposed |
| `trellis.api.catalogue` | Search and browse over 14,000 SKUs with per-depot stock | Node + Postgres FTS | proposed |
| `trellis.sync` | Pushes orders to Sage 200 and pulls prices, stock and accounts | Node worker | proposed |
| `trellis.reporting` | Sales-desk order dashboards | — | proposed |

## 8 Data Stores

| Store | Purpose | PII | src |
| --- | --- | --- | --- |
| Postgres `orders` | Orders, lines, submission state | commercial | proposed |
| Postgres `catalogue` | SKUs, contract prices, depot stock snapshots | none | proposed |

## 9 External Integrations

| System | Method | Failure mode | src |
| --- | --- | --- | --- |
| Sage 200 ERP | REST, bidirectional | queue orders locally, retry with backoff | stated |
| Stripe | REST, card-on-account | orders still submit; payment marked pending | proposed |

## 13 Quality Requirements and SLOs

| Requirement | Target | src |
| --- | --- | --- |
| Peak availability 07:00–09:00 | 99.9% in window | stated |
| Catalogue search latency | p95 under 2s on 14,000 SKUs | proposed |

## 15 Risks and Technical Debt

| Risk | Impact | src |
| --- | --- | --- |
| Sage 200 REST API may not be enabled on the client's licence tier | Integration work re-planned around a nightly file exchange | stated |
| Contract pricing rules in Sage are undocumented and partly per-branch | Price resolution rework after first data pull | observed |
| Depot stock may come from the WMS rather than Sage (Q-001 open) | Second integration surface for live stock | stated |
| In-house developers are shared with a live ERP upgrade until December | Ramp is slower than a dedicated team | stated |
