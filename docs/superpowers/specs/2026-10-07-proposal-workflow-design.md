# Proposal workflow mode — Systems & Workflows page, PDF and DOCX (spec 4 of 4)

Date: 2026-10-07 · Plugin: solution-architect · Skill: proposal
Series: 1 business-analyst scope mode (done) · 2 estimate data, linking, score
review (done) · 3 Workflow-based + Component-based pages (done, `745a116`) ·
**4 this**. Each spec squash-merges into `feat/workflow-based-estimator`; that
branch merges to `main` when all 4 are done.
Design reference: `docs/mockups/estimate-workflow-mode/proposal-mockup.html`
(built by `build-proposal.py` from `proposal.body.html`), and the proposal sent
to Sin Kowa (Systems & Workflows format).

## Summary

The proposal skill today writes a nine-section `proposal.md` and renders it.
For a workflow-mode lead it now builds the format that was sent to Sin Kowa —
scope, one section per system with its workflow diagrams and feature table,
milestones, assumptions & exclusions, cost — straight from data. The agent
writes only the sentences, in `proposal-inputs.json`. The page has two
buttons: Download PDF and Download DOCX. Nobody reads or edits a markdown
file; the human reads the page, asks for changes in chat, and takes the DOCX
into Google Docs before sending.

```
requirements.json  ─┐  systems, workflows, features ("does"), scope.out
estimation.json    ─┼─► render.mjs ─► <lead>/dist/proposal.html
proposal-inputs.json┘  sentences      ├─ [Download PDF]  browser print → Save as PDF
  (agent)                             └─ [Download DOCX] Word file, diagrams as PNG
```

Classic leads keep today's flow, unchanged.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| P1 | Prices stay USD. No currency conversion and no currency label work. The team changes the currency by hand in the sent copy (Docs/Word), never in a skill file. | User choice: the engine is USD-calibrated; the sent SGD figure was a manual decision. |
| P2 | No `proposal.md` in workflow mode. The page is built from data plus `proposal-inputs.json`; the human reviews the HTML page. | User: the human never touches proposal.md, only the page. A middle file nobody reads is overhead. |
| P3 | Facts come from data only: systems, workflows, features and their "does", milestone contents, assumptions, exclusions, price. The agent writes sentences only. | Names and numbers cannot drift from the BA package and the estimate; the money check becomes structural. |
| P4 | Download PDF = `window.print()` with a print stylesheet. Download DOCX = a Word file built in the page, no library, reusing the zip writer of the estimate's xlsx export. | User choice A; no new dependency, the same zip code is already tested. |
| P5 | The page shows no feature IDs, scores, components, per-milestone prices, rates or durations. | The sent proposal had none; same rule as classic hard rule 3. |
| P6 | Milestones get client names in `proposal-inputs.json` (`M1 - Walking skeleton` → `Digitise core records`), numbered by order. | Engineer milestone wording must not reach the client. |
| P7 | No About-firm, Next-steps or valid-until sections. The byline carries date and firm name (firm profile). | The sent proposal had none; the team adds them in Docs. |
| P8 | Mode is read from `estimation.json` → `inputs.scopeMode`. `workflow` → this flow; absent or `classic` → today's flow. | Same switch the estimate uses; no new question. |

## 1. Files

```
proposal/
  SKILL.md                                 routes by mode; workflow flow (§5)
  references/workflow.md                   NEW  inputs contract, sentence rules, flow
  references/review.md                     gains a workflow-mode charter (§6)
  assets/proposal-workflow.html            NEW  page template, from proposal.body.html + reading.css
  assets/docx-export.js                    NEW  page data → document.xml + images → .docx bytes
  scripts/render.mjs                       routes by mode; workflow → render-workflow
  scripts/validate.mjs                     routes by mode; workflow takes --inputs
  scripts/lib/workflow-view.mjs            NEW  requirements + estimation + inputs → page data
  scripts/lib/workflow-checks.mjs          NEW  W-checks (§4)
  scripts/lib/render-workflow.mjs          NEW  fills the template slots
estimate/shared/assets/zip.js              NEW  zip writer moved out of xlsx-export.js (crc32, store, end record)
estimate/shared/assets/xlsx-export.js      inlines zip.js; behaviour unchanged
```

