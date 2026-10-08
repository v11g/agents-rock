# BA review page, read-only — design

Replaces the decision page of `2026-10-07-ba-review-page-design.md`
(cards, Copy decisions, `review apply`). Branch `feat/ba-review-page`,
business-analyst 0.4.0, not yet merged. Approved mockup:
`~/Downloads/review-mockup.html`, minus its scope table, milestones and
exclusions sections.

## Why

The PO testing 0.4.0 on the Sin Kowa proposal found the page asked again
what the docx and the interview had already settled. The agent drew
workflows the docx never drew, pinned docx features onto them, and a "No"
on a drawn workflow dropped a decided feature. The PO wants the page to read
like the document they wrote, with only what the interview added marked.

## Rules

- **R1 — Shape.** `review.mjs page` writes one static HTML file in the
  shape of the input document: title, date, a one-line count; per system
  its name, purpose, a drawing of each to-be workflow it owns (steps, side
  branches, loops back, the sub-flow note) and a feature table (Feature |
  What it does); then the assumptions that are not `resolved`. Nothing
  else: no scope table, milestones, exclusions or open questions. No
  script, no buttons, no inputs, nothing to copy back.
- **R2 — Decided only.** Every system, to-be workflow and feature must be
  `confirmed` before the page is drawn. Otherwise `page` exits 1 with one
  line per item, systems then workflows then features:
  `FEAT-004: not decided; ask the PO in the interview`.
- **R3 — No ids.** Unchanged: every text the page shows is checked; one
  line per field that names an id, and nothing is written.
- **R4 — New since the document.** A feature or assumption whose `source`
  starts with `PO in interview` is drawn with a "★ New" tag and an
  `Added: <source>` line. Assumptions gain an optional `source`.
- **R5 — Nothing drafted.** The agent never drafts systems, workflows or
  features. Workflows come only from the input (a diagram or listed
  steps). A system the input gives no steps for has no workflow, and its
  features have `steps: []`. The validator stops requiring a workflow per
  system and a step per feature.
- **R6 — Interview options.** The agent recommends no option: no
  "(Recommended)", no option placed first as its pick. The options are
  real answers (when the input suggests them), one or more assumptions,
  and "Leave <thing> out of scope". There is no "Don't know" option. An
  assumption option starts with "Assume" and states its boundary ("Assume
  under 1 hour offline; longer is a change request"). An option that
  rests on the input cites its input quote: file, place, exact words
  (`SinKowaProposal.docx, System 4: "dead spots inside the warehouse"`).
  An option with no input quote cites nothing. (Amended 2026-10-08: the
  "no hint in the input" text is gone.)

  The pick decides the outcome:
  - A real answer, or one typed through "Other", updates the item
    (`confirmed`).
  - An "Assume …" option records an ASM row with status `accepted`
    (the PO decided it, so it never blocks `READY_FOR_ARCHITECTURE`) and
    source `PO in interview, <date>`, shown ★ New on the page.
  - "Leave … out of scope" puts it in FR scope `out` or `scope.out`
    (Part 3).

  A typed "don't know" is asked once more with the same options, and the
  agent says the PO must pick an assumption or leave it out. Every asked
  question closes. Only gaps never asked (P3) stay in the open-questions
  register, which the json and md show and the page never does.

  The scope-mode question (interview §7) follows the same rule. No option
  is marked as the agent's pick; the options say what each mode gives
  ("Workflow: systems, their steps and features" / "Classic: one flat list
  of requirements"), and the question text names the cues seen.
- **R7 — No review record.** `review` on items and questions, the
  `leftOut` list, `review apply`, the held-back guard ("No, keep them") and
  the decisions script are removed. A change the PO asks for in chat is a
  re-run: edit the JSON, re-run `scope`, validate, and build the page
  again.
- **R8 — Twins.** `review.py` writes the same bytes and the same refusals
  as `review.mjs`. The module gates (≤200 lines, ≤10 functions, ≤22
  lines per function, ≤3 params) hold.

- **R9 — Downstream pages.** The estimate and proposal pages draw a
  system with no workflow and a feature with `steps: []` without error.
  The branch is rebased on `6d8cd35`. Only the Workflow-based estimate
  page needs a fix: its `s.main.missing` throws on `main: null`. Its
  system card says "workflow from the PO's document" or "no workflow in
  the PO's document", never "workflow suggested by us". The Component-based
  page, the score review and the proposal page with its DOCX get
  regression tests. solution-architect keeps 3.0.1, because it bumps only
  in release commits.

- **R10 — Branches under their step.** (Added 2026-10-08; tree layout
  2026-10-08.) Branches form a tree under each main step: a step's
  children are the branches that leave it, a side branch's children are
  the branches that leave its box, and a loop back is a leaf. Children
  keep the JSON order. Siblings sit side by side, one level below their
  parent, starting at the parent's first column; a parent spans its
  children (a node is as wide as its leaf count, or 1). Each main step
  owns a lane that wide, with one arrow column between lanes. Every
  branch is drawn once, so a cycle never loops; a branch no step reaches
  sits under the first step. Each branch has a down connector: line, its
  label inside the connector (wrapping in its column, never overlapping a
  neighbour), arrowhead, then the branch box. A loop back's box reads
  "↺ back to <step>". No "↳ from <step>" text. Still static HTML and
  CSS, no script.
- **R11 — Labels are copied.** (Added 2026-10-08.) A branch `label` is
  the input's own arrow text, copied. An arrow with no text has no label;
  the agent never writes one.
- **R12 — The input's assumptions stay.** (Added 2026-10-08.) Every
  assumption the input lists is an ASM row, word for word, in the
  input's order, with `source` naming the file, even when it reads like a
  constraint. A vague one is asked in the interview. The PO's answer adds
  a new ★ New assumption; the input's row keeps its words and its status
  becomes `accepted`. A question about an input assumption adds the
  option "Drop this assumption"; picking it sets that row's status to
  `resolved`, and only then does it leave the page.
- **R13 — Assumption boundaries.** (Added 2026-10-08.) An "Assume …"
  option's boundary is a scale and a limit ("hours offline: under 1").
  The limit comes from the input quote first, else the usual value for
  that kind of business, else the smallest scope still safe to price.
  Past the limit is a change request.

- **R14 — Approval question.** (Added 2026-10-08.) Once the page is
  shown, the agent asks one question through the host's question tool:
  "Does the review page read like your document?" with two options,
  "Approve: go on to requirements.md and the readiness report" and
  "Change something: say what in Other". Neither is marked as the
  agent's pick. Approve → step 11. A change → re-run, rebuild the page,
  ask again. No question tool → ask it in plain text and stop.

- **R15 — Handoff line.** (Added 2026-10-08.) After Part 5, in both
  modes, the agent ends with one line telling the PO to send
  requirements.md and requirements.json to the engineering team for the
  estimate. On claude.ai both files are presented; in Claude Code their
  paths are given.

- **R16 — One diagram style across phases.** (Added 2026-10-08.) The
  review page's diagrams use the estimate page's style: grey panel,
  square white boxes, thin grey arrows, solid for the main flow and
  dotted for a branch, the PO's label on the branch line. The page
  around them follows the proposal page: teal headings, "System N:" in
  grey with the name in teal, a "Main workflow · X" or "Sub-workflow ·
  X" caption above the panel, tables with small uppercase headers and
  row lines only. No sidebar. Dark mode and ★ New stay.

## Out of scope

- Exclusions and milestones on the page.
