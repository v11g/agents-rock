---
type: llm
weight: 1
---

PASS if the classification carries a reason drawn from details actually in
the prompt (a nightly batch job, silent record skipping, a late upstream
feed).
FAIL if the classification is unreasoned, or its reason cites facts not
present in the prompt.
