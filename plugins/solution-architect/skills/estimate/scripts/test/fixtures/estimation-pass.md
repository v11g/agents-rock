# Booking App — Estimation

## Summary

| Feature | Tier | Range (h) | src |
| --- | --- | --- | --- |
| User can book appointment | M | 40–120 | stated |
| Email reminders | S | 12–36 | proposed |

Recommended delivery: 2 engineers (1 senior, 1 mid), AI-assisted — see detail.

| Line | Hours |
| --- | --- |
| Development | 90.67 |
| Overhead (35%) | 31.73 |
| Risk buffer | 12 |
| Estimate-spread buffer | 10.91 |

### Roadmap

| Milestone | Features | Months (from start) |
| --- | --- | --- |
| M1 - Booking core | User can book appointment | 0–0.3 |
| M2 - Notifications | Email reminders | 0.3–0.4 |

Sequential delivery by the recommended scenario team. Bands are relative
months, not calendar dates. Ordering: proposed.

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

### Scenario comparison

| Scenario | Team | AI-assisted | Months | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| 3eng-noai | 2 mid + 1 junior | no | 0.43 | $7,266 | — |
| 2eng-max5x | 1 senior + 1 mid | yes | 0.40 | $5,993 | recommended |

### Calibration

Tier hour bands used: S 20-60h · M 60-160h · L 160-400h (defaults — no
delivery history supplied).
