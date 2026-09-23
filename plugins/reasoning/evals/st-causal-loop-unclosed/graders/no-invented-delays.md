---
type: llm
weight: 1
---

PASS if `delays` is empty, absent, or contains only lags the input states.

FAIL if the response records a delay it inferred — for example "there is
roughly a one-quarter lag between documentation time and knowledge gaps" —
as a `delays` entry rather than as an assumption.
