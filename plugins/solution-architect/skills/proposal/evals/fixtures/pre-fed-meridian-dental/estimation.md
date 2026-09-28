# Meridian Dental Patient Portal — Estimation

## Summary

| Feature | Tier | Range (h) | src |
| --- | --- | --- | --- |
| Patients sign in to see their own records | M | 95–250 | stated |
| Patients read treatment history and bills | M | 42–105 | stated |
| Patients get their six-month check-up reminder | S | 25–70 | proposed |

### Roadmap

| Milestone | Features | Share |
| --- | --- | --- |
| M1 - Secure portal | Patients sign in to see their own records, Patients read treatment history and bills | 84% |
| M2 - Recall reminders | Patients get their six-month check-up reminder | 16% |

Bands are relative shares of total effort, not durations. This estimate
produces no timeline. Ordering: stated.

### Assumptions

| Assumption | Impact if wrong |
| --- | --- |
| nightly export from the practice system | recompute records-screens at logic category, +40% |
| email and date of birth are enough to identify a patient | a stronger identity check adds work to patient-login |
| every record view is logged and kept for seven years | a different retention rule changes the audit store, not the screens |
| the messaging provider for recall reminders is already chosen and paid for | recompute recall-reminders at logic category, +20% |

### Out of scope

- Insurance claims submission or tracking — phase 2.
- Online appointment booking — the practice keeps its phone book-in.
- Writing back to the practice management system — the portal is read-only.
- Card payments in the portal — patients pay at reception.

## Estimation detail

Technique: three-point PERT — detailed requirements and architecture available.

| Task | Category | O/M/P | E (h) | Confidence | Assumptions | src |
| --- | --- | --- | --- | --- | --- | --- |
| Patient sign-in and identity checks | boilerplate | 40/60/100 | 63.33 | HIGH | email and date of birth identify a patient | stated |
| Record access and audit rules | logic | 55/88/150 | 92.83 | MED | every record view is logged for seven years | stated |
| Treatment history and billing screens | logic | 42/64/105 | 67.17 | MED | nightly export from the practice system | stated |
| Scheduled recall messages | logic | 25/40/70 | 42.5 | MED | messaging provider already chosen | proposed |

### Price

| Figure | Value |
| --- | --- |
| Presented range | $14,000 – $18,000 |
| If a single number is required | $16,000 |
| Contingency rate | 15% |
| Implied accuracy | 17% |

### Risk register (internal)

| Risk | Probability | Impact (hours) |
| --- | --- | --- |
| practice management export format is undocumented | 0.4 | 32 |

### Calibration

No delivery history was supplied, so the bands are the defaults;
recalibrate them against actuals roughly twice a year. Whatever AI leverage
the team has is priced into the bands already and stays as margin.
