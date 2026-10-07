---
name: estimate
description: Interview-driven project estimation that prices work from weighted factor scores, not hours. Use when the user asks for an estimate, effort sizing, or a quote — with or without existing architecture docs. It produces a price, not a timeline or a staffing plan; asked "how long would this take", it says so and prices the scope instead.
---

# estimate

Two flows share one command. Pick the flow from the lead's requirements
package, never by asking:

1. Look for `requirements.json` in the lead folder (the business-analyst
   skill writes it). Read its top-level `scopeMode`.
2. `"workflow"` → follow `workflow-based/FLOW.md`: features come from the
   package, components from `ARCHITECTURE.md`, the review is a plugin
   workflow, and the price is per feature.
3. Anything else — `"classic"`, no field, or no file → follow
   `classic/FLOW.md`: today's interview, techniques and pages.

Paths inside each `FLOW.md` are relative to that flow's folder; run its
scripts from there. Both flows price with `shared/lib/pricing.mjs` and
`project-price.mjs`. Nothing in `classic/` reads `workflow-based/`.
`workflow-based/` reuses three classic references: the scoring guide,
the task shapes, and the context-factor section of the interview.

Dependency: Node ≥ 20. No npm install needed — the scripts are dependency-free.
