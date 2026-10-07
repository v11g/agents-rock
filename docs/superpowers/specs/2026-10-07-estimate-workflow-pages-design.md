# Estimate workflow mode — pages and workbook export (spec 3 of 4)

Date: 2026-10-07 · Plugin: solution-architect · Skill: estimate
Series: 1 business-analyst scope mode (done) · 2 data, linking, score review ·
**3 this** · 4 proposal format. Each spec squash-merges into
`feat/workflow-based-estimator`; that branch merges to `main` when all 4 are done.
Depends on spec 2 (`docs/superpowers/specs/2026-10-06-estimate-workflow-mode-design.md`,
branch `feat/estimate-workflow-mode`). The plan for this spec is written after
spec 2 merges, against its real code.

## Summary

Spec 2 ends with a validated `estimation.json` and a stub `render.mjs` that
exits 2 ("pages come in spec 3"). This spec replaces the stub: it renders two
internal HTML pages next to the architecture viewer, adds the workbook export
to the engineer page, and moves the closing question after serve.

```
estimation.json + requirements.json
   │ workflow-based/scripts/render.mjs
   ├─► <lead>/dist/estimate.html             Workflow-based page (team, sales)
   │     Summary · By system · Workflows & features · Milestones ·
   │     Assumptions & exclusions · Method
   └─► <lead>/dist/estimate-components.html  Component-based page (engineers)
         spec 2 score-review template, read-only: Scoring | Effort,
         components with hours + tasks, C2/C3 links, "download xlsx"
   then serve dist/ → closing question names both URLs
```

Both pages are internal. The client receives `proposal.html` (spec 4), which
reads the same `estimation.json`.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| E1 | No `estimation.md` in workflow mode, and no viewer companion tab. | User choice: the pages are the deliverable; names already live in `requirements.json` (spec 2 D5). |
| E2 | No client copy of the estimate (no `--client-only`, no redaction). Both pages are internal; the client gets `proposal.html` (spec 4). | The proposal already is the client document; one client artifact, not two. |
| E3 | `exclusions: string[]` is added to `estimation-inputs.json`, beside `assumptions`. The page shows BA `scope.out` (read from `requirements.json`, untouched) followed by `exclusions`. | Exclusions are the twin of assumptions; BA scope.out covers business scope only, not hosting/support/security testing. |
| E4 | Pages render into `<lead>/dist/`, beside the architecture viewer's `index.html`. Component-based C2/C3 links point at `index.html#panel-containers` and `index.html#panel-components-<container>`. | Links work without a path guess; the pages are files beside the viewer, not tabs in it. |
| E5 | Workflow-based page is built from the approved `estimate-mockup.html`; Component-based page reuses spec 2's `score-review.html` template in a read-only mode (as the mockup's `build-score.py` does with `FINAL = true`). | One template for the score review and the engineer page; the mockups are approved. |
| E6 | Workbook export reuses classic's export **unchanged in behaviour**: same 4 tabs (Ballpark Estimator, Project Roll-up, Task Breakdown, Score Rationale), same template formulas. A workflow-side converter feeds it classic-shaped rows. | User choice: keep the classic export as-is. |
| E7 | The closing question (spec 2 step 10) runs after serve and names both page URLs. | Spec 2 note: the human answers with the pages open. |
| E8 | The Method section stays visible on the Workflow-based page (no internal/client split on this page). | E2: the page is internal. |

## 1. Files

```
estimate/workflow-based/
  assets/estimate-template.html          NEW  from docs/mockups/.../estimate.src.html
  assets/score-review.html               spec 2; gains read-only mode (E5)
  scripts/render.mjs                     REPLACED  stub → renders both pages
  scripts/lib/page-workflow.mjs          NEW  estimation + requirements → page data
  scripts/lib/page-components.mjs        NEW  page data for the read-only score review
  scripts/lib/xlsx-rows.mjs              NEW  converter (E6, §4)
  scripts/lib/schema.mjs                 spec 2; accepts optional exclusions (E3)
  FLOW.md                                steps 10–11 (§5)
estimate/shared/assets/xlsx-export.js    NEW  classic export script, extracted (§4)
estimate/classic/assets/estimate-template.html   inlines the extracted script; no behaviour change
```

File names under `scripts/lib/` are indicative; the plan fixes them against
spec 2's code. All new modules meet the size gates (≤ 200 lines, ≤ 10
functions, ≤ 22 lines per function, ≤ 3 params; template scripts ≤ 22 lines
per function).

