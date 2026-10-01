---
type: llm
weight: 1
---

A stated lag is a duration ("about six weeks later") or an explicit
"after a delay". A dated sequence — "prices rose in March, churn rose in
April" — is not a stated lag.

PASS if `delays` is empty, absent, or contains only stated lags.
FAIL if `delays` holds an inferred lag (for example "roughly a one-quarter
lag between documentation time and knowledge gaps") or a lag read off the
March→April dates, instead of recording it in `assumptions`.
