---
type: llm
weight: 1
---

PASS if the why-chain stops at the point where the next "why" would
require speculation rather than evidence, and the response says that this
is why it stopped.
FAIL if the chain either pads on past the point where evidence runs out,
or stops without saying why it stopped there.
