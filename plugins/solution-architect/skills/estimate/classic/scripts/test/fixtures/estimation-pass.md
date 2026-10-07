# Booking App — Estimation

## Summary

| Feature | Tier | Range (h) | src |
| --- | --- | --- | --- |
| User can book appointment | M | 40–120 | stated |
| Email reminders | S | 12–36 | proposed |

### Roadmap

| Milestone | Features | Share |
| --- | --- | --- |
| M1 - Booking core | User can book appointment | 76% |
| M2 - Notifications | Email reminders | 24% |

Bands are relative shares of total effort, not durations. This estimate
produces no timeline. Ordering: proposed.

### Assumptions

| Assumption | Impact if wrong |
| --- | --- |
| single timezone | recompute booking-api at logic category, +30% |

### Out of scope

- Recurring bookings
- SMS reminders

## Estimation detail

Technique: three-point PERT — detailed backlog available.

| Task | Category | O/M/P | E (h) | Confidence | Assumptions | src |
| --- | --- | --- | --- | --- | --- | --- |
| Booking CRUD API | boilerplate | 16/24/40 | 25.33 | HIGH | single timezone | stated |
| Slot conflict + cancellation rules | logic | 24/40/80 | 44 | MED | no recurring bookings in v1 | proposed |
| Scheduled reminder jobs | logic | 12/20/36 | 21.33 | MED | provider already chosen | proposed |

### Price

| Figure | Value |
| --- | --- |
| Presented range | $10,000 – $14,000 |
| If a single number is required | $12,000 |
| Contingency rate | 15% |
| Implied accuracy | 24% |

### Calibration

Implied rate check: the M band's $2,750 midpoint against the 69 h behind a
comparable delivered feature is about $40/h blended — defensible for this
team. No delivery history was supplied, so the bands are the defaults;
recalibrate them against actuals roughly twice a year. Whatever AI leverage
the team has is priced into the bands already and stays as margin.
