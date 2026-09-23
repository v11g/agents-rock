# Harborline Dispatch — Validation plan

One row per claim that would change the design if it turned out false.

| claim | method | condition | threshold | status | src |
|---|---|---|---|---|---|
| p95 assignment latency holds at depot peak | load test | staging, 40 concurrent dispatchers, production-shaped job volume | 2 s | planned | stated |
| recovery time after a worker is killed mid-assignment | fault injection | one worker terminated mid-claim, lease expiry observed | 60 s | planned | stated |
| no duplicate dispatch on a retried assignment | integration test | forced retry against a live claim | zero duplicates | planned | stated |

Nothing here has run. Coverage: 2 of 2 `must` rows have a planned check;
0 of 3 planned checks carry evidence.
