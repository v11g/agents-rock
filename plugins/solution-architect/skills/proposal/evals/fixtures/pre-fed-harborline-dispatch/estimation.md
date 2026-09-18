# Harborline Dispatch Portal — Estimation (internal)

Computed from `estimation-inputs.json` by the estimate skill. Internal document:
rates, scenario comparison and the risk register never reach the client.

## Scenarios

| Scenario | Team | Hours | Months | Total cost |
|---|---|---|---|---|
| `2eng-agentic` | senior + mid, AI-assisted | 465.07 | 1.85 | $27,498.15 |
| `3eng-classic` | mid + mid + junior | 709.95 | 2.11 | $35,497.54 |

Recommended: `2eng-agentic`.

## Milestones (2eng-agentic)

| Milestone | Features | Start → end (months) |
|---|---|---|
| M1 - Dispatch core | dispatch-board, driver-checkin | 0 → 1.51 |
| M2 - Customer tracking | customer-tracking | 1.51 → 1.85 |

## Exclusions

- Billing and invoicing integration — phase 2, the client keeps its current desk.
- iOS support for the driver screen — company phones are Android.
- Route optimisation or automatic job assignment — dispatchers assign by hand.
- Multi-depot support — one depot in v1.

## Assumptions

- One depot, one timezone. If wrong: recompute `board-api` at logic category, +30%.
- Proof-of-delivery photos are retained 12 months.
- The map provider for the tracking page is already chosen.

## Risk register (internal)

| Risk | Probability | Impact (hours) |
|---|---|---|
| depot wifi blackspots delay driver rollout | 0.3 | 40 |

Project confidence: MED.