## 2. Workflow-based page — `dist/estimate.html`

Sections, as in the mockup:

| Section | Shows | Data |
| --- | --- | --- |
| Summary | headline range, build-up (features + overheads + contingency) | `computed.price` |
| By system | systems and their workflows, feature counts | `requirements.json` systems/workflows |
| Workflows & features | workflow diagrams; each feature on the steps it serves; hover/pin connections | `requirements.json` workflows + features, `computed.features` |
| Milestones | per milestone: features it finishes, range = its share of build × project range | `computed.features[].milestone`, `computed.price` |
| Assumptions & exclusions | assumptions; BA `scope.out` then `exclusions` | `inputs.assumptions`, `requirements.scope.out`, `inputs.exclusions` |
| Method | context factors, overheads, contingency, range, hours cross-check | `computed.price`, `computed.components` |

The header carries the Workflow-based | Component-based tab (both links
relative, same folder). The mockup banner is removed. Sentences the mockup
marked internal stay (E8); the `internal` class is dropped from the template.

## 3. Component-based page — `dist/estimate-components.html`

Spec 2's score-review template rendered read-only:

- no editing controls, no feedback box, no "copy feedback";
- Summary, Milestones, Assumptions & exclusions and Method sections added
  above/below the cards, as the mockup's `build-score.py` does;
- Scoring | Effort toggle; Effort shows each component's tasks and hours
  (`computed.components[].hours/low/high/tasks`);
- C2/C3 links per E4;
- "download xlsx" button (§4).

## 4. Workbook export

Classic's export lives inside `classic/assets/estimate-template.html` and reads
the global `DATA` (`inputs.features[]`, `inputs.contextLevels`). To reuse it
without a copy:

1. Extract the export script block (workbook bytes, tab builders, download
   handler) into `shared/assets/xlsx-export.js`; the classic template inlines
   it through the same build path it uses today. Classic `xlsx-export.test.mjs`
   and `browser.test.mjs` pass unchanged — that is the behaviour check.
2. The export reads its rows from a function argument or a global the page
   sets, instead of reaching into `DATA.inputs` directly — the one seam the
   extraction adds. Classic passes `DATA.inputs` as before.
3. `xlsx-rows.mjs` converts workflow data to classic-shaped features:

| Classic field the export reads | Workflow source |
| --- | --- |
| `name` | `requirements.json` feature name |
| `scores`, `scoreNote`, `scoreProvenance` | `inputs.features[]` |
| `provenance` | `featureProvenance` (spec 2: confirmed → stated, else proposed) |
| `milestone` | main builder's milestone (spec 2 `mainBuilder`) |
| `component` (Container column) | main builder's id |
| `tasks[]` `{name, category, o, m, p, confidence, assumptions}` | each component's tasks, listed once, under the first feature (in `inputs.features` order) that component builds — every component with tasks builds at least one feature, so no task is dropped; `category` = task `shape`; `o/m/p` = computed low / likely / high hours; `confidence` from the agentic baseline |

`contextLevels` passes through as is. The 30-row Ballpark limit and its
overflow note apply unchanged.

## 5. Flow — `workflow-based/FLOW.md` steps 8–11

```
8  Compute   compute.mjs → estimation.json            (spec 2)
9  Validate  validate.mjs → exit 0                     (spec 2)
10 Render    render.mjs --inputs estimation-inputs.json --out <lead>/dist
             → estimate.html, estimate-components.html; refuses on validation findings
             serve <lead>/dist with analyze-requirements/scripts/serve.mjs
11 Close     Q3 (spec 2 wording) + "Pages: <url>/estimate.html · <url>/estimate-components.html"
             change → edit → 8–10 again → ask again
```

`ARCHITECTURE.md` is required (spec 2 D3), so the viewer's `dist/` normally
exists. If `dist/index.html` is missing, render still writes both pages and
prints one line: "Architecture viewer not found in dist/ — C2/C3 links will
not open until it is rendered."

## 6. Validation additions

| # | Rule |
| --- | --- |
| W12 | `exclusions`, when present, is an array of non-empty strings. |
| W13 | `render.mjs` re-runs spec 2's validation and exits 1 on findings (as classic). |

## 7. Testing

- `render.test.mjs`: sin-kowa-mini fixture → both files written; each embeds
  the expected data; banner absent; tab links relative; exclusions list =
  `scope.out` + `exclusions` in order; missing `dist/index.html` → warning line.
