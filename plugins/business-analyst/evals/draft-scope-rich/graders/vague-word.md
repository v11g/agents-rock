---
type: llm
focus: last_message
---

E2 says "Deliveries must be fast."

PASS if the word "fast" appears nowhere in the draft's problems, system
purposes, feature names, "What it does" text or assumptions, except inside
a quotation of the client's words, AND a client question asks what "fast"
means in measurable terms (hours, a cut-off time) or quotes it.
FAIL if a feature, purpose or assumption says "fast" in its own words, or
no question asks for the measurable meaning.
