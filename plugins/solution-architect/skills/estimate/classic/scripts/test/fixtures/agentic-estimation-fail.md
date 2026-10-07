# Booking Revamp — Estimation

## Summary

This will take 1–2 hours depending on complexity.

| Feature | Tier | src |
| --- | --- | --- |
| Planning | S | proposed |
| API client swap | S | stated |

### Out of scope

- Anything not listed above.

## Estimation detail

Calibration: 20 measurement records; 1 of 4 tasks uncalibrated.

| Task | Baseline (min) | Samples | Match | Confidence | Assumptions | src |
| --- | --- | --- | --- | --- | --- | --- |
| swap-refactor | 11 | 7 | repo+agent+model | MED | old client has no dynamic call sites | stated |
| swap-tests | 10 | 10 | repo+agent+model | HIGH | none | proposed |
| swap-db | not estimated | 0 | none | MED | none | proposed |

### Evidence

| Id | Task | Actual (min) |
| --- | --- | --- |
| m01 | Refactor A | 6 |
| m02 | Refactor B | 8 |
| m99 | Invented run | 3 |
| m01 | Refactor A | 600 |

### Assumptions

| Assumption | Impact if wrong |
| --- | --- |
| Existing CI pipeline stays as is | validation task grows |

### Risks

| Risk | Probability | Impact (min) | Reason |
| --- | --- | --- | --- |
| SDK incompatibility | 30% | 30 |  |
