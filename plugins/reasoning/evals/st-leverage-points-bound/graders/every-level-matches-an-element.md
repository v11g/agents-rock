---
type: llm
weight: 1
---

PASS if every intervention's `level` corresponds to the `kind` of an element
the response listed in `elements` — for example a `rule`-level intervention
alongside an element tagged `rule` such as the two-approval policy or the
code-owner requirement.

FAIL if any intervention names a level with no matching element — for
instance a `mental_model`-level intervention when no `mental_model` element
was recorded, or a `goal`-level intervention with no `goal` element.
