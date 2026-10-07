# estimate — workflow mode

You are here because `requirements.json#scopeMode` is `"workflow"`. The
business-analyst package already holds the systems, to-be workflows and
features the PO confirmed. Your job: price those features, link each to
the components that build it, and get an engineer's scores.

Paths below are relative to this folder (`estimate/workflow-based/`);
run the scripts from here.

## Hard rules

1. Features carry ids and scores only. Names, systems and steps come from
   `requirements.json`; never copy them into `estimation-inputs.json`.
2. Components carry the work: `builds[{ feature, why }]`, `milestone`,
   agentic `tasks`. A feature's milestone is derived, never written.
3. Agent judges, script computes: every number comes from
   `scripts/compute.mjs`. `scripts/validate.mjs` must exit 0.
4. This mode is agentic + STANDARD. Do not ask about depth or delivery.
5. Three questions, no more: the architecture gate, the score review, and
   the closing "anything to change?".

## Flow

1. **Gates.** Stop with the message if any fails. A stop is the message and
   one line on what passed: no other questions, no offer to run classic
   instead, no review of the documents.
   - no `ARCHITECTURE.md` in the lead folder → "Workflow mode needs the
     architecture document. Run it first."
   - the `Workflow` tool is not in your tool list → "Workflow mode needs
     dynamic workflows for the link review. Turn them on in /config
     (Dynamic workflows), then run /estimate again."
   - **Q1** (AskUserQuestion): "Components come from ARCHITECTURE.md §6.
     Has a human reviewed that document?" — no → stop.
2. **Setup.** Write `scopeMode: "workflow"`, `requirements` (relative path
   to the package), `deliveryMode: "agentic"`, `depth: "STANDARD"`,
   `agentContext: { agent, model }` from the session you are running in,
   `project` = the lead name. Write `assumptions` from the package's ASM-
   and Q- items (`source` = that id); anything you add gets `source: "new"`.
3. **Link.** Read `references/linking.md` (core rubric). For every feature,
   write `components[].builds` with a `why` per link. Components are §6
   rows; `parent` = their container; a container with no components may
   build features itself.
4. **Review.** Run `/solution-architect:review-links` with
   `args = { inputs, architecture, requirements, linking }` (absolute
   paths). Apply the returned findings (add/drop links, fix tasks named
   under "task"). One cycle; do not re-run.
5. **Score.** Five scores per feature with a cite each, plus `scoreNote`
   and `scoreProvenance: "proposed"` (`../classic/references/scoring-guide.md`
   anchors verbatim). Context factors: derive four as the classic interview
   does (`../classic/references/interview.md` §4); `stackFamiliarity` is level 1
   with cite "not assessed — adjust in the exported workbook".
6. **Score review (Q2).** `node scripts/score-review.mjs --write
   estimation-inputs.json --out <lead>/dist/score-review.html`, serve it with the
   analyze-requirements `serve.mjs`, give the URL. It sits beside the
   architecture viewer so its C2/C3 links open. When the engineer pastes
   the feedback block: save it, `node scripts/score-review.mjs --read
   feedback.json --inputs estimation-inputs.json`, apply `features`,
   `components`; for each `needsReason` entry ask once in chat why; for
   each `asks` entry propose a component from §6 (or a new one, marked
   proposed) and redo steps 3–4 for that feature only. A component left
   building nothing gets `notEstimated` with a reason.
7. **Tasks.** For every component that builds something: agentic tasks
   (`shape` from `../classic/references/task-shapes.md`, `scope`,
   `seedMinutes`), and a `milestone` ("M1 - <name>", ordered). Components
   that build nothing get `notEstimated` with a reason. Write
   `exclusions` — the commercial items the price leaves out that the BA scope
   does not name (hosting and subscriptions, post-launch support, security
   testing, hardware), one sentence each.
8. **Compute.** `node scripts/compute.mjs --inputs estimation-inputs.json --out estimation.json`
9. **Validate.** `node scripts/validate.mjs --inputs estimation-inputs.json --json estimation.json` → exit 0.
10. **Render + serve.** `node scripts/render.mjs --inputs estimation-inputs.json
    --json estimation.json --out <lead>/dist` writes `estimate.html`
    (Workflow-based) and `estimate-components.html` (Component-based, with
    the xlsx download) beside the architecture viewer; it re-runs
    validation and refuses on findings. Serve `<lead>/dist` with the
    analyze-requirements `serve.mjs`.
11. **Close (Q3).** AskUserQuestion: "Estimate ready: <presented range>.
    <n> features, <m> components, milestones <list>. Assumptions: <k> (<j>
    from the BA package, <k−j> new). Pages: <url>/estimate.html ·
    <url>/estimate-components.html. Anything to change?" Options: Done ·
    Change a score or a link · Add a component · Open the review page again.
    A change → edit → steps 8–10 → ask again. Both pages are internal; the
    client gets the proposal.

## Not asked, and why

Depth, delivery mode, agent/model, scope confirm, milestones, review
channel, task approval, stack familiarity, deadline/budget, show pricing
working: each is fixed, derived, PO-confirmed already, or shown in Q3.
See the spec's §2 table.