Names under `scripts/lib/` are indicative; the plan fixes them against the
code. New modules meet the size gates (≤ 200 lines, ≤ 10 functions, ≤ 22
lines per function, ≤ 3 params; template scripts ≤ 22 lines per function).
`workflow-view.mjs` reuses estimate `page-view.mjs` (`priceView`,
`milestoneView`, `registerView`) and `requirements.mjs` (`loadPair`) instead
of re-deriving.

## 2. Page — `dist/proposal.html`

Sections, as in the mockup:

| Section | Shows | Source |
| --- | --- | --- |
| Title, byline | `<title> — Systems & Workflows Proposal`; date · firm | inputs `title`, `date`; firm profile `firm` |
| Scope | intro; table System \| `mapLabel`; "explicitly excluded" line | inputs `scopeIntro`; requirements `systems[].name/map`, `mapLabel`, `scope.out` |
| System 1..N | purpose, optional extra sentence, workflow diagrams (main + sub), table Feature \| What it does | requirements `systems`, `workflows`, `features[].name/does`; inputs `systems[<id>]` |
| Milestones | Milestone \| Includes \| What it demonstrates | estimate `milestoneView` (features by main builder); inputs `milestones[<id>]` |
| Assumptions & exclusions | assumptions; BA `scope.out` then `exclusions` | estimate `registerView` |
| Cost estimate | range and single number, USD | estimate `priceView` (`presentLow/High`, `singleNumber`) |

When a `mapLabel` is absent, the Scope table has one column. Items the PO
declined in the BA review page (business-analyst 0.4.0, `leftOut`) are not in
`systems`/`features`, so they never show; their names reach the exclusions
through `scope.out`.
Diagrams use the mermaid bundle as classic does (`--mermaid-bundle`).

## 3. `proposal-inputs.json`

```jsonc
{
  "client": "Sin Kowa",
  "title": "Sin Kowa Digital Transformation",
  "date": "2026-10-07",                       // ISO; byline shows "Oct 7, 2026"
  "techLevel": "non-tech",                    // non-tech | low-tech | technical
  "jargonAllow": [],                          // optional, as classic jargon_allow
  "scopeIntro": "This proposal covers four systems for Phase 1 …",
  "systems": { "SYS-004": "The single highest-value piece of the build …" },   // optional per system
  "milestones": {
    "M1 - Walking skeleton": { "name": "Digitise core records", "demonstrates": "Paper packing lists replaced …" }
  }
}
```

Lives beside `estimation.json`. The agent writes it from the interview
(client, title, tech level; firm profile as classic §3) and from the data
(milestone names and what each demonstrates).

## 4. Validation — `validate.mjs --estimation <e> --inputs <i>`

The facts are rendered from data, so the checks look at the agent's
sentences (`scopeIntro`, `systems.*`, `milestones.*.name/demonstrates`):

| # | Rule |
| --- | --- |
| W1 | Inputs complete: `client`, `title`, ISO `date`, `techLevel` in the three values, non-empty `scopeIntro`. |
| W2 | Every milestone a feature uses has `name` and `demonstrates`; no unknown milestone key; no unknown system key. |
| W3 | No money in sentences: a currency sign or code next to a number (`$40k`, `USD 5,000`, `SGD 150,000`, `5,000 dollars`) is refused. |
| W4 | No IDs in sentences (`FEAT-`, `FR-`, `SYS-`, `WF-`, `BR-`, `ASM-` followed by digits). |
| W5 | `non-tech`: the existing jargon list applies to the sentences, minus `jargonAllow`. |
| W6 | The estimate is priced (existing `deriveFigures` refusal) and passes the estimate's own validation; `requirements.json` resolves and has `scopeMode: "workflow"`. |

`render.mjs` re-runs the same checks and refuses on any finding (classic hard
rule 4).

## 5. Flow — workflow mode (SKILL.md, `references/workflow.md`)

```
1 Gate      estimation.json with scopeMode workflow + its requirements.json, estimate validation clean; else stop, name the estimate skill
2 Interview client, title, tech level; firm profile (classic §3); milestone client names
3 Write     proposal-inputs.json (sentences only)
4 Validate  validate.mjs --estimation … --inputs … → fix → again until clean
5 Review    fresh-eyes subagent on the page text (§6)
6 Render    render.mjs --estimation … --inputs … --mermaid-bundle … --out <lead>/dist → proposal.html; serve; URL
7 Human     reads the page; changes in chat → edit inputs → 4–6 again
```

The closing message tells the user: the page has Download PDF and Download
DOCX; prices are USD; change currency and add firm/next-steps sections in
the sent copy.

## 6. Fresh-eyes review — workflow charter

