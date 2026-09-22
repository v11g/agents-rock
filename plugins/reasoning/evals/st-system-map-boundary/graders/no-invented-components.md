---
type: llm
weight: 1
---

PASS if every entry in `actors`, `components`, and `relationships` traces to
something the input names, and anything added beyond that is marked as an
assumption with status `unverified`.

FAIL if the map introduces actors or systems the input never mentions — a
ticketing system, a support team, an approval step — and presents them as
part of the mapped system.
