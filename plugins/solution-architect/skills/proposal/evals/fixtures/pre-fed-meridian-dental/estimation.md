# Meridian Dental Patient Portal — Estimation (internal)

Computed from `estimation-inputs.json` by the estimate skill. Internal document:
rates, scenario comparison and the risk register never reach the client.

## Scenarios

| Scenario | Team | Hours | Months | Total cost |
|---|---|---|---|---|
| `lean-2eng` | senior + mid, AI-assisted | 269.39 | 1.07 | $15,928.50 |
| `full-4eng` | senior + mid + mid + junior | 394.42 | 1.01 | $25,355.37 |

Recommended: `lean-2eng` — `full-4eng` buys back less than a week of calendar
time for roughly $9,400 more.

## Milestones (lean-2eng)

| Milestone | Features | Start → end (months) |
|---|---|---|
| M1 - Secure portal | patient-login, records-view | 0 → 0.88 |
| M2 - Recall reminders | recall-reminders | 0.88 → 1.07 |

## Exclusions

- Insurance claims submission or tracking — phase 2.
- Online appointment booking — the practice keeps its phone book-in.
- Writing back to the practice management system — the portal is read-only.
- Card payments in the portal — patients pay at reception.

## Assumptions

- The practice management system produces a nightly export. If wrong: recompute
  `records-screens` at logic category, +40%.
- Email and date of birth are enough to identify a patient.
- Every record view is logged and kept for seven years.
- The messaging provider for recall reminders is already chosen and paid for.

## Risk register (internal)

| Risk | Probability | Impact (hours) |
|---|---|---|
| practice management export format is undocumented | 0.4 | 32 |

Project confidence: MED.
