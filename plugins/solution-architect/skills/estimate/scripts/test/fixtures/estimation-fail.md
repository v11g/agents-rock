# Booking App — Estimation

## Summary

| Feature | Tier | Range (h) | src |
| --- | --- | --- | --- |
| User can book appointment | M | 40–120 | stated |
| Email reminders | S | 12–36 | proposed |

Recommended delivery: 2 engineers (1 senior, 1 mid), AI-assisted — see detail.

### Assumptions

| Assumption | Impact if wrong |
| --- | --- |

## Estimation detail

Technique: three-point PERT — detailed backlog available.

| Task | Category | O/M/P | E (h) | Confidence | Assumptions | src |
| --- | --- | --- | --- | --- | --- | --- |
| Booking CRUD API | boilerplate | 16/24/40 | 0 | HIGH | single timezone | stated |
| Slot conflict + cancellation rules | logic | 24/40/80 | 44 | MED | no recurring bookings in v1 |
| Scheduled reminder jobs | logic | 12/20/36 | 21.33 | MED |  | proposed |

### Calibration

Tier hour bands used: S 20-60h · M 60-160h · L 160-400h (defaults — no
delivery history supplied).
