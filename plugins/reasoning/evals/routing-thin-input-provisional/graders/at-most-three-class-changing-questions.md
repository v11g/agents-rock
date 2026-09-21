---
type: llm
weight: 1
---

PASS if the response asks at most three clarifying questions, and each
question asked is one whose answer would change the problem's class.
FAIL if more than three questions are asked, or if any question asked
would not change the classification (e.g. cosmetic or irrelevant detail).