- `xlsx-rows.test.mjs`: main builder → milestone and Container; each task
  appears once, under the first feature its component builds; hours map to `o/m/p`.
- Browser tests (skip without Chrome): Workflow-based page renders with no
  console errors; Component-based page has no edit controls; xlsx download
  from the Component-based page produces the 4 tabs with the fixture's
  features and untouched formulas (reusing classic's zip reader).
- Classic suite passes with the same count before and after the extraction.
- Quality gates: new modules and both templates.
- Eval: extend spec 2's `workflow-happy-path` case — assert both pages exist in
  `dist/` and the closing message names both.

## 8. Out of scope

- `estimation.md`, viewer companion tab, client copy, redaction (E1, E2).
- Proposal, currency, milestone wording → spec 4.
- Any classic behaviour change; the export extraction is a move, checked by
  classic's own tests.

## Deviations recorded during planning

- Module names: `page-view.mjs`, `page-html.mjs`, `pair-findings.mjs`,
  `build-workflow-template.mjs`, `build-components-template.mjs` replace the
  indicative `page-workflow.mjs` / `page-components.mjs` of §1.
- `render.mjs` takes `--inputs` and `--json` (it re-validates both, W13).
- `computed` gains per-task `low`/`high` hours so the Effort side and the
  workbook show a range without re-deriving baselines.
- Spec 2's score review linked C3 only for a container named "Backend API"
  and to `architecture.html`; links now come from the roster and point at
  `index.html`, and the review page is written into `dist/` too.
- Two classic tests change one line each (the slot list; where the workbook
  bytes are read). Behaviour tests are untouched.
- `shared/assets/xlsx-export.js` is a moved template script (351 lines); only
  the per-function template gate applies to it, not the module line/function
  caps (a split would break E6).
- §2's "the `internal` class is dropped" is done by removing `body.client`
  instead; `.internal` elements are therefore always visible.
- Implementation notes: none of the plan's `rep()` strings needed changes,
  and no test assertion was changed during implementation.

## Change after user test (2026-10-07)

- **SYSTEM / MODULE column, workflow mode only.** The Component-based page's
  workbook has a SYSTEM / MODULE column before FEATURE / WORK ITEM on the
  Ballpark tab: system name in A, feature in B, scores C-G, the template's
  formulas H-N, our MILESTONE / CONTAINER / WHY THIS TIER in O-Q. The
  Roll-up's links follow the shift (C6 → `'Ballpark Estimator'!$J$37`).
  Classic's workbook is unchanged, byte for byte.
- **Row order = the pages' order.** Systems in `requirements.json` order,
  each system's features in its own `features` order; features in no system
  go last, in `inputs.features` order, with SYSTEM / MODULE blank. This
  replaces the milestone sort of §4. Tasks keep their owner rule.
- **Template.** `workflow-based/assets/estimator-system.xlsx` is committed: it
  is Estimator_v2 (the export's `XLSX_TEMPLATE`) with the column inserted by
  LibreOffice, so every formula, merge and validation shifts with it; the
  title, subtitle and note rows span A:N, A and B stay frozen. Rebuild with
  `/usr/bin/python3 workflow-based/scripts/build-xlsx-template.py` (build time
  only; needs `soffice` and the system Python's `uno`).
  `estimator-system.test.mjs` checks the committed file and, when LibreOffice
  is there, that a rebuild reproduces it.
- **Export seam.** `XLSX_SOURCE.template()` (the base64 workbook) and
  `XLSX_SOURCE.system(row)` are optional; the column positions live in one
  `XLSX_LAYOUTS` table. Without them the export is exactly classic's.
- **Reminder after download.** On the Component-based page, *download xlsx*
  starts the download and opens an in-page dialog: review the Project Roll-up
  tab (context levels, work outside features, contingency) before using the
  workbook's price. One button, "Got it".
- **Project, assumptions and exclusions in the workbook** (workflow only, via
  the optional `XLSX_SOURCE.register()`). The project name fills the value
  cell beside Ballpark's Project label (C3); Client, Prepared by, Date and
  Version stay blank. Roll-up section 7 (B61:B67, 7 slots) takes the pages'
  assumptions and section 8 (B70:B78, 9 slots) their exclusions (BA
  `scope.out`, then `inputs.exclusions`), replacing Estimator_v2's sample
  text; unused slots are emptied. No rows are inserted: with more items than
  slots, the last slot reads "Also: …" with the rest joined by "; ".
