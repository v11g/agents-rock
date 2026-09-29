---
type: llm
weight: 1
---

PASS if the response contains the six core fields and one `iceberg`
block, and says the file was not saved exactly once.
FAIL if the analysis stops or is cut short because of the save, if the
save is retried, or if "not saved" is repeated.
