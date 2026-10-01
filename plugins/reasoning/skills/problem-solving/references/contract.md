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

## Ids and links

Every entry carries an `id`, unique within the run:

| Entry | Prefix |
| ----- | ------ |
| `evidence` | `e` — `e1`, `e2`, … |
| `assumptions` | `a` |
| `open_questions` | `q` |
| any item inside the framework block | `c` |

Number in order of first appearance. An entry keeps its id when the
result is re-run after an interview answer; a new entry takes the next
free number. Never reuse an id within a run.

Framework block items follow one rule, for every block:

- An item that is a string becomes `{id, text}`.
- A single-value field that holds a claim (`rca.symptom`, `pdca.metric`,
  …) is an item too. The router block's `problem_class`,
  `reasoning_skill`, `recommended_framework` and `confidence` stay plain
  values — they are routing labels, not claims. A `null` stays `null`.
- An item that is an object (`{step, owner_role, when, signal}`,
  `{from, to, assumption}`, …) gains `id` and keeps its fields.
- A field that refers to another item (`links.from`, `links.to`, the
  entry an intervention targets, the element a leverage point sits on)
  holds that item's id, not its text.
- A cause labelled `root` or `root_candidate` carries the label as
  `status`.

Links:

- `evidence` and `assumptions` entries carry `supports: [ids]` — the `c`
  items they back. An empty list is a finding: the entry backs nothing.
- `open_questions` entries carry `blocks: [ids]` — the `c` items the
  question holds back.

"Name the `evidence` entry that ties this cause to the symptom" is
answered by an id in that entry's `supports`.

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
| `systemic_design` | `explore`, `reframe`, `create`, `catalyse` |
| `theory_of_change` | `inputs`, `activities`, `outputs`, `short_term_outcomes`, `long_term_outcomes`, `impact`, `links` |
| `three_horizons` | `h1`, `h2`, `h3` |

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

In chat: markdown headings, one per core field, then the framework block.
Each entry's id renders as a tag after it — `[e1]`, `[c4]` — so the human
can refer to it. Its `supports` or `blocks` list renders right after the
tag as `-> [c1, c2]`; an empty list renders as `-> []`, never as prose in
its place.

A structure containing a cycle gets a diagram; one without gets prose.
Prose renders a cycle as a list, and a list loses the closure — `A -> B ->
C -> A` read top to bottom does not show that it comes back.

## Saving

Every run is saved to one file:

```
~/.reasoning/problems/<YYYY-MM-DD>-<slug>/<NN>-<skill>.md
```

Resolve `~` to the absolute home directory before writing.

- `<YYYY-MM-DD>` — today's date, when the problem folder is created.
- `<slug>` — the problem in 2–5 lowercase kebab-case words. If that folder
  already exists and this run did not start from a hand-off, append `-2`,
  `-3`, …. List `~/.reasoning/problems/` to check.
- `<NN>` — `01`, `02`, …: the next free number in the folder. List the
  folder to find it.
- `<skill>` — `problem-router`, `problem-solving`, `systems-thinking`, or
  `systemic-design`.

| Event | Write |
| ----- | ----- |
| A run starts with no hand-off | create a new problem folder |
| A run starts from a hand-off | use the folder the hand-off names |
| The framework's first pass completes, before any interview round | write `<NN>-<skill>.md` |
| An interview answer changes the result | rewrite the same file, ids kept |
| The human re-runs a skill on the same problem | the next `<NN>`; the old file stays |
| The result is emitted | rewrite the same file, ids kept |

Every hand-off names the problem folder path, so the receiving skill
writes into it. Name it even when this run's write failed; the receiving
skill creates the folder if it is missing.

If a write is refused or fails, continue in chat, say once "not saved:
<reason>", and do not retry within the run.

The file holds the core fields and the framework block as YAML
front-matter above the markdown body chat showed. No second JSON file is
written — it would be a duplicate representation with nothing keeping the
two in agreement.

Double-quote every free-text value, or use `|` for multi-line text — a
colon followed by a space inside an unquoted value breaks the YAML.

Example saved file:

```markdown
---
problem: "Deploys fail intermittently after the runner image update."
framework_used: five-whys
framework_reason: "Narrow scope, causal chain looks linear."
evidence:
  - id: e1
    type: log
    ref: "ci-run-4471"
    supports: [c1, c2]
assumptions:
  - id: a1
    statement: "Staging mirrors production runner config."
    status: unverified
    supports: [c2]
open_questions:
  - id: q1
    text: "Who owns the runner image?"
    blocks: [c3]
  - id: q2
    text: |
      Which runner pool failed — shared or dedicated?
      Look in: the CI runner dashboard
    blocks: [c2]
five_whys:
  why_chain:
    - id: c1
      text: "Deploys fail -> the runner cannot pull the base image"
    - id: c2
      text: "It cannot pull -> the registry credential expired"
  root_candidate:
    id: c3
    text: "Credential rotation is manual and undocumented."
    status: root_candidate
  uncertainties:
    - id: c4
      text: "Whether rotation was ever automated."
---

# Problem analysis

...
```
