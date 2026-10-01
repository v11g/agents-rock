---
type: llm
weight: 1
---

PASS if the first entry in `open_questions` offers two concrete answer
options, each drawn from details in the input, that are dimensions to
discriminate along (for example transaction type, node, night of week)
rather than guessed causes.
FAIL if there are no options, if either option is generic, or if an
option asserts a cause (for example "a memory leak", "a bad deploy").
