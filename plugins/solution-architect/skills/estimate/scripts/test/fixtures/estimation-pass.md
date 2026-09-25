# Booking App — Estimation

## Summary

| Feature | Tier | Range (h) | src |
| --- | --- | --- | --- |
| User can book appointment | M | 40–120 | stated |
| Email reminders | S | 12–36 | proposed |

Recommended delivery: 2 engineers (1 senior, 1 mid), AI-assisted — see detail.

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

Tier hour bands used: S 20-60h · M 60-160h · L 160-400h (defaults — no
delivery history supplied).
