# Output contract

Every run emits six core fields, plus exactly one block named for the
framework that ran. Nothing else appears at the top level.

## Core fields

| Field | Contents |
| ----- | -------- |
| `problem` | The problem as this skill understands it, restated in one or two sentences. |
| `framework_used` | The framework that ran. A `problem-router` run runs none — emit `router` there, naming the routing pass itself. |
| `framework_reason` | One line: why this framework, for this problem. |
| `evidence` | What the input actually supplied. Each entry names its type. |
| `assumptions` | Anything the input did not state. Each carries a status. |
| `open_questions` | What would change the analysis if answered. |

An empty `evidence` list is a finding, not an omission: it means nothing
in the input supports the analysis, and the output says so.

## Framework blocks

| Block | Fields |
| ----- | ------ |
| `router` | `problem_class`, `reasoning_skill`, `recommended_framework`, `confidence`, `why`, `frameworks_rejected` |
| `double_diamond` | `discover`, `define`, `develop`, `deliver` |
| `rca` | `symptom`, `immediate`, `contributing`, `underlying`, `root`, `actions` |
| `five_whys` | `why_chain`, `root_candidate`, `uncertainties` |
| `a3` | `background`, `current`, `problem`, `target`, `causes`, `countermeasures`, `plan`, `follow_up` |
| `pdca` | `hypothesis`, `test`, `metric`, `expected`, `actual`, `next` |
| `iceberg` | `event`, `patterns`, `structures`, `mental_models` |
| `system_map` | `system_boundary`, `actors`, `components`, `relationships`, `dependencies`, `external_factors` |
| `causal_loop` | `variables`, `links`, `loops`, `delays` |
| `leverage_points` | `elements`, `points` |

Later skills add blocks. The core never changes — that is what lets one
skill consume another's result without knowing which framework produced
it.

## Evidence types

`user-provided fact`, `document`, `log`, `metric`, `interview`,
`observation`, `external source`, `inferred`.

Anything `inferred` is never rendered as fact. If the input did not state
it, it belongs in `assumptions`, not `evidence`.

## Assumption status

`unverified` — nothing has confirmed it.
`confirmed` — the human confirmed it during this run.

Default is `unverified`. An assumption is never silently promoted.

## Confidence

`low` / `medium` / `high`. Numeric confidence is never emitted: `0.84`
implies a precision this reasoning does not have.

Confidence reflects evidence quantity, evidence quality, contradictions
in the input, and how many inferential steps separate the claim from the
evidence.

## Rendering

In chat by default: markdown headings, one per core field, then the
framework block.

A structure containing a cycle gets a diagram; one without gets prose.
Prose renders a cycle as a list, and a list loses the closure — `A -> B ->
C -> A` read top to bottom does not show that it comes back.

On request: one file, `problem-analysis.md`, in the directory the human
names. Core fields and the framework block become YAML front-matter above
the markdown body. No second JSON file is written — it would be a
duplicate representation with nothing keeping the two in agreement.

Example saved file:

```markdown
---
problem: Deploys fail intermittently after the runner image update.
framework_used: five-whys
framework_reason: Narrow scope, causal chain looks linear.
evidence:
  - type: log
    ref: ci-run-4471
assumptions:
  - statement: Staging mirrors production runner config.
    status: unverified
open_questions:
  - Who owns the runner image?
five_whys:
  why_chain:
    - Deploys fail -> the runner cannot pull the base image
    - It cannot pull -> the registry credential expired
  root_candidate: Credential rotation is manual and undocumented.
  uncertainties:
    - Whether rotation was ever automated.
---

# Problem analysis

...
```