Same charter items 1, 3, 4, 5 as classic, read against the page text (the
rendered HTML stripped to text) plus `estimation.json` and the tech level.
Item 2 becomes: "does the Scope section say what we build, and the Cost
section what it costs?" Loop bound unchanged.

## 7. Downloads

**PDF.** The button calls `window.print()`. Print CSS hides the menu, theme
toggle and buttons, starts each system on a new page, keeps tables and
diagrams from splitting, prints in light colours.

**DOCX.** `assets/docx-export.js`, inlined in the page:

1. Reads the same page data the page renders from (not the DOM text).
2. Writes `word/document.xml`: Title, Heading 1/2, paragraphs, tables with a
   header row, bullet lists; built-in Word styles only.
3. Each drawn mermaid SVG → canvas → PNG → `word/media/imageN.png`, placed
   where the diagram sits, scaled to page width.
4. Zips `[Content_Types].xml`, `_rels/.rels`, `word/_rels/document.xml.rels`,
   `word/styles.xml`, `word/numbering.xml`, `document.xml` and media with the
   shared `zip.js`; downloads `<client>-proposal.docx`.

The DOCX is plainer than the page (standard Word look); content and order
are the same.

## 8. Testing

- `workflow-view.test.mjs`: fixture → page data: systems in BA order, features
  with `does`, no IDs in any shown string, milestones numbered with client
  names, register = assumptions; `scope.out` + `exclusions`; price = estimate's
  `presentLow/High/singleNumber`.
- `workflow-checks.test.mjs`: one failing case per W1–W6, the fixture passes.
- `docx-export.test.mjs` (Node, page data in, bytes out): unzip → required
  parts present; `document.xml` has one heading per section and system, one
  table per system plus milestones; no `undefined`, no IDs; XML well-formed.
- `zip.js` move: estimate xlsx tests and browser tests pass unchanged.
- Browser test (skips without Chrome): page renders with no console errors;
  Download DOCX gives a zip with one PNG per diagram; print media hides the
  buttons.
- Classic proposal suite passes with the same count before and after.
- Eval: one plugin-level case `proposal-workflow-happy-path` on a workflow
  fixture lead.
- Quality gates: new modules and the template script.

## 9. Out of scope

- Currency conversion or labels (P1).
- `proposal.md` in workflow mode, About/Next steps/valid-until sections (P2, P7).
- Per-milestone prices, timeline, staffing (P5).
- Any classic proposal behaviour change.
- Hosting/run-cost figures (separate planned feature).

## Deviations recorded during planning

- **Zip writer** lives at `estimate/shared/lib/zip.mjs` (ESM, so Node tests
  import it), not `shared/assets/zip.js`. `inline.mjs` gains `withZip(src)`,
  which inlines it ahead of a page script; classic and workflow estimate
  renders call it for the xlsx export.
- **DOCX code** is three ESM modules under `proposal/scripts/lib/`
  (`docx-xml.mjs`, `docx-body.mjs`, `docx-package.mjs` → `buildDocx(view,
  images)`), inlined into the page with import lines stripped, instead of one
  `assets/docx-export.js`. The PNG step (SVG → canvas) stays in the template
  script, the only browser-only part. Mermaid runs with `htmlLabels: false`,
  because a canvas refuses to export a drawing with HTML labels.
- **Module names:** `workflow-lead.mjs` (load + W6), `workflow-checks.mjs`
  (W1–W5), `workflow-view.mjs` (page data), `workflow-html.mjs` (body and menu,
  rendered in Node), `workflow-page.mjs` (template slots), `workflow-cli.mjs`
  (validate/render routes) replace the indicative names of §1.
- **Inputs gain `firm`** (copied from the firm profile; only the name is
  asked when there is no profile). W1 requires it.
- **Review runs after render** (spec §5 had it before): the fresh-eyes
  subagent reads `dist/proposal.html`, the text the client will read.
- **No theme toggle**: the page is light only, so the print-CSS line about a
  toggle does not apply.
- **Eval case** is `plugins/solution-architect/evals/proposal-workflow/`; its
  lead is committed under `proposal/evals/fixtures/workflow-sin-kowa-mini/`
  and pinned by `evals-fixtures.test.mjs`.
- **Known flake, not fixed here:** the spec 3 test "opening a system switches
  the cards to that system" (estimate `workflow-based/scripts/test/browser.test.mjs`)
  fails intermittently at the base commit; longer waits do not fix it.
