# Estimate workflow mode — data, linking and score review (spec 2 of 4)

Date: 2026-10-06 · Plugin: solution-architect · Skill: estimate
Series: 1 business-analyst scope mode (done) · **2 this** · 3 Workflow-based +
Component-based pages · 4 proposal format. Each spec squash-merges into
`feat/workflow-based-estimator`; that branch merges to `main` when all 4 are done.

## Summary

Spec 1 made the business-analyst skill write systems, to-be workflows and
features (`scopeMode: "workflow"`). This spec makes the estimate skill price
those features and show, for each one, the components engineers must build.

```
requirements.json (BA, spec 1)      estimate, workflow mode (this spec)
  systems / workflows / features ─► 1 gate: ARCHITECTURE.md exists + human reviewed
                                    2 link: feature → components (rubric)      ← agent
                                    3 review: plugin workflow Review → Verify  ← fresh agents
                                    4 score: 5 scores per feature              ← agent
                                    5 score review page (HTML)                 ← engineer
                                    6 tasks per component (agentic)            ← agent
                                    7 compute → estimation.json
                                    8 validate → "anything to change?"
                                    — pages + estimation.md: spec 3
```

Classic mode (today's skill) is untouched in behaviour; it moves into a
`classic/` folder.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | `estimate/SKILL.md` becomes a router: it reads `scopeMode` from `requirements.json` and follows `classic/FLOW.md` or `workflow-based/FLOW.md`. Absent file or `classic` → classic. | One `/estimate` command; the mode is a fact of the lead, not a user choice. |
| D2 | Folder split: `classic/`, `workflow-based/`, `shared/`. Classic is **moved as-is** first, with every test still green, before any new code. | Two flows, two folders; shared pricing lives once. |
| D3 | Workflow mode requires `ARCHITECTURE.md` and asks "reviewed by a human?" (n → stop). | Components come only from §6; a bad §6 gives bad links. |
| D4 | Workflow mode is **agentic + STANDARD only**. Traditional, QUICK and DEEP stop with a message. Agentic gains feature scores and context factors in this mode. | Agentic is the house default; DEEP differs from STANDARD only in prose; scores are what price. |
| D5 | Features carry **ids + scores only**. Names, systems, steps and labels are read from `requirements.json` (path in `requirements`). | No copies to drift after a BA re-run. |
| D6 | Components carry `builds[{feature, why}]`, `tasks`, `milestone`. A feature's milestone is derived from its **main builder** (fewest `builds`; earliest milestone on a tie). | Engineers plan by component; the mockup already does this. |
| D7 | Score review is **HTML only**; the page is built from the approved mockup. | Link edits and "ask to add" do not fit CSV or terminal. |
| D8 | Exactly **3 human questions**: arch reviewed? · score review page (+ "why" per moved score) · "anything to change?" (AskUserQuestion). | Everything else is derived or already PO-confirmed (see §2). |
| D9 | Linking uses the **core rubric v4** (8 questions) only. Project-type add-ons are **not** agent input; they ship as a human reference. | Tested: core alone 13 mistakes vs 33 with add-ons; add-ons produced 0 surviving adds in 36 features. |
| D10 | Link + task review runs as a **plugin workflow** `review-links` (Review → Verify), one cycle. If dynamic workflows are unavailable, stop with a message. No subagent fallback. | Verify rejected 6/6 bad adds in test; estimate skill is Claude Code only. |
| D11 | Tasks are written **after** the score review, on components, not asked; the human changes them at the closing question. | Review may change components; hours must not steer scores. |
| D12 | Stack familiarity is fixed at level 1 with cite "not assessed — adjust in the exported workbook"; "show pricing working" defaults to no. Agent + model are taken from the session. | User choice: keep it simple; the workbook handles familiarity. |
| D13 | Pages, `estimation.md`, workbook export → spec 3. In workflow mode `render.mjs` exits 2 with "pages come in spec 3". | Scope split agreed. |

## 1. Folder layout and the move

```
plugins/solution-architect/
  workflows/
    review-links.js                NEW  plugin workflow (D10) → /solution-architect:review-links
  skills/estimate/
    SKILL.md                       router (D1); frontmatter unchanged
    README.md
    classic/                       MOVED: today's skill, byte-identical where possible
      FLOW.md                      today's SKILL.md body (steps 1–9), minus frontmatter
      references/  scripts/  assets/   (as today)
    shared/                        MOVED out of classic, used by both flows
      lib/   pricing.mjs  project-price.mjs  scoring.mjs  context-schema.mjs
             baselines.mjs  measurements.mjs  estimate-math.mjs
             agentic-task-schema.mjs   (checkAgenticTask extracted from classic schema.mjs)
      (references stay in `classic/references`; `shared/lib/scoring.mjs` reads the guide from there)
    workflow-based/                NEW
      FLOW.md
      references/
        linking.md                 core rubric v4 + task rubric (§4)
        hidden-work-by-type.md     the 6 researched add-ons, human reference only (D9);
                                   source: docs/research/2026-10-06-linking-rubric/addons/
      scripts/
        compute.mjs  validate.mjs  score-review.mjs  render.mjs (stub, D13)
        lib/
          schema.mjs               workflow input checks (§6)
          rollup.mjs               minutes per component, feature milestone, price
          requirements.mjs         loads + indexes requirements.json (features, systems, workflows)
          score-html.mjs           builds the review page from the template
          score-diff.mjs           feedback → diff (scores, links, asks)
        test/
          fixtures/                sin-kowa-mini (§8)
          *.test.mjs
      assets/
        score-review.html          from docs/mockups/estimate-workflow-mode (score-review.src.html)
```

**Move rules (task 1 of the plan):**
- `git mv` only; no edits except import paths. Shared modules move to `shared/`
  and classic imports point there.
- Tests outside the skill that reach into it (`proposal/scripts/test/*.mjs`
  → `estimate/scripts/compute.mjs`, `lib/rollup.mjs`, `lib/schema.mjs`,
  `test/fixtures/booking-inputs.json`) get their paths updated.
- Root `npm test` glob is `plugins/*/skills/*/scripts/test/*.test.mjs`; it
  becomes `plugins/*/skills/*/{scripts,classic/scripts,workflow-based/scripts}/test/*.test.mjs`
  (or the plan picks an equivalent that keeps every test discovered).
- Gate: `npm test` ends with `ℹ fail 0` and the same pass count as before.

`shared/` has no `index`; each module is imported by path.

## 2. Flow — `workflow-based/FLOW.md`

```
1 Gate      requirements.json has scopeMode "workflow" (router got us here)
            ARCHITECTURE.md missing → stop: "Workflow mode needs the architecture document. Run it first."
            Workflow tool unavailable → stop: "Workflow mode needs dynamic workflows for the link
               review. Turn them on in /config (Dynamic workflows), then run /estimate again."
            Q1 (AskUserQuestion): "Components come from ARCHITECTURE.md §6. Has a human reviewed
               that document?"  no → stop
2 Setup     write deliveryMode "agentic", depth "STANDARD", agentContext {agent, model} from the
            session, repository = project. No questions.
3 Link      per feature, apply references/linking.md core rubric → components[].builds[{feature, why}]
4 Review    run /solution-architect:review-links (args: inputs, architecture, requirements paths)
            → apply confirmed findings → one cycle, no loop
5 Score     5 scores + cite + scoreNote per feature (scoring-guide); 4 context factors derived
            (specQuality, compliance, clientDecisions, codebaseMaturity); stackFamiliarity = 1 (D12)
6 Review page  score-review.mjs --write → open; Q2: engineer edits, copies feedback
            --read → apply; AskUserQuestion "why?" once per moved score (as classic interview.md)
7 Tasks     per component: agentic tasks (shape, scope, seedMinutes); milestone per component
8 Compute   compute.mjs → estimation.json
9 Validate  validate.mjs → exit 0
10 Close    Q3 (AskUserQuestion): "Estimate ready: <range>. <n> features, <m> components,
            milestones M1 …. Assumptions: <k> (from BA: j, new: k−j). Anything to change?"
              ○ Done  ○ Change a score or link  ○ Add a component  ○ Open the review page again
            change → edit → 8–9 again → ask again
```

**Not asked, and why** (each is written as an assumption or derived):

| Removed question | Replaced by |
| --- | --- |
| Depth, delivery mode | fixed (D4) |
| Agent + model, repository | from the session; `repository` = `project` |
| Scope confirm | PO confirmed the BA package; agent-added assumptions are marked `new` in Q3 |
| Milestones | proposed per component; shown in Q3 and on the cards |
| Review channel | HTML only (D7) |
| Tasks approval | fixed at Q3 (D11) |
| Stack familiarity | level 1, cite as D12 |
| Deadline / budget | removed; nothing reads it (checked: no code or template uses it) |
| Show pricing working | default no; spec 3 may re-add |

**Spec 3 note:** Q3 moves to "after serve" and names the page URL.

## 3. Data shape

`estimation-inputs.json`, workflow mode:

```jsonc
{
  "scopeMode": "workflow",
  "requirements": "../requirements.json",            // BA package; names/systems/steps read from here
  "project": "Sin Kowa", "currency": "USD",
  "deliveryMode": "agentic", "depth": "STANDARD",
  "agentContext": { "agent": "claude-code", "model": "claude-opus-5-5" },
  "contextLevels": { "codebaseMaturity": 1, "stackFamiliarity": 1, "specQuality": 3, "compliance": 2, "clientDecisions": 3 },
  "contextProvenance": { "stackFamiliarity": { "level": 1, "anchor": "<guide text>", "cite": "not assessed — adjust in the exported workbook", "source": "derived" }, … },
  "features": [
    { "id": "FEAT-007",
      "scores": { "tech": { "n": 3, "anchor": "…", "cite": "…" }, "size": …, "deps": …, "unc": …, "risk": … },
      "scoreNote": "…", "scoreProvenance": "proposed" }
  ],
  "components": [
    { "id": "api", "name": "Core API" },                                   // container (no parent)
    { "id": "api.billing", "name": "Billing", "parent": "api", "milestone": "M3 - Money",
      "builds": [ { "feature": "FEAT-007", "why": "owns invoice qty = accepted packed qty (BR-002)" } ],
      "tasks": [ { "id": "billing-match", "name": "Three-way match", "shape": "small_implementation",
                   "scope": { "affectedFiles": 6, "complexity": "medium" },
                   "seedMinutes": { "o": 60, "m": 120, "p": 240 }, "assumptions": [], "provenance": "proposed" } ] },
    { "id": "ops.db", "name": "Operations Database", "parent": "ops", "notEstimated": "schema per module; no store-specific work" }
  ],
  "risks": [], "assumptions": [ { "text": "…", "impactIfWrong": "…", "source": "ASM-005" } ]
}
```

Rules of thumb: a feature never carries `tasks`, `component`, `milestone`
or `provenance` (scope provenance = BA label: `confirmed` → stated, else
proposed, resolved at compute time). A component that builds nothing needs
`notEstimated` (today's rule). Two levels max (container → component) as
today.

`estimation.json` (`computed`) adds, per feature: `name`, `system`,
`milestone` (from main builder), `builtBy[]`, `score`, `tier`, `point`,
`priceLow/High`, `flag`; per component: `hours`, `low`, `high` (agentic
baselines fit hours, as classic does), `builds[]`; `price` block unchanged
(`shared/pricing.mjs`, `shared/project-price.mjs`).

## 4. Linking rubric — `workflow-based/references/linking.md`

### Core rubric v4 (the linker and the reviewer read this)

A feature is a business piece the client asked for. A component is a piece
engineers build, listed in ARCHITECTURE.md §6 (inside a C4 container). Link
a feature to every component that has to change or be built for that
feature to work. Answer per feature, from ARCHITECTURE.md (§5, §6, §9) and
the requirements package:

1. **Who acts? Who is told?** For each person or role who performs a step,
   link the component they use. If a person must be told something, link
   the component that delivers it.
2. **What rule? What does it read?** Link the component whose
   Responsibility owns the rule or data the feature creates or changes. If
   the feature needs data another module owns and does not expose yet, link
   that module — the new read is work inside it.
3. **No person?** A step started by a message, schedule, timer or sync →
   link the worker component that runs it.
4. **Outside?** Talks to an external system (§9) → link the integrating
   component.
5. **Store-specific work?** Link a database or object store only for work
   inside the store: a constraint enforcing a business rule, a new store or
   bucket, partitioning, retention or locking. Ordinary tables and ordinary
   file writes belong to the owning module.
6. **Why?** Every link carries a `why` naming the part of the component's
   Responsibility this feature needs. No reason → drop the link.
7. **Most specific.** Link the component, never its container, unless the
   container has no components.
8. **Used is not changed.** Login, permissions, app shell, notification
   plumbing, monitoring, routing, normalizers, CI/hosting: link only when
   this feature changes them. A component the feature's data merely flows
   through, unchanged, is not a link — even if the feature would not work
   without it.

### Task rubric (the reviewer reads this; tasks live on components)

1. **Covers its links.** Every feature a component builds has at least one
   task that serves it.
2. **No double work.** The same work does not appear in two components.
3. **Right shape.** Each task's `shape` (from `task-shapes.md`) matches the
   work described.

### Evidence (full artifacts: `docs/research/2026-10-06-linking-rubric/`)

Linker, blind-judged, 6 features per project:

| Projects | No rubric | Core v1 | Core v2 | Core v3/v4 | Core + add-on |
| --- | --- | --- | --- | --- | --- |
| 3 real leads (web/mobile) | 12 | 5 | 6 | — | — |
| 5 reference fixtures (data, LLM/RAG, API, ML, IoT) | — | — | — | 13 | 33 |

Core alone: 42 of 48 links found, 0 whole features missed; remaining
misses are hidden reads behind a dependency (Q2). Add-ons as linker input
caused over-linking; as reviewer input they produced 1 good add vs 6 bad in
36 features → not agent input (D9).

Reviewer (core v4) on core-only sets, 36 features: drops 5 good / 0 bad;
adds 1 good / 6 bad. Verifier on the 7 adds: rejected 6/6 bad, each quoting
§6; also rejected the 1 "good" add on a defensible reading (orphan
component, handled by the `notEstimated` rule instead).

## 5. Review workflow — `workflows/review-links.js`

Runs as `/solution-architect:review-links` with
`args = { inputs, architecture, requirements, linking }` (file paths).

```javascript
export const meta = {
  name: 'review-links',
  description: 'Fresh-eyes review of feature→component links and component tasks, then adversarial verify of every proposed add',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const FINDINGS = { type: 'object', required: ['findings'], properties: { findings: { type: 'array', items: {
  type: 'object', required: ['feature', 'action', 'component', 'why'],
  properties: { feature: { type: 'string' }, action: { type: 'string', enum: ['add', 'drop', 'task'] },
                component: { type: 'string' }, why: { type: 'string' } } } } } }
const VERDICT = { type: 'object', required: ['verdict', 'why'], properties: {
  verdict: { type: 'string', enum: ['ACCEPT', 'REJECT'] }, why: { type: 'string' }, quoted: { type: 'string' } } }

const read = `Read ${args.linking} (core rubric + task rubric), ${args.architecture} (§6, §9), ${args.requirements}, then ${args.inputs}.`

phase('Review')
const review = await agent(`${read}
You are a fresh-eyes reviewer of the feature→component links and the component tasks in the inputs file.
A link is right only when the feature CHANGES the component (new rule, data, event kind, constraint).
Propose "add" only when you can name the change inside that component; "drop" only when the linker's why describes use, not change;
"task" for a task-rubric breach (component → what is wrong). When unsure, leave it alone.`, { schema: FINDINGS })

phase('Verify')
const verified = await pipeline(review.findings, (f) => f.action !== 'add' ? { ...f, verdict: 'ACCEPT' }
  : agent(`Read ${args.architecture} (§6, §9) and the features in ${args.requirements}.
Proposed link: feature ${f.feature} → component "${f.component}". Proposer's why: "${f.why}".
1 Does §6 ALREADY describe the behaviour the proposal says the feature needs? If yes → REJECT.
2 Does the feature ask for this work, or is it operational scope nobody asked for? If not asked → REJECT.
3 Can you name the concrete change inside this component that §6 does not already list? If yes → ACCEPT.
Quote (≤15 words) the §6 text you relied on.`, { schema: VERDICT, phase: 'Verify', label: `${f.feature}→${f.component}` })
      .then((v) => ({ ...f, ...v })))

return verified.filter(Boolean).filter((f) => f.verdict === 'ACCEPT')
```

Drops and task findings pass without Verify (0 bad drops measured; task
findings are cheap for the agent to judge). The agent applies the returned
findings, re-runs `validate.mjs`, and does not loop.

## 6. Validation (workflow mode, `workflow-based/scripts/lib/schema.mjs`)

| # | Rule | Finding text |
| --- | --- | --- |
| W1 | `scopeMode` is `workflow`, `requirements` resolves and its `scopeMode` is `workflow` | `requirements: file not found` / `…is not in workflow mode` |
| W2 | `deliveryMode` is `agentic`, `depth` is `STANDARD` | `workflow mode is agentic + STANDARD only` |
| W3 | feature ids equal the set in `requirements.json` — none missing, none extra | `feature FEAT-009: not in requirements.json` / `requirements FEAT-012: not scored` |
| W4 | every feature has `scores` (5 factors, guide anchors), `scoreNote`, `scoreProvenance` | reuse scoring-schema messages |
| W5 | a feature carries none of `tasks`, `component`, `milestone`, `provenance` | `feature X: "tasks" belongs on components in workflow mode` |
| W6 | every feature is built by ≥ 1 component | `feature X: no component builds it` |
| W7 | every `builds[]` entry names an existing feature and has a non-empty `why` | `component C: builds FEAT-099 unknown` / `…builds X without a why` |
| W8 | a component with `builds` has `milestone` and ≥ 1 agentic task; one without has `notEstimated` | `component C: builds features but has no tasks` / today's coverage message |
| W9 | roster rules as today (ids, parent two levels) | today's messages |
| W10 | context factors: all five present; `stackFamiliarity` level 1 unless `contextProvenance.stackFamiliarity.source` is `stated` | `stackFamiliarity: level n needs a stated provenance` |
| W11 | `assumptions[].source` is a BA id (`ASM-`/`Q-`) or `new` | `assumption i: source missing` |

Agentic task checks reuse `checkAgenticTask` from `shared/lib/agentic-task-schema.mjs`.
`shared/lib/context-schema.mjs` gains a `{ required: true }` option: classic
keeps today's behaviour (skipped in agentic mode); workflow mode passes
`required` so W10 can run.

The workflow-mode gate "Workflow tool unavailable" is decided by the agent
from its own tool list (the `Workflow` tool is absent when dynamic
workflows are off); `FLOW.md` says so in words.

## 7. Score review page — `workflow-based/assets/score-review.html`

Built from `docs/mockups/estimate-workflow-mode/score-review.src.html`
(today's version, including the "open a system → Workflows filter" change),
with the data slots filled by `score-html.mjs` using the same `embed` slots
discipline as today's template and `shared/pricing.mjs` inlined for the
live tier and price.

Shows per card: feature name · system · milestone (derived) · 5 score
pickers with guide anchors · **Built by** list (container tag, component
name, `×` unlink, "also builds" chips) · "+ Link a component" · "ask the
agent to add a component" (free text) · plain-words note. Panel: Systems &
workflows (read-only, from `requirements.json`); opening a system filters
the cards. **Review & send** is locked until every feature has ≥ 1 builder
or an ask. One line beside it: "You can reopen this page later; your
changes stay in this browser."

Feedback block (the `--read` contract):

```json
{ "features":   [ { "id": "FEAT-007", "scores": { "tech": 3, … }, "scoreNote": "…", "reasons": { "risk": "…" } } ],
  "components": [ { "id": "api.billing", "implements": ["FEAT-007", "FEAT-011"] } ],
  "addComponent": [ { "feature": "FEAT-005", "note": "nothing builds AI pre-fill" } ] }
```

`score-diff.mjs` turns it into: score changes (→ new anchor, `stated`,
needs-reason list), link changes per component (→ `builds[]` with `why`
"linked by the engineer in the score review"), asks (→ agent proposes a component, re-runs step 3–4
for that feature only).

## 8. Fixtures and testing

**Fixture `sin-kowa-mini`** (`workflow-based/scripts/test/fixtures/`):
- `requirements.json` — copy of spec 1's `requirements-workflow-pass.json`
  (2 systems, 3 to-be workflows, FEAT-001..005). Copied, not imported
  across plugins; a comment names the origin.
- `ARCHITECTURE-mini.md` — §5 three containers, §6 eight components with
  Responsibility text, §9 one external.
- `inputs-pass.json` — 5 scored features, 8 components (6 building, 2
  `notEstimated`), 11 agentic tasks, `measurementsPath` → empty file.
- W-rule breaches are in-memory mutations of `inputs-pass.json` inside `schema.test.mjs` (one case per rule).
- `feedback.json` — 1 score moved, 1 link removed, 1 link added, 1 ask.

**Tests** (`node --test`, same three layers as classic):
1. Unit: every W-rule fails on `inputs-fail` and passes on `inputs-pass`;
   rollup: minutes per component, feature milestone from main builder
   (tie → earliest), price equals `shared` pricing on the same scores.
2. Round trip: `score-review.mjs --write` produces a page whose embedded
   data equals the inputs + requirements; `--read feedback.json` yields the
   expected diff, `builds[]` and asks.
3. Browser (headless Chrome via `analyze-requirements/scripts/lib/cdp.mjs`):
   lock state before/after linking the unbuilt feature; system open →
   Workflows filter → card count; feedback block JSON; `page.errors` empty.
4. Router + gates: `SKILL.md` routing is prose, so the gates are tested at
   script level — `validate.mjs` on a classic inputs file inside a
   workflow-mode lead fails W1; `render.mjs` in workflow mode exits 2.
5. Move: task 1 ends with `npm test` green at the pre-move count.

The review workflow is not unit-tested (it runs agents). Its design test
is the evidence in §4; the plan adds a smoke check that
`workflows/review-links.js` parses and its `meta` is a pure literal.

**Evals** (`estimate/evals/evals.json`, run with `claude plugin eval`):
two new cases on a `workflow-sin-kowa-mini` fixture lead — the happy path
(three questions only, features as ids + scores, components carry the
work, `validate.mjs` exits 0, no pages) and the no-`ARCHITECTURE.md` gate
(stops with the message, no classic fallback, nothing written). The three
existing classic cases double as the router check.

## 9. Out of scope

- Workflow-based and Component-based pages, `estimation.md`, workbook
  export, viewer companion placement → spec 3.
- Proposal format, currency → spec 4.
- Any change to the architecture skill (frontend module breakdown): the
  human review gate (D3) covers it.
- Classic behaviour changes of any kind.
- Measurements dataset / `record-task` skill.
