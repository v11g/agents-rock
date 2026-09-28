# Harborline Dispatch Portal — Estimation

## Summary

| Feature | Tier | Range (h) | src |
| --- | --- | --- | --- |
| Dispatcher assigns jobs on a live board | M | 170–410 | stated |
| Drivers check in and out from their phone | M | 90–220 | stated |
| Customers see where their delivery is | S | 50–125 | proposed |

### Roadmap

| Milestone | Features | Share |
| --- | --- | --- |
| M1 - Dispatch core | Dispatcher assigns jobs on a live board, Drivers check in and out from their phone | 84% |
| M2 - Customer tracking | Customers see where their delivery is | 16% |

Bands are relative shares of total effort, not durations. This estimate
produces no timeline. Ordering: stated.

### Assumptions

| Assumption | Impact if wrong |
| --- | --- |
| one depot, one timezone | recompute board-api at logic category, +30% |
| proof-of-delivery photos are kept for 12 months | longer retention adds storage cost, not build effort |
| the map provider for the tracking page is already chosen | recompute tracking-page at logic category, +20% |

### Out of scope

- Billing and invoicing integration — phase 2, the client keeps its current desk.
- iOS support for the driver screen — company phones are Android.
- Route optimisation or automatic job assignment — dispatchers assign by hand.
- Multi-depot support — one depot in v1.

## Estimation detail

Technique: three-point PERT — detailed requirements and architecture available.

| Task | Category | O/M/P | E (h) | Confidence | Assumptions | src |
| --- | --- | --- | --- | --- | --- | --- |
| Job and assignment service | boilerplate | 70/105/170 | 110 | HIGH | one depot, one timezone | stated |
| Live dispatch board screen | logic | 100/150/240 | 156.67 | MED | desktop browser only | stated |
| Driver check-in screens | logic | 60/95/150 | 98.33 | MED | company-issued phones only | stated |
| Proof-of-delivery photo upload | boilerplate | 30/45/70 | 46.67 | HIGH | photos kept for 12 months | stated |
| Public delivery tracking page | logic | 50/75/125 | 79.17 | MED | map provider already chosen | proposed |

### Price

| Figure | Value |
| --- | --- |
| Presented range | $11,000 – $14,500 |
| If a single number is required | $13,000 |
| Contingency rate | 15% |
| Implied accuracy | 19% |

### Risk register (internal)

| Risk | Probability | Impact (hours) |
| --- | --- | --- |
| depot wifi blackspots delay driver rollout | 0.3 | 40 |

### Calibration

No delivery history was supplied, so the bands are the defaults;
recalibrate them against actuals roughly twice a year. Whatever AI leverage
the team has is priced into the bands already and stays as margin.
