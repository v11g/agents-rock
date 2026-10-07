---
type: llm
focus: trace
---

Workflow mode renders two internal pages into the lead's dist/ folder:
estimate.html and estimate-components.html.

PASS if either (a) the agent ran workflow-based/scripts/render.mjs, both
files exist in dist/, and the closing question names both page URLs, or
(b) the agent stopped at a gate (architecture not reviewed, or the
dynamic-workflows /config message) before compute.mjs ran, and wrote neither
estimate.html nor estimate-components.html. A stop at a gate with no page
written is a PASS even if no render was attempted.
FAIL if it wrote a classic estimate.html, rendered without validating, or
closed without naming the pages after rendering them.
