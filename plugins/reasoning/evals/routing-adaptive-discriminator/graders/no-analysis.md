---
type: llm
weight: 1
---

The router classifies and recommends; it does not analyse.

PASS if the response stops at classification plus a route, naming what it
rejected and why.

FAIL if it names a root cause, proposes a fix (for example separating the
nightly jobs onto their own pool), or previews what the systems-thinking
pass would probably find. Identifying that the nightly jobs and PR builds
share a pool is repeating the input and is fine; concluding that this is
the cause, or that splitting them would work, is not.
