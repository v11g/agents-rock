# Booking Revamp — Estimation

## Summary

Delivery: agentic (claude-code + sonnet) · Baselines: 20 measurements, 3 shapes matched

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
| plan-refactor | 47.5 | 2 | global shape | LOW | none | proposed |
| swap-refactor | 11 | 7 | repo+agent+model | MED | old client has no dynamic call sites | stated |
| swap-tests | 10 | 10 | repo+agent+model | HIGH | none | proposed |
| swap-db | not estimated | 0 | none | UNCALIBRATED | none | proposed |

### Evidence

| Id | Task | Actual (min) |
| --- | --- | --- |
| m01 | Refactor A | 6 |
| m02 | Refactor B | 8 |

### Assumptions

| Assumption | Impact if wrong |
| --- | --- |
| Existing CI pipeline stays as is | validation task grows |

### Risks

| Risk | Probability | Impact (min) | Reason |
| --- | --- | --- | --- |
| SDK incompatibility | 30% | 30 | new SDK may break integration test mocks |
