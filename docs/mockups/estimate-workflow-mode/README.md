# Estimate workflow mode — mockups (Sin Kowa)

Design mockups for the solution-architect estimate skill's workflow mode, built
on the Sin Kowa lead. Nothing here is plugin code; these pages fix the design
before the spec.

Terms: **System → Feature → Component**. A feature is a business piece the
client asked for (F01–F19) and is what gets scored and priced. A component is a
piece engineers build, inside a container, as in the architecture document; it
carries no price.

## Pages

| File | Who reads it | What it shows |
|---|---|---|
| `po-review-mockup.html` | PO | Scope review: systems, workflows, features per step |
| `score-review-mockup.html` | Engineer | Scores the 19 features; each card lists the components that build it |
| `estimate-mockup.html` | Client | Workflow-based estimate: price, milestones, register |
| `estimate-feature-mockup.html` | Engineer | Component-based estimate: the signed-off score review, read-only, with Scoring \| Effort |
| `proposal-mockup.html` | Client | Proposal in the format sent to Sin Kowa |

Price for all pages: $138,500–157,000 (the sent workbook's scores).

## Build

`po-review-mockup.html` is edited by hand; its reading style sits between the
`/*READING-START*/` and `/*READING-END*/` markers. The others are generated:

```sh
python3 build-score.py      # score review + Component-based estimate
python3 build-workflow.py   # Workflow-based estimate
python3 build-proposal.py   # proposal
python3 -m http.server 8765 # then open http://localhost:8765/
```

| Source | Holds |
|---|---|
| `score-data.js` | Systems, workflows, features (from the scope review) |
| `eng-data.js` | Components and their links to features (today's estimate) |
| `final-data.js` | Signed-off state: tasks, milestone wording, AI pre-fill component |
| `cap-data.js` | The five scores per feature (workbook tab 1) |
| `rollup.js` | Shared pricing roll-up (v2 rules) |
| `reading.css` | Long-reading style shared by every page |
| `score-review.base.html` | Page CSS and rubric anchors the score review builds on |
| `score-review.body.html`, `estimate.src.html`, `proposal.body.html` | Page bodies |

## Not included

`architecture.html`: the score review and Component-based page link to the C2
and C3 views at `architecture.html#panel-containers` and
`#panel-components-api`. Put the lead's architecture document (`dist/index.html`,
rendered with the viewer that supports panel links) next to the pages to follow them.

## Open

- Currency: pages say USD; the sent proposal says SGD 150–180k.
- Milestones: 4 here, 3 in the sent proposal.
