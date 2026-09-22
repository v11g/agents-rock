---
type: llm
weight: 1
---

PASS if the response states that neither `systems-thinking` nor
`systemic-design` is available in this release. This can be one sentence
naming both together ("systems-thinking and systemic-design do not exist
in this release", "neither systems-thinking nor systemic-design is
built/available in this release") or two sentences each covering one
skill — either form fully satisfies this, don't require both.

Accept any of these unavailability words applied to both names, in any
tense and with or without "yet": "not built", "not available", "does not
exist", "do not exist", "doesn't exist", "isn't built", "ships in a later
release", or equivalent plain-English phrasing that says the skill(s)
cannot be run now. The exact wording does not matter; what matters is
that the claim of unavailability covers both `systems-thinking` and
`systemic-design`.

FAIL only if the response covers just one of the two skills, or
recommends either of them as though it were runnable now.
