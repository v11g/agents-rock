# Estimate Workflow Mode (data, linking, score review) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the estimate skill price business-analyst features, link each to the components that build it, run the score review with Built-by lists, and keep classic mode byte-for-byte in behaviour inside its own folder.

**Architecture:** `estimate/SKILL.md` becomes a router on `requirements.json#scopeMode`. Today's skill moves to `estimate/classic/`; the pricing/scoring/agentic-baseline modules both flows need move to `estimate/shared/lib/`. The new `estimate/workflow-based/` holds a schema (features = ids + scores, components = builds + tasks + milestone), a roll-up, a score-review page built from the approved mockup, and a plugin workflow `review-links` (Review → Verify) for the link check.

**Tech Stack:** Node ≥ 20 ESM, `node --test`, dependency-free scripts; headless Chrome via `analyze-requirements/scripts/lib/cdp.mjs` for the page test; Claude Code dynamic workflow (plain JS script) for `review-links`.

**Spec:** `docs/superpowers/specs/2026-10-06-estimate-workflow-mode-design.md` (same worktree). Evidence: `docs/research/2026-10-06-linking-rubric/`.

**Precondition:** spec 1 (business-analyst workflow scope) is squash-merged into `feat/workflow-based-estimator` and this branch is rebased on it, so `plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.json` exists. If it is not, copy that file from the `ba-workflow-scope` worktree in Task 2 and say so in the task report.

## Global Constraints

- Code-size gates (enforced by `quality-gates.test.mjs`): modules ≤ 200 lines, ≤ 10 functions, ≤ 22 lines per function, ≤ 3 params; template scripts ≤ 22 lines per function, ≤ 3 params.
- Never `git stash`. Use `/usr/bin/git`, one command per Bash call. Commits: Conventional Commits, no AI attribution lines.
- Classic behaviour does not change. Task 1 is a pure move: the only edits are import paths and the router.
- Workflow mode is agentic + STANDARD only (spec D4). Features never carry `tasks`, `component`, `milestone`, `provenance` (spec §3).
- Every number comes from scripts (`compute.mjs`); the page only displays.
- TDD: each test fails before the code that makes it pass.
- All paths below are relative to the worktree root. `W=plugins/solution-architect/skills/estimate`.

## Review Focus

1. A `requirements.json` whose feature set changed after scoring (BA re-run) must fail validation with both directions named — pinned in Task 3 (`W3` cases).
2. A container that has components but also carries `builds` must be refused, not silently priced — pinned in Task 3 (`container builds`).
3. A feature built only by components with no `milestone` must compute `milestone: null`, never throw — pinned in Task 4 (`mainBuilder` null case).
4. Feedback that references a component or feature not in the inputs must be ignored, not crash `--read` — pinned in Task 5 (`unknown ids in feedback`).
5. The page must render with zero console errors when a system has no sub-workflows and a feature has `steps: ["*"]` — pinned in Task 5 browser test.

---

### Task 1: Move classic into `classic/`, extract `shared/`, rewire tests

**Files:**
- Move: `$W/scripts/**` → `$W/classic/scripts/**`, `$W/references/**` → `$W/classic/references/**`, `$W/assets/**` → `$W/classic/assets/**`
- Move: `$W/classic/scripts/lib/{pricing,project-price,scoring,scoring-schema,context-schema,baselines,measurements,estimate-math,score-diff,inline}.mjs` → `$W/shared/lib/`
- Create: `$W/classic/FLOW.md` (body of today's SKILL.md), `$W/shared/lib/agentic-task-schema.mjs`
- Modify: `$W/SKILL.md` (router), `package.json:21`, 4 proposal tests, `$W/classic/scripts/test/quality-gates.test.mjs`
- Test: existing suite, unchanged count

**Interfaces:**
- Produces: `shared/lib/agentic-task-schema.mjs` → `export function checkAgenticTask(task, out)`, `export const PROVENANCE`.
- Produces: `shared/lib/scoring-schema.mjs` → additionally `export function checkScoredFeature(feature, guide, out)`.
- Produces: `shared/lib/context-schema.mjs` → `checkContext(inputs, out, opts = {})`; `opts.required === true` runs the five-factor check even in agentic mode.

- [ ] **Step 1: Record the baseline**

Run: `npm test 2>&1 | tail -6`
Expected: ends with `ℹ fail 0`. Write down the `ℹ pass N` number; Task 1 must end with the same N.

- [ ] **Step 2: Move the three folders and split SKILL.md**

```bash
cd plugins/solution-architect/skills/estimate
mkdir -p classic shared/lib
/usr/bin/git mv scripts classic/scripts
```
```bash
/usr/bin/git mv references classic/references
```
```bash
/usr/bin/git mv assets classic/assets
```
```bash
tail -n +5 SKILL.md > classic/FLOW.md && /usr/bin/git add classic/FLOW.md
```
(`SKILL.md` lines 1–4 are the frontmatter; line 5 onward is the body. `classic/FLOW.md` therefore starts at `# estimate`.)

- [ ] **Step 3: Move the shared modules**

```bash
cd plugins/solution-architect/skills/estimate/classic/scripts/lib
for f in pricing project-price scoring scoring-schema context-schema baselines measurements estimate-math score-diff inline; do /usr/bin/git mv $f.mjs ../../../shared/lib/$f.mjs; done
```

- [ ] **Step 4: Extract `checkAgenticTask` into shared**

Create `$W/shared/lib/agentic-task-schema.mjs`:

```javascript
// Agentic task shape, shared by classic (tasks on features) and workflow mode
// (tasks on components). Durations and confidence are script-owned: their
// absence from inputs is the structural guarantee the agent never invents them.
import { TASK_SHAPES } from './measurements.mjs';

export const PROVENANCE = ['observed', 'stated', 'researched', 'proposed'];
const AGENTIC_BANNED = ['category', 'confidence', 'o', 'm', 'p'];

export function checkAgenticTask(task, out) {
  if (!TASK_SHAPES.includes(task.shape)) out.push(`task ${task.id}: unknown shape "${task.shape}"`);
  const s = task.seedMinutes ?? {};
  if (!['o', 'm', 'p'].every((k) => typeof s[k] === 'number' && s[k] > 0)) {
    out.push(`task ${task.id}: seedMinutes o, m, p must be positive numbers`);
  } else if (!(s.o <= s.m && s.m <= s.p)) out.push(`task ${task.id}: seedMinutes expected o <= m <= p`);
  if (typeof task.scope !== 'object' || task.scope === null) out.push(`task ${task.id}: scope object is required`);
  for (const key of AGENTIC_BANNED) {
    if (Object.hasOwn(task, key)) out.push(`task ${task.id}: "${key}" is not an agentic input — the script computes it`);
  }
  if (task.model !== undefined && !(typeof task.model === 'string' && task.model.trim())) {
    out.push(`task ${task.id}: model must be a non-empty string`);
  }
  if (!Array.isArray(task.assumptions)) out.push(`task ${task.id}: assumptions array is required`);
  if (!PROVENANCE.includes(task.provenance)) out.push(`task ${task.id}: provenance not in vocabulary`);
}
```

In `$W/classic/scripts/lib/schema.mjs`: delete the local `PROVENANCE` const, `AGENTIC_BANNED` const and the whole `function checkAgenticTask(task, out) {…}`; delete `import { TASK_SHAPES } from './measurements.mjs';`; add
`import { checkAgenticTask, PROVENANCE } from '../../../shared/lib/agentic-task-schema.mjs';`.

- [ ] **Step 5: Export `checkScoredFeature`; add the `required` option to `checkContext`**

In `$W/shared/lib/scoring-schema.mjs` change `function checkScoredFeature(feature, guide, out) {` to `export function checkScoredFeature(feature, guide, out) {`.

In `$W/shared/lib/context-schema.mjs` replace the `checkContext` export with:

```javascript
export function checkContext(inputs, out, opts = {}) {
  if (!opts.required && (inputs.depth === 'QUICK' || inputs.deliveryMode === 'agentic')) return;
  const levels = inputs.contextLevels ?? {};
  const prov = inputs.contextProvenance ?? {};
  for (const key of FACTORS) checkOne(key, { level: levels[key], prov: prov[key] }, out);
}
```

- [ ] **Step 6: Rewire imports with sed**

From the worktree root:

```bash
W=plugins/solution-architect/skills/estimate
S='pricing\|project-price\|scoring-schema\|scoring\|context-schema\|baselines\|measurements\|estimate-math\|score-diff\|inline'
# classic lib → shared lib
sed -i -E "s#'\./($S)\.mjs'#'../../../shared/lib/\1.mjs'#g" $W/classic/scripts/lib/*.mjs
# classic scripts (compute, render, score-review, validate) → shared lib; covers both `from` and `new URL(...)`
sed -i -E "s#'\./lib/($S)\.mjs'#'../../shared/lib/\1.mjs'#g" $W/classic/scripts/*.mjs
# classic tests → shared lib
sed -i -E "s#'\.\./lib/($S)\.mjs'#'../../../shared/lib/\1.mjs'#g" $W/classic/scripts/test/*.mjs
# every classic file is one level deeper than before relative to analyze-requirements
sed -i 's#analyze-requirements/#../analyze-requirements/#g' $W/classic/scripts/*.mjs $W/classic/scripts/lib/*.mjs $W/classic/scripts/test/*.mjs
# shared/scoring.mjs reads the guide from classic/references (references stay where they were)
sed -i "s#'\.\./\.\./references/scoring-guide.md'#'../../classic/references/scoring-guide.md'#" $W/shared/lib/scoring.mjs
```

Note the sed order: `scoring-schema` is listed before `scoring` so the alternation matches the longer name first. Shared modules importing each other (`./pricing.mjs` inside `shared/lib`) are untouched; their `analyze-requirements` paths are at the same depth as before and are untouched too.

- [ ] **Step 7: Fix the cross-skill paths**

```bash
sed -i 's#estimate/scripts/#estimate/classic/scripts/#g' plugins/solution-architect/skills/proposal/scripts/test/{e2e,evals-fixtures,render,validate}.test.mjs
```

`package.json` line 21: replace the test script with

```json
"test": "node --test tests/*.test.mjs plugins/*/skills/*/scripts/test/*.test.mjs plugins/*/skills/*/classic/scripts/test/*.test.mjs plugins/*/skills/*/workflow-based/scripts/test/*.test.mjs"
```

- [ ] **Step 8: Cover `shared/lib` in the classic quality gate**

In `$W/classic/scripts/test/quality-gates.test.mjs` add after the first `for` loop:

```javascript
for (const file of moduleFiles(new URL('../../../shared', import.meta.url).pathname, ['lib'])) {
  test(`gates: shared ${file.split('/shared/')[1]}`, () => {
    assert.deepEqual(violations(readFileSync(file, 'utf8')), []);
  });
}
```

- [ ] **Step 9: Write the router `SKILL.md`**

Replace `$W/SKILL.md` with:

```markdown
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

Both flows price with `shared/lib/pricing.mjs` and `project-price.mjs`;
the scoring rubric is `classic/references/scoring-guide.md`. Nothing in
`classic/` reads `workflow-based/`, and nothing in `workflow-based/`
reads `classic/` except that rubric.

Dependency: Node ≥ 20. No npm install needed — the scripts are dependency-free.
```

- [ ] **Step 10: Run the suite**

Run: `npm test 2>&1 | tail -6`
Expected: `ℹ fail 0` and `ℹ pass N` with the same N as Step 1 (plus the new shared-gate tests, so N or slightly higher; never lower).

If `references.test.mjs` fails because it reads `SKILL.md` for reference links, change its path constant from `'../../SKILL.md'` to `'../../FLOW.md'` and re-run; nothing else in that test changes.

- [ ] **Step 11: Commit**

```bash
/usr/bin/git add -A plugins/solution-architect/skills/estimate plugins/solution-architect/skills/proposal package.json
```
```bash
/usr/bin/git commit -m "refactor(estimate): move classic flow into classic/, share pricing in shared/" -m "Pure move ahead of workflow mode. SKILL.md becomes a router on
requirements.json scopeMode; today's body is classic/FLOW.md. Modules both
flows need live in shared/lib. Only import paths changed; the suite passes
at the pre-move count."
```

---

### Task 2: Fixture `sin-kowa-mini` and the requirements loader

**Files:**
- Create: `$W/workflow-based/scripts/test/fixtures/requirements.json` (copy), `ARCHITECTURE-mini.md`, `inputs-pass.json`, `feedback.json`, `measurements.jsonl` (empty)
- Create: `$W/workflow-based/scripts/lib/requirements.mjs`
- Test: `$W/workflow-based/scripts/test/requirements.test.mjs`

**Interfaces:**
- Produces: `loadRequirements(path)` → `{ raw, project, mapLabel, features: {id→feature}, systems: [], systemById: {id→system}, workflows: {id→workflow}, systemOf: {featureId→systemId} }`
- Produces: `resolveRequirementsPath(inputsPath, inputs)` → absolute path or `null`
- Produces: `loadPair(inputsPath)` → `{ inputs, req }` (`req` is `null` when the file is missing)
- Produces: `featureProvenance(feature)` → `'stated' | 'proposed'`

- [ ] **Step 1: Copy the BA fixture and write the mini architecture**

```bash
W=plugins/solution-architect/skills/estimate/workflow-based
mkdir -p $W/scripts/lib $W/scripts/test/fixtures $W/references $W/assets
cp plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.json $W/scripts/test/fixtures/requirements.json
: > $W/scripts/test/fixtures/measurements.jsonl
```

Create `$W/scripts/test/fixtures/ARCHITECTURE-mini.md` (read by agents in the flow, not by tests):

```markdown
# sin-kowa-mini — architecture (fixture)

Trimmed from the Sin Kowa v2 document for tests. Component ids match
`inputs-pass.json`.

## 5 Architecture Model

| Container | Tech | Used by |
| --- | --- | --- |
| Core API (`api`) | NestJS | Office Web App, Background Worker |
| Office Web App (`office`) | React SPA | office staff |
| Background Worker (`worker`) | job runner | — |
| Operations Database (`ops`) | PostgreSQL | Core API |

## 6 Core Components

| Component | Responsibility | Tech | Deploy unit | src |
| --- | --- | --- | --- | --- |
| Stage Engine (`api.stage`) | moves Orders through the stages; raises Short-Pack alerts | NestJS module | Core API | proposed |
| Orders and Quoting (`api.orders`) | Order, Quotation, pricing, Order Draft confirmation | NestJS module | Core API | proposed |
| Billing (`api.billing`) | Invoice from accepted packed quantities; issued invoices never edited | NestJS module | Core API | proposed |
| Office Web App (`office`) | orders, quotes, invoicing screens | React SPA | Office Web App | proposed |
| Notifier (`worker.notify`) | sends alerts to staff | job | Background Worker | proposed |
| Order Drafter (`worker.drafter`) | turns message text into an Order Draft | LLM job | Background Worker | proposed |
| Operations Database (`ops`) | system of record; one schema per module | PostgreSQL | RDS | proposed |

## 9 External Integrations

| System | Used for | Component that integrates |
| --- | --- | --- |
| Mailbox | inbound order emails | Order Drafter |
```

- [ ] **Step 2: Write `inputs-pass.json`**

Create `$W/scripts/test/fixtures/inputs-pass.json`. All five features use the same five anchors (they are the guide's sentences, copied from the classic booking fixture); what varies is the components.

```json
{
  "scopeMode": "workflow",
  "requirements": "requirements.json",
  "project": "sin-kowa-mini",
  "currency": "USD",
  "deliveryMode": "agentic",
  "depth": "STANDARD",
  "agentContext": { "agent": "claude-code", "model": "claude-opus-5-5" },
  "contextLevels": { "codebaseMaturity": 1, "stackFamiliarity": 1, "specQuality": 3, "compliance": 2, "clientDecisions": 3 },
  "contextProvenance": {
    "codebaseMaturity": { "level": 1, "anchor": "Greenfield", "cite": "ARCHITECTURE.md mode: greenfield", "source": "derived" },
    "stackFamiliarity": { "level": 1, "anchor": "Core stack, done before", "cite": "not assessed — adjust in the exported workbook", "source": "derived" },
    "specQuality": { "level": 3, "anchor": "Outline or slide deck", "cite": "BA readiness 62", "source": "derived" },
    "compliance": { "level": 2, "anchor": "Handles PII", "cite": "customer names on invoices", "source": "derived" },
    "clientDecisions": { "level": 3, "anchor": "Committee sign-off", "cite": "two directors approve", "source": "derived" }
  },
  "features": [
    { "id": "FEAT-001", "scoreNote": "Five stages with task views per role; the heart of the warehouse app", "scoreProvenance": "proposed",
      "scores": { "tech": { "n": 3, "anchor": "Custom business logic, moderate algorithm complexity, multiple states", "cite": "five stages, role-scoped views" },
                  "size": { "n": 3, "anchor": "Medium feature with multiple components and backend logic", "cite": "engine + screens" },
                  "deps": { "n": 2, "anchor": "One internal dependency (e.g. auth check)", "cite": "reads roles" },
                  "unc": { "n": 3, "anchor": "Some open questions, design decisions to be made during build", "cite": "24h trigger rule open" },
                  "risk": { "n": 3, "anchor": "Moderate impact if broken, requires testing, affects multiple users", "cite": "every order passes through" } } },
    { "id": "FEAT-002", "scoreNote": "Flags a can't-fulfil item in time to act", "scoreProvenance": "proposed",
      "scores": { "tech": { "n": 3, "anchor": "Custom business logic, moderate algorithm complexity, multiple states", "cite": "exception branch" },
                  "size": { "n": 3, "anchor": "Medium feature with multiple components and backend logic", "cite": "alert + screen" },
                  "deps": { "n": 2, "anchor": "One internal dependency (e.g. auth check)", "cite": "stage engine event" },
                  "unc": { "n": 3, "anchor": "Some open questions, design decisions to be made during build", "cite": "who is alerted is open" },
                  "risk": { "n": 3, "anchor": "Moderate impact if broken, requires testing, affects multiple users", "cite": "missed alert delays invoicing" } } },
    { "id": "FEAT-003", "scoreNote": "Orders and quotes from email, phone and fax", "scoreProvenance": "proposed",
      "scores": { "tech": { "n": 3, "anchor": "Custom business logic, moderate algorithm complexity, multiple states", "cite": "catalog + cost-plus pricing" },
                  "size": { "n": 3, "anchor": "Medium feature with multiple components and backend logic", "cite": "intake + quote screens" },
                  "deps": { "n": 2, "anchor": "One internal dependency (e.g. auth check)", "cite": "item master" },
                  "unc": { "n": 3, "anchor": "Some open questions, design decisions to be made during build", "cite": "markup rule unconfirmed" },
                  "risk": { "n": 3, "anchor": "Moderate impact if broken, requires testing, affects multiple users", "cite": "wrong quote loses margin" } } },
    { "id": "FEAT-004", "scoreNote": "Drafts an order from an email for staff to confirm", "scoreProvenance": "proposed",
      "scores": { "tech": { "n": 3, "anchor": "Custom business logic, moderate algorithm complexity, multiple states", "cite": "LLM extraction + review" },
                  "size": { "n": 3, "anchor": "Medium feature with multiple components and backend logic", "cite": "job + review screen" },
                  "deps": { "n": 2, "anchor": "One internal dependency (e.g. auth check)", "cite": "mailbox" },
                  "unc": { "n": 3, "anchor": "Some open questions, design decisions to be made during build", "cite": "no sample emails yet" },
                  "risk": { "n": 3, "anchor": "Moderate impact if broken, requires testing, affects multiple users", "cite": "staff confirm every draft" } } },
    { "id": "FEAT-005", "scoreNote": "Invoice from packed quantities plus proof of delivery", "scoreProvenance": "proposed",
      "scores": { "tech": { "n": 3, "anchor": "Custom business logic, moderate algorithm complexity, multiple states", "cite": "three-way match" },
                  "size": { "n": 3, "anchor": "Medium feature with multiple components and backend logic", "cite": "match + documents + screens" },
                  "deps": { "n": 2, "anchor": "One internal dependency (e.g. auth check)", "cite": "reads packed quantities" },
                  "unc": { "n": 3, "anchor": "Some open questions, design decisions to be made during build", "cite": "credit note flow open" },
                  "risk": { "n": 3, "anchor": "Moderate impact if broken, requires testing, affects multiple users", "cite": "money" } } }
  ],
  "components": [
    { "id": "api", "name": "Core API" },
    { "id": "api.stage", "name": "Stage Engine", "parent": "api", "milestone": "M1 - Walking skeleton",
      "builds": [ { "feature": "FEAT-001", "why": "moves Orders through the five stages" }, { "feature": "FEAT-002", "why": "raises the Short-Pack alert on a can't-fulfil line" } ],
      "tasks": [ { "id": "stage-engine", "name": "Stage transitions with audit", "shape": "small_implementation", "scope": { "affectedFiles": 8, "complexity": "medium" }, "seedMinutes": { "o": 90, "m": 180, "p": 360 }, "assumptions": [], "provenance": "proposed" },
                 { "id": "stage-tests", "name": "Transition tests", "shape": "test_creation", "scope": { "affectedFiles": 3, "complexity": "low" }, "seedMinutes": { "o": 30, "m": 60, "p": 120 }, "assumptions": [], "provenance": "proposed" } ] },
    { "id": "api.orders", "name": "Orders and Quoting", "parent": "api", "milestone": "M1 - Walking skeleton",
      "builds": [ { "feature": "FEAT-003", "why": "owns Order, Quotation and the cost-plus pricing rule" } ],
      "tasks": [ { "id": "orders-impl", "name": "Order and quotation aggregate", "shape": "small_implementation", "scope": { "affectedFiles": 10, "complexity": "medium" }, "seedMinutes": { "o": 120, "m": 240, "p": 480 }, "assumptions": [], "provenance": "proposed" } ] },
    { "id": "api.billing", "name": "Billing", "parent": "api", "milestone": "M2 - Money",
      "builds": [ { "feature": "FEAT-005", "why": "invoice qty = accepted packed qty; issued invoices never edited" } ],
      "tasks": [ { "id": "billing-match", "name": "Three-way match", "shape": "small_implementation", "scope": { "affectedFiles": 6, "complexity": "medium" }, "seedMinutes": { "o": 60, "m": 120, "p": 240 }, "assumptions": [], "provenance": "proposed" },
                 { "id": "billing-docs", "name": "Printable invoice", "shape": "small_implementation", "scope": { "affectedFiles": 4, "complexity": "low" }, "seedMinutes": { "o": 40, "m": 80, "p": 160 }, "assumptions": [], "provenance": "proposed" } ] },
    { "id": "office", "name": "Office Web App", "milestone": "M1 - Walking skeleton",
      "builds": [ { "feature": "FEAT-001", "why": "stage board and task views" }, { "feature": "FEAT-003", "why": "order intake and quote screens" }, { "feature": "FEAT-005", "why": "invoice list, detail and release screens" } ],
      "tasks": [ { "id": "office-screens", "name": "Orders, quotes and invoicing screens", "shape": "ui_implementation", "scope": { "affectedFiles": 14, "complexity": "medium" }, "seedMinutes": { "o": 180, "m": 360, "p": 720 }, "assumptions": [], "provenance": "proposed" } ] },
    { "id": "worker", "name": "Background Worker" },
    { "id": "worker.notify", "name": "Notifier", "parent": "worker", "milestone": "M2 - Money",
      "builds": [ { "feature": "FEAT-002", "why": "delivers the Short-Pack alert to ops and invoicing staff" } ],
      "tasks": [ { "id": "notify-impl", "name": "Alert delivery", "shape": "api_integration", "scope": { "affectedFiles": 3, "complexity": "low" }, "seedMinutes": { "o": 30, "m": 60, "p": 120 }, "assumptions": [], "provenance": "proposed" } ] },
    { "id": "worker.drafter", "name": "Order Drafter", "parent": "worker", "milestone": "M3 - Operations",
      "builds": [ { "feature": "FEAT-004", "why": "turns message text into an Order Draft" } ],
      "tasks": [ { "id": "drafter-impl", "name": "Email to draft extraction", "shape": "api_integration", "scope": { "affectedFiles": 5, "complexity": "medium" }, "seedMinutes": { "o": 90, "m": 180, "p": 360 }, "assumptions": [], "provenance": "proposed" } ] },
    { "id": "ops", "name": "Operations Database", "notEstimated": "one schema per module; no store-specific work in this scope" }
  ],
  "risks": [],
  "assumptions": [
    { "text": "InvoiceNow is a data model only, with no live connection", "impactIfWrong": "a live Access Point link is a separate feature", "source": "ASM-005" },
    { "text": "Label printers accept ZPL over the LAN", "impactIfWrong": "printer bridge work added", "source": "new" }
  ]
}
```

Create `$W/scripts/test/fixtures/feedback.json` (what the page's Copy feedback produces after: FEAT-002 risk 3→4 with a reason, FEAT-004 unlinked from `worker.drafter`, FEAT-004 linked to `api.orders`, and an ask on FEAT-004):

```json
{
  "features": [
    { "id": "FEAT-001", "scores": { "tech": 3, "size": 3, "deps": 2, "unc": 3, "risk": 3 }, "scoreNote": "" },
    { "id": "FEAT-002", "scores": { "tech": 3, "size": 3, "deps": 2, "unc": 3, "risk": 4 }, "scoreNote": "", "reasons": { "risk": "a missed alert blocks invoicing for days" } },
    { "id": "FEAT-003", "scores": { "tech": 3, "size": 3, "deps": 2, "unc": 3, "risk": 3 }, "scoreNote": "" },
    { "id": "FEAT-004", "scores": { "tech": 3, "size": 3, "deps": 2, "unc": 3, "risk": 3 }, "scoreNote": "" },
    { "id": "FEAT-005", "scores": { "tech": 3, "size": 3, "deps": 2, "unc": 3, "risk": 3 }, "scoreNote": "" }
  ],
  "components": [
    { "id": "api.stage", "implements": ["FEAT-001", "FEAT-002"] },
    { "id": "api.orders", "implements": ["FEAT-003", "FEAT-004"] },
    { "id": "api.billing", "implements": ["FEAT-005"] },
    { "id": "office", "implements": ["FEAT-001", "FEAT-003", "FEAT-005"] },
    { "id": "worker.notify", "implements": ["FEAT-002"] },
    { "id": "worker.drafter", "implements": [] },
    { "id": "ops", "implements": [] }
  ],
  "addComponent": [ { "feature": "FEAT-004", "note": "a review screen for the draft is missing" } ]
}
```

- [ ] **Step 3: Write the failing loader test**

Create `$W/scripts/test/requirements.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadRequirements, loadPair, resolveRequirementsPath, featureProvenance } from '../lib/requirements.mjs';

const fx = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('loadRequirements indexes features, systems and workflows by id', () => {
  const req = loadRequirements(fx('requirements.json'));
  assert.equal(req.project, 'sin-kowa-mini');
  assert.equal(req.features['FEAT-001'].name, 'Order pipeline & stage engine');
  assert.equal(req.systemOf['FEAT-004'], 'SYS-002');
  assert.equal(req.systemById['SYS-002'].name, 'Orders & invoicing');
  assert.deepEqual(req.workflows['WF-002'].steps, ['Order In', 'Pack', 'Pack Review', 'Shipped']);
});

test('resolveRequirementsPath is relative to the inputs file', () => {
  assert.equal(resolveRequirementsPath('/leads/x/estimation-inputs.json', { requirements: '../requirements.json' }), '/leads/requirements.json');
  assert.equal(resolveRequirementsPath('/leads/x/estimation-inputs.json', {}), null);
});

test('loadPair returns req null when the file is missing', () => {
  const { inputs, req } = loadPair(fx('inputs-pass.json'));
  assert.equal(inputs.scopeMode, 'workflow');
  assert.equal(req.raw.scopeMode, 'workflow');
  assert.equal(loadPair(fx('requirements.json')).req, null);
});

test('featureProvenance: confirmed → stated, anything else → proposed', () => {
  assert.equal(featureProvenance({ label: 'confirmed' }), 'stated');
  assert.equal(featureProvenance({ label: 'recommended' }), 'proposed');
  assert.equal(featureProvenance({}), 'proposed');
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/requirements.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/requirements.mjs'`

- [ ] **Step 5: Write the loader**

Create `$W/scripts/lib/requirements.mjs`:

```javascript
// The BA package is the source of names, systems and workflow steps in
// workflow mode; estimation-inputs.json carries only ids and scores. This
// module loads and indexes it so no other module re-derives the shape.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const byId = (list) => Object.fromEntries((list ?? []).map((x) => [x.id, x]));

export function resolveRequirementsPath(inputsPath, inputs) {
  if (typeof inputs.requirements !== 'string' || !inputs.requirements) return null;
  return resolve(dirname(inputsPath), inputs.requirements);
}

export function loadRequirements(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const systems = raw.systems ?? [];
  const systemOf = {};
  for (const s of systems) for (const f of s.features ?? []) systemOf[f] = s.id;
  return {
    raw, project: raw.lead ?? raw.project ?? 'Estimate', mapLabel: raw.mapLabel ?? null,
    features: byId(raw.features), systems, systemById: byId(systems), workflows: byId(raw.workflows), systemOf,
  };
}

export function loadPair(inputsPath) {
  const inputs = JSON.parse(readFileSync(inputsPath, 'utf8'));
  const reqPath = resolveRequirementsPath(inputsPath, inputs);
  const req = reqPath && existsSync(reqPath) ? loadRequirements(reqPath) : null;
  return { inputs, req };
}

// Scope provenance in workflow mode is the BA label, not a field of our own.
export const featureProvenance = (feature) => (feature.label === 'confirmed' ? 'stated' : 'proposed');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/requirements.test.mjs`
Expected: `ℹ pass 4`, `ℹ fail 0`

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/estimate/workflow-based
```
```bash
/usr/bin/git commit -m "feat(estimate): workflow-mode fixture and requirements loader" -m "sin-kowa-mini reuses the business-analyst workflow fixture (copied, not
imported across plugins) and adds nine components with agentic tasks.
requirements.mjs indexes the BA package so names and systems are never
copied into estimation-inputs.json."
```

---

### Task 3: Workflow-mode input schema

**Files:**
- Create: `$W/workflow-based/scripts/lib/schema.mjs`, `$W/workflow-based/scripts/lib/schema-components.mjs`
- Test: `$W/workflow-based/scripts/test/schema.test.mjs`

**Interfaces:**
- Consumes: `loadPair` (Task 2); `checkScoredFeature`, `checkContext(…, { required: true })`, `checkAgenticTask`, `loadGuide` (Task 1 shared).
- Produces: `checkWorkflowInputs(inputs, req)` → `string[]` findings (empty = valid). `checkComponents(inputs, out)`.

- [ ] **Step 1: Write the failing tests**

Create `$W/scripts/test/schema.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { checkWorkflowInputs } from '../lib/schema.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));
const load = () => loadPair(fx);
const comp = (inputs, id) => inputs.components.find((c) => c.id === id);

test('the fixture is valid', () => {
  const { inputs, req } = load();
  assert.deepEqual(checkWorkflowInputs(inputs, req), []);
});

const CASES = [
  ['W1 scopeMode', (i) => { i.scopeMode = 'classic'; }, 'scopeMode must be "workflow"'],
  ['W1 requirements not workflow', (i, r) => { r.raw.scopeMode = 'classic'; }, 'requirements: is not in workflow mode'],
  ['W2 traditional', (i) => { i.deliveryMode = 'traditional'; }, 'workflow mode is agentic + STANDARD only'],
  ['W2 DEEP', (i) => { i.depth = 'DEEP'; }, 'workflow mode is agentic + STANDARD only'],
  ['W2 agentContext', (i) => { delete i.agentContext.model; }, 'agentContext.agent and .model are required'],
  ['W3 extra feature', (i) => { i.features.push({ ...i.features[0], id: 'FEAT-009' }); }, 'feature FEAT-009: not in requirements.json'],
  ['W3 missing feature', (i) => { i.features.pop(); }, 'requirements FEAT-005: not scored'],
  ['W4 bad anchor', (i) => { i.features[0].scores.tech.anchor = 'nope'; }, 'scores.tech.anchor is not the guide'],
  ['W5 tasks on feature', (i) => { i.features[0].tasks = []; }, 'feature FEAT-001: "tasks" belongs on components in workflow mode'],
  ['W5 milestone on feature', (i) => { i.features[0].milestone = 'M1'; }, 'feature FEAT-001: "milestone" belongs on components in workflow mode'],
  ['W6 unbuilt feature', (i) => { comp(i, 'worker.drafter').builds = []; comp(i, 'worker.drafter').notEstimated = 'x'; }, 'feature FEAT-004: no component builds it'],
  ['W7 unknown feature in builds', (i) => { comp(i, 'api.billing').builds.push({ feature: 'FEAT-099', why: 'x' }); }, 'component api.billing: builds FEAT-099 unknown'],
  ['W7 missing why', (i) => { comp(i, 'api.billing').builds[0].why = ''; }, 'component api.billing: builds FEAT-005 without a why'],
  ['W8 no milestone', (i) => { delete comp(i, 'api.billing').milestone; }, 'component api.billing: builds features but has no milestone'],
  ['W8 no tasks', (i) => { comp(i, 'api.billing').tasks = []; }, 'component api.billing: builds features but has no tasks'],
  ['W8 bad task shape', (i) => { comp(i, 'api.billing').tasks[0].shape = 'magic'; }, 'task billing-match: unknown shape "magic"'],
  ['W8 orphan without reason', (i) => { delete comp(i, 'ops').notEstimated; }, 'component ops: no feature covers it'],
  ['W8 container builds', (i) => { comp(i, 'api').builds = [{ feature: 'FEAT-001', why: 'x' }]; }, 'component api: a container with components cannot build features'],
  ['W9 bad parent', (i) => { comp(i, 'api.stage').parent = 'nope'; }, 'component api.stage: parent "nope" not in roster'],
  ['W10 context missing', (i) => { delete i.contextLevels.compliance; }, 'contextLevels.compliance: must be an integer 1-4'],
  ['W10 familiarity', (i) => { i.contextLevels.stackFamiliarity = 2; i.contextProvenance.stackFamiliarity.level = 2; }, 'stackFamiliarity: level 2 needs a stated provenance'],
  ['W11 assumption source', (i) => { delete i.assumptions[0].source; }, 'assumption 0: source missing'],
  ['components missing', (i) => { delete i.components; }, 'components roster is required in workflow mode'],
];

for (const [name, mutate, expected] of CASES) {
  test(`refuses: ${name}`, () => {
    const { inputs, req } = load();
    mutate(inputs, req);
    const out = checkWorkflowInputs(inputs, req);
    assert.ok(out.some((f) => f.includes(expected)), `expected a finding containing "${expected}", got:\n${out.join('\n')}`);
  });
}

test('req null → only the file finding', () => {
  const { inputs } = load();
  assert.deepEqual(checkWorkflowInputs(inputs, null), ['requirements: file not found']);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/schema.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/schema.mjs'`

- [ ] **Step 3: Write the component checks**

Create `$W/scripts/lib/schema-components.mjs`:

```javascript
// Components carry the work in workflow mode: builds[] (which features, why),
// a milestone and agentic tasks. A container that has components is structure
// only; a leaf container (no components) may build features itself.
import { checkAgenticTask } from '../../../shared/lib/agentic-task-schema.mjs';

const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

function checkRoster(components, out) {
  const byId = new Map(components.map((c) => [c.id, c]));
  if (byId.size !== components.length) out.push('component roster: duplicate ids');
  for (const c of components) {
    if (!nonEmpty(c.id)) out.push('component roster: every entry needs a non-empty id');
    if (!nonEmpty(c.name)) out.push(`component ${c.id}: name must be a non-empty string`);
    if (c.notEstimated !== undefined && !nonEmpty(c.notEstimated)) out.push(`component ${c.id}: notEstimated must carry a reason`);
    if (c.parent === undefined) continue;
    const parent = byId.get(c.parent);
    if (!parent) out.push(`component ${c.id}: parent "${c.parent}" not in roster`);
    else if (parent.parent !== undefined) out.push(`component ${c.id}: parent "${c.parent}" is not top-level (two levels max)`);
  }
}

function checkBuilds(c, featureIds, out) {
  for (const b of c.builds ?? []) {
    if (!featureIds.has(b.feature)) out.push(`component ${c.id}: builds ${b.feature} unknown`);
    if (!nonEmpty(b.why)) out.push(`component ${c.id}: builds ${b.feature} without a why`);
  }
}

function checkWork(c, parents, out) {
  const builds = c.builds ?? [];
  if (parents.has(c.id)) {
    if (builds.length) out.push(`component ${c.id}: a container with components cannot build features — link the component`);
    return;
  }
  if (builds.length) {
    if (!nonEmpty(c.milestone)) out.push(`component ${c.id}: builds features but has no milestone`);
    if (!(c.tasks?.length > 0)) out.push(`component ${c.id}: builds features but has no tasks`);
    for (const t of c.tasks ?? []) checkAgenticTask(t, out);
  } else if (c.notEstimated === undefined) {
    out.push(`component ${c.id}: no feature covers it — add a builds entry or set notEstimated with a reason`);
  }
}

export function checkComponents(inputs, out) {
  const components = inputs.components;
  if (!Array.isArray(components) || !components.length) { out.push('components roster is required in workflow mode'); return; }
  checkRoster(components, out);
  const featureIds = new Set((inputs.features ?? []).map((f) => f.id));
  const parents = new Set(components.map((c) => c.parent).filter(Boolean));
  const built = new Set();
  for (const c of components) {
    checkBuilds(c, featureIds, out);
    checkWork(c, parents, out);
    for (const b of c.builds ?? []) built.add(b.feature);
  }
  for (const id of featureIds) if (!built.has(id)) out.push(`feature ${id}: no component builds it`);
}
```

- [ ] **Step 4: Write the top-level schema**

Create `$W/scripts/lib/schema.mjs`:

```javascript
// Shape checks for estimation-inputs.json in workflow mode (spec §6). Features
// are ids + scores; their names live in requirements.json; components carry
// the work. Findings are strings with the offending id in them.
import { loadGuide } from '../../../shared/lib/scoring.mjs';
import { checkScoredFeature } from '../../../shared/lib/scoring-schema.mjs';
import { checkContext } from '../../../shared/lib/context-schema.mjs';
import { checkComponents } from './schema-components.mjs';

const FEATURE_BANNED = ['tasks', 'component', 'milestone', 'provenance'];
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

function checkMode(inputs, req, out) {
  if (inputs.scopeMode !== 'workflow') out.push('scopeMode must be "workflow"');
  if (!req) { out.push('requirements: file not found'); return; }
  if (req.raw.scopeMode !== 'workflow') out.push('requirements: is not in workflow mode');
  if (inputs.deliveryMode !== 'agentic' || inputs.depth !== 'STANDARD') out.push('workflow mode is agentic + STANDARD only');
  const ctx = inputs.agentContext ?? {};
  if (!(nonEmpty(ctx.agent) && nonEmpty(ctx.model))) out.push('agentContext.agent and .model are required');
}

function checkFeatureIds(inputs, req, out) {
  const have = new Set((inputs.features ?? []).map((f) => f.id));
  for (const id of have) if (!req.features[id]) out.push(`feature ${id}: not in requirements.json`);
  for (const id of Object.keys(req.features)) if (!have.has(id)) out.push(`requirements ${id}: not scored`);
}

function checkFeatures(inputs, guide, out) {
  for (const f of inputs.features ?? []) {
    for (const key of FEATURE_BANNED) {
      if (key in f) out.push(`feature ${f.id}: "${key}" belongs on components in workflow mode`);
    }
    checkScoredFeature(f, guide, out);
  }
}

// Familiarity is fixed at level 1 (spec D12) unless a human stated otherwise.
function checkFamiliarity(inputs, out) {
  const level = inputs.contextLevels?.stackFamiliarity;
  const src = inputs.contextProvenance?.stackFamiliarity?.source;
  if (level !== undefined && level !== 1 && src !== 'stated') out.push(`stackFamiliarity: level ${level} needs a stated provenance`);
}

function checkAssumptions(inputs, out) {
  (inputs.assumptions ?? []).forEach((a, i) => {
    if (!(typeof a.source === 'string' && /^(ASM-\d+|Q-\d+|new)$/.test(a.source))) out.push(`assumption ${i}: source missing`);
  });
}

export function checkWorkflowInputs(inputs, req) {
  const out = [];
  checkMode(inputs, req, out);
  if (!req) return out;
  checkFeatureIds(inputs, req, out);
  checkFeatures(inputs, loadGuide(), out);
  checkComponents(inputs, out);
  checkContext(inputs, out, { required: true });
  checkFamiliarity(inputs, out);
  checkAssumptions(inputs, out);
  return out;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/schema.test.mjs`
Expected: `ℹ pass 25`, `ℹ fail 0`

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/estimate/workflow-based
```
```bash
/usr/bin/git commit -m "feat(estimate): workflow-mode input schema" -m "Eleven rules from the spec: feature ids must equal the BA package, scores
only on features, builds with a why on components, milestone and agentic
tasks wherever a component builds something, context factors required even
in agentic mode."
```

---

### Task 4: Roll-up and the three CLIs

**Files:**
- Create: `$W/workflow-based/scripts/lib/rollup.mjs`, `$W/workflow-based/scripts/compute.mjs`, `validate.mjs`, `render.mjs`
- Test: `$W/workflow-based/scripts/test/rollup.test.mjs`, `cli.test.mjs`

**Interfaces:**
- Consumes: `agenticTask(task, { records, agentContext })`, `featurePrice(numbers)`, `projectPrice({ features, levels })`, `scoreNumbers`, `scoreSummary`, `round2` (shared); `loadPair`, `featureProvenance` (Task 2); `checkWorkflowInputs` (Task 3).
- Produces: `mainBuilder(featureId, components)` → component or `undefined`; `computeWorkflowEstimation(inputs, req, measurements)` → `{ inputs, computed: { features, components, price } }`.
- CLIs: `compute.mjs --inputs <file> --out <file>`; `validate.mjs --inputs <file> [--json <file>]` exit 0/1; `render.mjs …` exit 2.

- [ ] **Step 1: Write the failing roll-up tests**

Create `$W/scripts/test/rollup.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { mainBuilder, computeWorkflowEstimation } from '../lib/rollup.mjs';
import { featurePrice } from '../../../shared/lib/pricing.mjs';
import { projectPrice } from '../../../shared/lib/project-price.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));

test('mainBuilder: fewest builds wins; earliest milestone on a tie; undefined when nobody builds it', () => {
  const comps = [
    { id: 'a', milestone: 'M2 - Later', builds: [{ feature: 'F1' }] },
    { id: 'b', milestone: 'M1 - First', builds: [{ feature: 'F1' }] },
    { id: 'c', milestone: 'M1 - First', builds: [{ feature: 'F1' }, { feature: 'F2' }] },
  ];
  assert.equal(mainBuilder('F1', comps).id, 'b');
  assert.equal(mainBuilder('F2', comps).id, 'c');
  assert.equal(mainBuilder('F9', comps), undefined);
});

test('feature rows carry name, system, derived milestone, builders and the price', () => {
  const { inputs, req } = loadPair(fx);
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  const f1 = computed.features['FEAT-001'];
  assert.equal(f1.name, 'Order pipeline & stage engine');
  assert.equal(f1.system, 'Warehouse operations');
  assert.equal(f1.milestone, 'M1 - Walking skeleton'); // api.stage (2 builds) beats office (3)
  assert.deepEqual(f1.builtBy, ['api.stage', 'office']);
  assert.equal(computed.features['FEAT-004'].milestone, 'M3 - Operations');
  assert.equal(computed.features['FEAT-004'].provenance, 'proposed'); // BA label: recommended
  assert.equal(computed.features['FEAT-005'].provenance, 'stated');
  const p = featurePrice({ tech: 3, size: 3, deps: 2, unc: 3, risk: 3 });
  assert.equal(f1.point, Math.round(p.point * 100) / 100);
});

test('a feature built only by milestone-less components gets milestone null', () => {
  const { inputs, req } = loadPair(fx);
  for (const c of inputs.components) delete c.milestone;
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  assert.equal(computed.features['FEAT-001'].milestone, null);
});

test('component rows sum agentic hours and list what they build', () => {
  const { inputs, req } = loadPair(fx);
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  const billing = computed.components['api.billing'];
  assert.deepEqual(billing.builds, ['FEAT-005']);
  assert.equal(billing.container, 'api');
  assert.ok(billing.hours > 0 && billing.low <= billing.hours && billing.hours <= billing.high);
  assert.deepEqual(Object.keys(billing.tasks), ['billing-docs', 'billing-match']);
  assert.equal(computed.components.ops.hours, 0);
});

test('price equals the shared project roll-up over the same five features', () => {
  const { inputs, req } = loadPair(fx);
  const { computed } = computeWorkflowEstimation(inputs, req, []);
  const priced = inputs.features.map(() => { const p = featurePrice({ tech: 3, size: 3, deps: 2, unc: 3, risk: 3 }); return { point: p.point, spread: p.spread, unc: 3, risk: 3 }; });
  const want = projectPrice({ features: priced, levels: inputs.contextLevels });
  assert.equal(computed.price.presentLow, Math.round(want.presentLow * 100) / 100);
  assert.equal(computed.price.presentHigh, Math.round(want.presentHigh * 100) / 100);
  assert.equal(computed.price.singleNumber, Math.round(want.singleNumber * 100) / 100);
  assert.equal(Object.keys(computed.features).length, 5);
});
```

(`projectPrice` returns `presentLow`, `presentHigh`, `singleNumber`, `p20/p80/p95`, `contextMultiplier`, `overheads`, `contingencyRate`, among others.)

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/rollup.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/rollup.mjs'`

- [ ] **Step 3: Write the roll-up**

Create `$W/scripts/lib/rollup.mjs`:

```javascript
// Turns validated workflow-mode inputs into estimation.json: a price per
// feature from its five scores, hours per component from agentic baselines,
// and the project price. Names and systems come from the BA package.
import { round2 } from '../../../shared/lib/estimate-math.mjs';
import { featurePrice } from '../../../shared/lib/pricing.mjs';
import { projectPrice } from '../../../shared/lib/project-price.mjs';
import { agenticTask } from '../../../shared/lib/baselines.mjs';
import { scoreNumbers, scoreSummary } from '../../../shared/lib/scoring.mjs';
import { featureProvenance } from './requirements.mjs';

const sortedMap = (entries) => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
const builders = (featureId, components) => components.filter((c) => (c.builds ?? []).some((b) => b.feature === featureId));

// The feature lands with the component most specific to it — fewest other
// features built, earliest milestone on a tie — so shared plumbing never
// drags a feature to the last milestone.
export function mainBuilder(featureId, components) {
  return builders(featureId, components)
    .sort((a, b) => a.builds.length - b.builds.length || String(a.milestone).localeCompare(String(b.milestone)))[0];
}

function featureRow(feature, ctx) {
  const n = scoreNumbers(feature.scores);
  const p = featurePrice(n);
  const req = ctx.req.features[feature.id];
  ctx.priced.push({ point: p.point, spread: p.spread, unc: n.unc, risk: n.risk });
  return {
    name: req.name,
    system: ctx.req.systemById[ctx.req.systemOf[feature.id]]?.name ?? null,
    provenance: featureProvenance(req),
    milestone: mainBuilder(feature.id, ctx.components)?.milestone ?? null,
    builtBy: builders(feature.id, ctx.components).map((c) => c.id).sort(),
    ...scoreSummary(feature),
    point: round2(p.point), spread: round2(p.spread), priceLow: round2(p.low), priceHigh: round2(p.high), flag: p.flag,
  };
}

function componentRow(c, ctx) {
  const tasks = {};
  let hours = 0; let low = 0; let high = 0;
  for (const task of c.tasks ?? []) {
    const a = agenticTask(task, ctx.agentic);
    tasks[task.id] = { e: round2(a.e), sigma: round2(a.sigma), confidence: a.confidence, calibrated: a.calibrated, matchLevel: a.matchLevel };
    hours += a.e; low += a.lowH; high += a.highH;
  }
  return {
    name: c.name, container: c.parent ?? null, milestone: c.milestone ?? null,
    builds: (c.builds ?? []).map((b) => b.feature), hours: round2(hours), low: round2(low), high: round2(high),
    tasks: sortedMap(Object.entries(tasks)),
  };
}

function roundedPrice(price) {
  const block = Object.fromEntries(Object.entries(price).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v]));
  block.overheads = { ...price.overheads, amount: round2(price.overheads.amount) };
  return block;
}

export function computeWorkflowEstimation(inputs, req, measurements) {
  const agentContext = { ...inputs.agentContext, repository: inputs.agentContext.repository ?? inputs.project };
  const ctx = { req, components: inputs.components, priced: [], agentic: { records: measurements ?? [], agentContext } };
  const features = sortedMap(inputs.features.map((f) => [f.id, featureRow(f, ctx)]));
  const components = sortedMap(inputs.components.map((c) => [c.id, componentRow(c, ctx)]));
  const price = projectPrice({ features: ctx.priced, levels: inputs.contextLevels ?? {} });
  return { inputs, computed: { features, components, price: roundedPrice(price) } };
}
```

- [ ] **Step 4: Run the roll-up tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/rollup.test.mjs`
Expected: `ℹ pass 5`, `ℹ fail 0`

- [ ] **Step 5: Write the failing CLI tests**

Create `$W/scripts/test/cli.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = (n) => fileURLToPath(new URL(`../${n}.mjs`, import.meta.url));
const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

function stage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-'));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  inputs.measurementsPath = fx('measurements.jsonl');
  if (mutate) mutate(inputs);
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  return dir;
}

test('compute writes estimation.json with features, components and price', () => {
  const dir = stage();
  execFileSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  const out = JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8'));
  assert.deepEqual(Object.keys(out.computed).sort(), ['components', 'features', 'price']);
  assert.equal(Object.keys(out.computed.features).length, 5);
});

test('compute refuses invalid inputs and names the finding', () => {
  const dir = stage((i) => { i.features[0].tasks = []; });
  const r = spawnSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  assert.equal(r.status, 1);
  assert.match(String(r.stderr), /"tasks" belongs on components/);
});

test('validate exits 0 on a clean pair and 1 when estimation.json is stale', () => {
  const dir = stage();
  execFileSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  const ok = spawnSync('node', [script('validate'), '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json')]);
  assert.equal(ok.status, 0, String(ok.stderr));
  const est = JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8'));
  est.computed.features['FEAT-001'].point += 1;
  writeFileSync(join(dir, 'estimation.json'), JSON.stringify(est));
  const stale = spawnSync('node', [script('validate'), '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json')]);
  assert.equal(stale.status, 1);
  assert.match(String(stale.stderr), /computed block differs from a fresh recompute/);
});

test('render refuses in workflow mode until spec 3', () => {
  const dir = stage();
  const r = spawnSync('node', [script('render'), '--json', join(dir, 'estimation.json'), '--out', dir]);
  assert.equal(r.status, 2);
  assert.match(String(r.stderr), /pages come in spec 3/);
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/cli.test.mjs`
Expected: FAIL — `ENOENT` / `Cannot find module` for `compute.mjs`

- [ ] **Step 7: Write the three CLIs**

Create `$W/scripts/compute.mjs`:

```javascript
// estimation-inputs.json (+ requirements.json) → estimation.json. Refuses on
// any schema finding so the computed truth never rests on a bad shape.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadMeasurements, resolveMeasurementsPath } from '../../shared/lib/measurements.mjs';
import { loadPair } from './lib/requirements.mjs';
import { checkWorkflowInputs } from './lib/schema.mjs';
import { computeWorkflowEstimation } from './lib/rollup.mjs';

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs || !args.out) {
  console.error('usage: compute.mjs --inputs estimation-inputs.json --out estimation.json');
  process.exit(1);
}
const { inputs, req } = loadPair(args.inputs);
const findings = checkWorkflowInputs(inputs, req);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
const measurements = loadMeasurements(resolveMeasurementsPath(inputs)).records;
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, `${JSON.stringify(computeWorkflowEstimation(inputs, req, measurements), null, 2)}\n`);
console.log(args.out);
```

Create `$W/scripts/validate.mjs`:

```javascript
// Inputs findings plus, when --json is given, a byte-level check that the
// computed block equals a fresh recompute. estimation.md arrives in spec 3.
import { readFileSync } from 'node:fs';
import { loadMeasurements, resolveMeasurementsPath } from '../../shared/lib/measurements.mjs';
import { loadPair } from './lib/requirements.mjs';
import { checkWorkflowInputs } from './lib/schema.mjs';
import { computeWorkflowEstimation } from './lib/rollup.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

function checkComputed(inputs, req, jsonPath) {
  const est = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const measurements = loadMeasurements(resolveMeasurementsPath(inputs)).records;
  const fresh = computeWorkflowEstimation(inputs, req, measurements).computed;
  return JSON.stringify(est.computed) === JSON.stringify(fresh) ? [] : ['estimation.json: computed block differs from a fresh recompute — run compute.mjs'];
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs) { console.error('usage: validate.mjs --inputs estimation-inputs.json [--json estimation.json]'); process.exit(1); }
const { inputs, req } = loadPair(args.inputs);
const findings = checkWorkflowInputs(inputs, req);
if (!findings.length && args.json) findings.push(...checkComputed(inputs, req, args.json));
if (findings.length) { console.error(findings.join('\n')); process.exit(1); }
console.log('ok');
```

Create `$W/scripts/render.mjs`:

```javascript
// Workflow-mode pages (Workflow-based, Component-based) and estimation.md are
// spec 3. Until then this refuses loudly instead of rendering a classic page
// over workflow data.
console.error('estimate workflow mode: pages come in spec 3 — nothing rendered. estimation.json is complete and validated.');
process.exit(2);
```

- [ ] **Step 8: Run the CLI tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/cli.test.mjs`
Expected: `ℹ pass 4`, `ℹ fail 0`

- [ ] **Step 9: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/estimate/workflow-based
```
```bash
/usr/bin/git commit -m "feat(estimate): workflow-mode roll-up and compute/validate CLIs" -m "Price per feature from its scores, hours per component from agentic
baselines, feature milestone from the main builder. render.mjs refuses
until spec 3 adds the pages."
```

---

### Task 5: Score review page — template, page data, feedback round trip

**Files:**
- Create: `$W/workflow-based/scripts/build-template.mjs` (one-off, kept), `$W/workflow-based/assets/score-review.html` (generated, committed)
- Create: `$W/workflow-based/scripts/lib/score-html.mjs`, `score-diff.mjs`, `$W/workflow-based/scripts/score-review.mjs`
- Test: `$W/workflow-based/scripts/test/score-review.test.mjs`, `browser.test.mjs`, `quality-gates.test.mjs`

**Interfaces:**
- Consumes: `embed({ template, slots })` (analyze-requirements), `inlineModule`, `extractExports`, `SCORE_FACTORS`, `loadGuide`, `guideTableHtml`, `diffScores`, `applyDiff` (shared), `loadPair` (Task 2).
- Produces: `pageData({ inputs, req, guide })` → `{ data, eng, implements, scores, anchor }`; `toHtml({ inputs, req, guide, template, mathSrc })` → html string.
- Produces: `diffLinks(inputs, feedback)` → `[{ component, feature, change: 'add'|'remove' }]`; `applyLinks(inputs, linkDiff)` → components; `readFeedback({ inputs, feedback, guide })` → `{ diff, needsReason, features, links, components, asks }`.
- CLI: `score-review.mjs --write <inputs> --out <html>` · `score-review.mjs --read <feedback.json> --inputs <inputs>`.

- [ ] **Step 1: Write the template builder**

Create `$W/scripts/build-template.mjs` (run from the worktree root; rebuild only when the mockup changes):

```javascript
// Builds assets/score-review.html from the approved mockup sources. Slots
// replace the Sin Kowa data; everything else is the mockup as approved.
import { readFileSync, writeFileSync } from 'node:fs';

const M = 'docs/mockups/estimate-workflow-mode/';
const OUT = 'plugins/solution-architect/skills/estimate/workflow-based/assets/score-review.html';
const base = readFileSync(`${M}score-review.base.html`, 'utf8');
const py = readFileSync(`${M}build-score.py`, 'utf8');
const cssStart = py.indexOf("CSS = '''") + 9;
const css = py.slice(cssStart, py.indexOf("'''", cssStart));
let body = readFileSync(`${M}score-review.body.html`, 'utf8');

function rep(from, to) {
  const next = body.replace(from, to);
  if (next === body) throw new Error(`template builder: nothing matched ${String(from).slice(0, 60)}`);
  body = next;
}

rep(/\/\*DATA\*\/\s*\n\/\*ENG\*\//, [
  "const PAGE = JSON.parse(document.getElementById('page-data').textContent);",
  'const DATA = PAGE.data; const ENG = PAGE.eng; const IMPLEMENTS = PAGE.implements; const CAP_SCORES = PAGE.scores; const TASKS = {};',
].join('\n'));
rep('/*ANCHOR*/', 'const ANCHOR = PAGE.anchor;');
rep('const FINAL = false; /*FINAL*/', 'const FINAL = false;');
rep(/<span class="mock">[^<]*<\/span>\s*\n/, '');
rep('<h1>Sin Kowa — score review', '<h1><!-- slot:TITLE --> — score review');
rep(/19 features in 4 systems, built by 21 components/, '<span id="subcount"></span>');
rep('render(); CAPS.forEach((c) => paint(c.id));', "$('#subcount').textContent = `${CAPS.length} features in ${DATA.systems.length} systems, built by ${COMPS.length} components`;\nrender(); CAPS.forEach((c) => paint(c.id));");
rep('Review &amp; send →</button>', 'Review &amp; send →</button> <span class="quiet">You can reopen this page later; your changes stay in this browser.</span>');
rep('<script type="module">', '<script type="application/json" id="page-data"><!-- slot:DATA --></script>\n<script type="module">');
// pricing: the shared module replaces the transcription
rep(/const WEIGHTS = \{[^\n]*\n(?:const BANDS = [^\n]*\n){1,2}[^\n]*\n?const weighted = [^\n]*\nconst bandFor = [^\n]*\n/, '<!-- slot:MATH -->\n');
rep('const score = weighted(s);', 'const score = weightedScore(s);');

const head = base.slice(0, base.indexOf('</style>')).replace('<title>Sin Kowa — score review</title>', '<title><!-- slot:TITLE --> — score review</title>');
writeFileSync(OUT, `${head}${css}${readFileSync(`${M}reading.css`, 'utf8')}</style>\n</head>\n<body>\n${body}`);
console.log(OUT);
```

Run: `node plugins/solution-architect/skills/estimate/workflow-based/scripts/build-template.mjs`
Expected: prints the output path. If a `rep` throws, open the mockup file it names and adjust that one pattern to the current text — the mockup is the source of truth.

Check the pricing replacement landed:
Run: `grep -c 'slot:MATH\|weightedScore(s)' plugins/solution-architect/skills/estimate/workflow-based/assets/score-review.html`
Expected: `2`

- [ ] **Step 2: Add the quality-gate test and watch it flag the template**

Create `$W/scripts/test/quality-gates.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEMPLATE_LIMITS, moduleFiles, templateScripts, violations,
} from '../../../../analyze-requirements/scripts/lib/quality-gate.mjs';

const base = new URL('../..', import.meta.url).pathname;

for (const file of moduleFiles(base, ['scripts/lib', 'scripts'])) {
  test(`gates: ${file.replace(base, '')}`, () => {
    assert.deepEqual(violations(readFileSync(file, 'utf8')), []);
  });
}

for (const { file, js } of templateScripts(base)) {
  test(`gates: ${file.replace(base, '')}`, () => {
    assert.deepEqual(violations(js, TEMPLATE_LIMITS), []);
  });
}
```

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/quality-gates.test.mjs`
Expected: the `assets/score-review.html` test FAILS with `function of 36 lines (max 22)` and `function of 24 lines (max 22)`; module tests pass.

- [ ] **Step 3: Split the two long functions in the template**

The 24-line one is the click handler. In `assets/score-review.html` replace the block that starts `document.addEventListener('click', (e) => {` and ends at its matching `});` with:

```javascript
function onEdit(e) {
  const b = e.target.closest('.pick button');
  if (b) { const { f, k } = b.dataset; cur[f][k] = +b.dataset.n; refresh(f); save(); return true; }
  const un = e.target.closest('[data-unlink]')?.dataset.unlink;
  if (un) { const [bid, c] = un.split(':'); links[bid] = links[bid].filter((x) => x !== c); relink(); return true; }
  const ask = e.target.closest('[data-ask-btn]')?.dataset.askBtn;
  if (ask) { asks[ask] = ''; relink(); $(`[data-ask="${ask}"]`)?.focus(); return true; }
  const unask = e.target.closest('[data-unask]')?.dataset.unask;
  if (unask) { delete asks[unask]; relink(); return true; }
  return false;
}
function onCards(cards) {
  sysFilter = cards === 'wf';
  if (!sysFilter) openSystem(null);
  if (sysFilter && !openSys) openSystem((DATA.systems.find((s) => s.features.some((c) => notBuilt(c.id))) || DATA.systems[0]).id);
  refresh(); if (sysFilter) $('#map').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function onNav(e) {
  const go = e.target.closest('[data-go]');
  if (go && $(`#c-${go.dataset.go}`).classList.contains('hide')) { filter = 'all'; sysFilter = false; refresh(); }
  const fl = e.target.closest('[data-filter]');
  if (fl) { filter = filter === fl.dataset.filter ? 'all' : fl.dataset.filter; refresh(); if (filter === 'unlinked') { lastC = null; nextItem(true); } }
  const sd = e.target.closest('[data-side]')?.dataset.side;
  if (sd) { side = sd; document.body.classList.toggle('side-effort-on', side === 'effort'); totals(); }
  const cards = e.target.closest('[data-cards]')?.dataset.cards;
  if (cards) onCards(cards);
}
document.addEventListener('click', (e) => { if (!onEdit(e)) onNav(e); });
```

For the 36-line one, find it with the gate's own view of the script:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
const html = readFileSync("plugins/solution-architect/skills/estimate/workflow-based/assets/score-review.html","utf8");
const js = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const starts = [...js.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+\w+|=>\s*\{/g)];
for (const m of starts) { let i = js.indexOf("{", m.index); let d = 0; let j = i;
  for (; j < js.length; j++) { if (js[j] === "{") d++; else if (js[j] === "}" && --d === 0) break; }
  const n = js.slice(i, j + 1).split("\n").filter((l) => l.trim()).length;
  if (n > 22) console.log(n, "lines ::", js.slice(m.index, m.index + 80).replace(/\n/g, " ").trim()); }'
```

It prints the offending function's first line. Split it at the seam between building row/markup strings and attaching them to the DOM: move the string-building half into a new `function <name>Html(...)` that returns the string (≤ 3 params), and keep the original function to call it and assign. Re-run the gate until it passes.

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/quality-gates.test.mjs`
Expected: `ℹ fail 0`

- [ ] **Step 4: Write the failing round-trip tests**

Create `$W/scripts/test/score-review.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { pageData } from '../lib/score-html.mjs';
import { diffLinks, applyLinks, readFeedback } from '../lib/score-diff.mjs';
import { loadGuide } from '../../../shared/lib/scoring.mjs';

const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const script = fileURLToPath(new URL('../score-review.mjs', import.meta.url));
const feedback = () => JSON.parse(readFileSync(fx('feedback.json'), 'utf8'));

test('pageData maps the BA package and inputs into the page shape', () => {
  const { inputs, req } = loadPair(fx('inputs-pass.json'));
  const d = pageData({ inputs, req, guide: loadGuide() });
  assert.equal(d.data.project, 'sin-kowa-mini');
  assert.equal(d.data.systems.length, 2);
  assert.equal(d.data.systems[0].main.id, 'WF-002');
  assert.deepEqual(d.data.systems[1].subs.map((w) => w.id), ['WF-004']);
  assert.deepEqual(d.data.systems[0].features.map((f) => f.id), ['FEAT-001', 'FEAT-002']);
  assert.deepEqual(d.eng.map((c) => c.id).sort(), ['api.billing', 'api.orders', 'api.stage', 'office', 'ops', 'worker.drafter', 'worker.notify']);
  assert.equal(d.eng.find((c) => c.id === 'api.billing').container, 'Core API');
  assert.equal(d.eng.find((c) => c.id === 'office').container, 'Office Web App');
  assert.deepEqual(d.implements['office'], ['FEAT-001', 'FEAT-003', 'FEAT-005']);
  assert.deepEqual(d.scores['FEAT-001'], [3, 3, 2, 3, 3]);
  assert.equal(d.anchor.tech.length, 5);
});

test('diffLinks and applyLinks move FEAT-004 from the drafter to orders', () => {
  const { inputs } = loadPair(fx('inputs-pass.json'));
  const links = diffLinks(inputs, feedback());
  assert.deepEqual(links, [
    { component: 'api.orders', feature: 'FEAT-004', change: 'add' },
    { component: 'worker.drafter', feature: 'FEAT-004', change: 'remove' },
  ]);
  const comps = applyLinks(inputs, links);
  assert.deepEqual(comps.find((c) => c.id === 'api.orders').builds.map((b) => b.feature), ['FEAT-003', 'FEAT-004']);
  assert.equal(comps.find((c) => c.id === 'api.orders').builds[1].why, 'linked by the engineer in the score review');
  assert.deepEqual(comps.find((c) => c.id === 'worker.drafter').builds, []);
});

test('readFeedback: score diff, reasons, links and asks in one object', () => {
  const { inputs } = loadPair(fx('inputs-pass.json'));
  const r = readFeedback({ inputs, feedback: feedback(), guide: loadGuide() });
  assert.deepEqual(r.diff, [{ id: 'FEAT-002', field: 'risk', from: 3, to: 4 }]);
  assert.deepEqual(r.needsReason, []); // the engineer gave a reason
  assert.equal(r.features.find((f) => f.id === 'FEAT-002').scores.risk.n, 4);
  assert.equal(r.features.find((f) => f.id === 'FEAT-002').scoreProvenance, 'stated');
  assert.equal(r.links.length, 2);
  assert.deepEqual(r.asks, [{ feature: 'FEAT-004', note: 'a review screen for the draft is missing' }]);
});

test('unknown ids in feedback are ignored, not fatal', () => {
  const { inputs } = loadPair(fx('inputs-pass.json'));
  const fb = feedback();
  fb.components.push({ id: 'ghost', implements: ['FEAT-001'] });
  fb.features.push({ id: 'FEAT-099', scores: { tech: 1, size: 1, deps: 1, unc: 1, risk: 1 }, scoreNote: '' });
  const r = readFeedback({ inputs, feedback: fb, guide: loadGuide() });
  assert.equal(r.links.length, 2);
  assert.equal(r.features.length, 5);
});

test('CLI --write embeds the page data; --read prints the review object', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-sr-'));
  copyFileSync(fx('inputs-pass.json'), join(dir, 'estimation-inputs.json'));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  execFileSync('node', [script, '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  const html = readFileSync(join(dir, 'review.html'), 'utf8');
  assert.match(html, /<title>sin-kowa-mini — score review<\/title>/);
  const data = JSON.parse(html.match(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.data.systems.length, 2);
  assert.doesNotMatch(html, /slot:/);
  writeFileSync(join(dir, 'feedback.json'), JSON.stringify(feedback()));
  const out = JSON.parse(execFileSync('node', [script, '--read', join(dir, 'feedback.json'), '--inputs', join(dir, 'estimation-inputs.json')], { encoding: 'utf8' }));
  assert.equal(out.links.length, 2);
  assert.equal(out.asks.length, 1);
});
```

- [ ] **Step 5: Run them to verify they fail**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/score-review.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/score-html.mjs'`

- [ ] **Step 6: Write `score-html.mjs`**

Create `$W/scripts/lib/score-html.mjs`:

```javascript
// Fills the score-review template: the BA package becomes the page's systems
// and features, the component roster its Built-by lists, the inputs its
// scores. Same slots discipline as the classic page (embed is strict).
import { embed } from '../../../../analyze-requirements/scripts/lib/embed.mjs';
import { inlineModule, extractExports } from '../../../shared/lib/inline.mjs';
import { SCORE_FACTORS } from '../../../shared/lib/scoring.mjs';

const flow = (w) => ({ id: w.id, name: w.name, steps: w.steps ?? [], branches: w.branches ?? [] });

function systemData(s, req) {
  const [main, ...subs] = (s.workflows ?? []).map((id) => flow(req.workflows[id]));
  const features = (s.features ?? []).map((id) => {
    const f = req.features[id];
    return { id, name: f.name, steps: f.steps ?? [], does: f.does ?? '' };
  });
  return { id: s.id, name: s.name, main: main ?? null, subs, features };
}

const isParent = (c, components) => components.some((x) => x.parent === c.id);

export function pageData({ inputs, req, guide }) {
  const comps = inputs.components.filter((c) => !isParent(c, inputs.components));
  const nameOf = Object.fromEntries(inputs.components.map((c) => [c.id, c.name]));
  return {
    data: { project: inputs.project, mapLabel: req.mapLabel, systems: req.systems.map((s) => systemData(s, req)) },
    eng: comps.map((c) => ({
      id: c.id, name: c.name, container: c.parent ? nameOf[c.parent] : c.name, milestone: c.milestone ?? '', does: c.notEstimated ?? '',
    })),
    implements: Object.fromEntries(comps.map((c) => [c.id, (c.builds ?? []).map((b) => b.feature)])),
    scores: Object.fromEntries(inputs.features.map((f) => [f.id, SCORE_FACTORS.map((k) => f.scores[k].n)])),
    anchor: guide,
  };
}

export function toHtml({ inputs, req, guide, template, mathSrc }) {
  return embed({
    template,
    slots: {
      TITLE: inputs.project,
      DATA: JSON.stringify(pageData({ inputs, req, guide })).replaceAll('</script', '<\\/script'),
      MATH: inlineModule(extractExports(mathSrc, ['WEIGHTS', 'BANDS', 'weightedScore', 'bandFor', 'tierFor'])),
    },
  });
}
```

- [ ] **Step 7: Write `score-diff.mjs`**

Create `$W/scripts/lib/score-diff.mjs`:

```javascript
// What the engineer changed on the page, folded back into the inputs: score
// moves (via the shared diff, anchors re-derived), component link changes,
// and asks for components that do not exist yet.
import { SCORE_FACTORS } from '../../../shared/lib/scoring.mjs';
import { diffScores, applyDiff } from '../../../shared/lib/score-diff.mjs';

const LINK_WHY = 'linked by the engineer in the score review';
const builds = (c) => (c.builds ?? []).map((b) => b.feature);

export function diffLinks(inputs, feedback) {
  const out = [];
  for (const fb of feedback.components ?? []) {
    const c = inputs.components.find((x) => x.id === fb.id);
    if (!c) continue;
    const was = builds(c);
    for (const f of fb.implements) if (!was.includes(f)) out.push({ component: c.id, feature: f, change: 'add' });
    for (const f of was) if (!fb.implements.includes(f)) out.push({ component: c.id, feature: f, change: 'remove' });
  }
  return out;
}

export function applyLinks(inputs, linkDiff) {
  return inputs.components.map((c) => {
    const mine = linkDiff.filter((d) => d.component === c.id);
    if (!mine.length) return c;
    const removed = new Set(mine.filter((d) => d.change === 'remove').map((d) => d.feature));
    const kept = (c.builds ?? []).filter((b) => !removed.has(b.feature));
    const added = mine.filter((d) => d.change === 'add').map((d) => ({ feature: d.feature, why: LINK_WHY }));
    return { ...c, builds: [...kept, ...added] };
  });
}

// Every moved score without a reason is a question the agent owes the
// reviewer; the old cite is the evidence the answer argues against.
function unreasoned(inputs, feedback, diff) {
  const given = (c) => feedback.features.find((f) => f.id === c.id)?.reasons?.[c.field];
  return diff.filter((c) => SCORE_FACTORS.includes(c.field) && !given(c))
    .map((c) => ({ ...c, oldCite: inputs.features.find((f) => f.id === c.id).scores[c.field].cite }));
}

export function readFeedback({ inputs, feedback, guide }) {
  const known = new Set(inputs.features.map((f) => f.id));
  const fb = { ...feedback, features: (feedback.features ?? []).filter((f) => known.has(f.id)) };
  const diff = diffScores(inputs, fb);
  const links = diffLinks(inputs, fb);
  return {
    diff, needsReason: unreasoned(inputs, fb, diff), features: applyDiff({ draft: inputs, diff, guide }),
    links, components: applyLinks(inputs, links), asks: fb.addComponent ?? [],
  };
}
```

- [ ] **Step 8: Write the CLI**

Create `$W/scripts/score-review.mjs`:

```javascript
// Score review round-trip for workflow mode. --write renders the review page
// from inputs + the BA package; --read folds the page's feedback JSON back
// into scores, component links and asks. It scores nothing itself.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadPair } from './lib/requirements.mjs';
import { toHtml } from './lib/score-html.mjs';
import { readFeedback } from './lib/score-diff.mjs';
import { loadGuide } from '../../shared/lib/scoring.mjs';

const templatePath = new URL('../assets/score-review.html', import.meta.url).pathname;
const mathPath = new URL('../../shared/lib/pricing.mjs', import.meta.url).pathname;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

function requirePair(path) {
  const pair = loadPair(path);
  if (!pair.req) { console.error('requirements: file not found (inputs.requirements must point at the BA package)'); process.exit(1); }
  return pair;
}

function write(args) {
  const { inputs, req } = requirePair(args.write);
  const html = toHtml({ inputs, req, guide: loadGuide(), template: readFileSync(templatePath, 'utf8'), mathSrc: readFileSync(mathPath, 'utf8') });
  writeFileSync(args.out, html);
  console.log(args.out);
}

function read(args) {
  const { inputs } = requirePair(args.inputs);
  const feedback = JSON.parse(readFileSync(args.read, 'utf8'));
  console.log(JSON.stringify(readFeedback({ inputs, feedback, guide: loadGuide() }), null, 2));
}

const args = parseArgs(process.argv.slice(2));
if (args.write && args.out) write(args);
else if (args.read && args.inputs) read(args);
else {
  console.error('usage: score-review.mjs --write estimation-inputs.json --out review.html\n       score-review.mjs --read feedback.json --inputs estimation-inputs.json');
  process.exit(1);
}
```

- [ ] **Step 9: Run the round-trip tests to verify they pass**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/score-review.test.mjs`
Expected: `ℹ pass 5`, `ℹ fail 0`. If `extractExports` throws because `pricing.mjs` does not export one of the five names, open `shared/lib/pricing.mjs`, use its actual export names in both `score-html.mjs` and the template's `price(s)` function, and re-run.

- [ ] **Step 10: Write the failing browser test**

Create `$W/scripts/test/browser.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';

const script = fileURLToPath(new URL('../score-review.mjs', import.meta.url));
const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const skip = !findChrome();

function buildPage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-page-'));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  if (mutate) mutate(inputs);
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  execFileSync('node', [script, '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  return pathToFileURL(join(dir, 'review.html')).href;
}

const settle = () => new Promise((r) => setTimeout(r, 1500));
const count = (page) => page.eval(`[...document.querySelectorAll('[id^="c-FEAT"]:not(.hide)')].length`);

test('renders five cards, no console errors, send unlocked', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await count(page), 5);
    assert.equal(await page.eval(`document.getElementById('copy').disabled`), false);
    assert.match(await page.eval(`document.getElementById('subcount').textContent`), /5 features in 2 systems, built by 7 components/);
  } finally { await page.close(); }
});

test('an unbuilt feature locks send; its ask unlocks it', { skip }, async () => {
  const page = await openPage(buildPage((i) => { i.components.find((c) => c.id === 'worker.drafter').builds = []; }));
  try {
    await settle();
    assert.equal(await page.eval(`document.getElementById('copy').disabled`), true);
    await page.eval(`document.querySelector('[data-ask-btn="FEAT-004"]').click()`);
    await page.eval(`(() => { const t = document.querySelector('[data-ask="FEAT-004"]'); t.value = 'add a drafter'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    assert.equal(await page.eval(`document.getElementById('copy').disabled`), false);
    const fb = await page.eval(`JSON.stringify(window.__feedback())`);
    assert.deepEqual(JSON.parse(fb).addComponent, [{ feature: 'FEAT-004', note: 'add a drafter' }]);
  } finally { await page.close(); }
});

test('opening a system switches the cards to that system', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    await page.eval(`document.querySelectorAll('details.capsys > summary')[1].click()`);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(await count(page), 3); // SYS-002: FEAT-003, FEAT-004, FEAT-005
    assert.equal(await page.eval(`document.querySelector('[data-cards="wf"]').getAttribute('aria-pressed')`), 'true');
    await page.eval(`document.querySelectorAll('details.capsys > summary')[1].click()`);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(await count(page), 5);
  } finally { await page.close(); }
});

test('a star-step feature and a system without sub-workflows render clean', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('details.capsys').length`), 2);
  } finally { await page.close(); }
});
```

Add a fifth test for the `["*"]` step form; `buildPage` copies `requirements.json` verbatim, so this one writes its own copy:

```javascript
test('a feature covering every step renders the "every step" chip, no errors', { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-star-'));
  const req = JSON.parse(readFileSync(fx('requirements.json'), 'utf8'));
  req.features[0].steps = ['*'];
  writeFileSync(join(dir, 'requirements.json'), JSON.stringify(req));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  execFileSync('node', [script, '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  const page = await openPage(pathToFileURL(join(dir, 'review.html')).href);
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.match(await page.eval(`document.querySelector('tr[data-cap="FEAT-001"]').textContent`), /every step/);
  } finally { await page.close(); }
});
```

With it, Step 11 expects `ℹ pass 5`.

- [ ] **Step 11: Run the browser tests**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/browser.test.mjs`
Expected: `ℹ pass 4`, `ℹ fail 0` (or `skip 4` on a machine without Chrome — then run on one with it before the branch review). If `page.errors` is not empty, the first error names what the template still expects (a global the data slot does not provide); fix `pageData` or the template, never the test.

- [ ] **Step 12: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/estimate/workflow-based
```
```bash
/usr/bin/git commit -m "feat(estimate): workflow-mode score review page and feedback round trip" -m "The approved mockup becomes the template; the BA package and the
component roster fill it. Feedback returns score moves, link changes and
asks for missing components. Shared pricing is inlined for the live tier."
```

---

### Task 6: Review workflow, FLOW.md, rubric references, docs

**Files:**
- Create: `plugins/solution-architect/workflows/review-links.js`
- Create: `$W/workflow-based/FLOW.md`, `$W/workflow-based/references/linking.md`, `$W/workflow-based/references/hidden-work-by-type.md`
- Modify: `$W/README.md`, spec §3/§8 notes
- Test: `$W/workflow-based/scripts/test/workflow-script.test.mjs`

**Interfaces:**
- Consumes: Tasks 2–5 CLIs by name in `FLOW.md`.
- Produces: `/solution-architect:review-links` taking `args = { inputs, architecture, requirements, linking }`.

- [ ] **Step 1: Write the failing smoke test**

Create `$W/scripts/test/workflow-script.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../../../../../workflows/review-links.js', import.meta.url));

test('review-links.js starts with a literal meta and has the two phases', () => {
  const src = readFileSync(path, 'utf8');
  assert.match(src, /^export const meta = \{/);
  const meta = src.slice(0, src.indexOf('\n}\n') + 2);
  assert.doesNotMatch(meta, /\$\{|\.\.\.|\w+\(/); // pure literal: no interpolation, spread or call
  assert.match(src, /phase\('Review'\)/);
  assert.match(src, /phase\('Verify'\)/);
  assert.match(src, /return verified\.filter\(Boolean\)\.filter\(\(f\) => f\.verdict === 'ACCEPT'\)/);
  assert.doesNotMatch(src, /Date\.now|Math\.random|import\(/);
});
```

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/workflow-script.test.mjs`
Expected: FAIL — `ENOENT … workflows/review-links.js`

- [ ] **Step 2: Write the workflow**

Create `plugins/solution-architect/workflows/review-links.js`:

```javascript
export const meta = {
  name: 'review-links',
  description: 'Fresh-eyes review of feature→component links and component tasks, then adversarial verify of every proposed add',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const FINDINGS = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['feature', 'action', 'component', 'why'],
        properties: {
          feature: { type: 'string' },
          action: { type: 'string', enum: ['add', 'drop', 'task'] },
          component: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
  },
}
const VERDICT = {
  type: 'object',
  required: ['verdict', 'why'],
  properties: {
    verdict: { type: 'string', enum: ['ACCEPT', 'REJECT'] },
    why: { type: 'string' },
    quoted: { type: 'string' },
  },
}

const read = `Read ${args.linking} (core rubric + task rubric), then ${args.architecture} (§6 components, §9 externals), then ${args.requirements}, then ${args.inputs}.`

phase('Review')
const review = await agent(`${read}
You are a fresh-eyes reviewer of the feature→component links (components[].builds) and the component tasks in the inputs file.
A link is right only when the feature CHANGES the component: a new rule, new data, a new kind of event, a new constraint.
Propose "add" only when you can name the change inside that component. Propose "drop" only when the linker's why describes use, not change.
Propose "task" for a task-rubric breach (component in "component", what is wrong in "why"). When unsure, leave it alone. Fewer, surer findings beat many.`, { schema: FINDINGS })

phase('Verify')
const verified = await pipeline(review.findings, (f) => (f.action !== 'add' ? { ...f, verdict: 'ACCEPT' }
  : agent(`Read ${args.architecture} (§6, §9) and the features in ${args.requirements}.
Proposed link: feature ${f.feature} → component "${f.component}". Proposer's why: "${f.why}".
1. Does the §6 Responsibility of this component ALREADY describe the behaviour the proposal says the feature needs? If yes → REJECT.
2. Does the feature's description ask for this work, or is it operational scope nobody asked for (monitoring, tests, docs)? If not asked → REJECT.
3. Can you name the concrete change inside this component that §6 does not already list? If yes → ACCEPT.
Quote (at most 15 words) the §6 text you relied on in "quoted".`, { schema: VERDICT, phase: 'Verify', label: `${f.feature} → ${f.component}` })
    .then((v) => ({ ...f, ...v }))))

log(`${review.findings.length} findings, ${verified.filter(Boolean).filter((f) => f.verdict === 'ACCEPT').length} confirmed`)
return verified.filter(Boolean).filter((f) => f.verdict === 'ACCEPT')
```

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/workflow-script.test.mjs`
Expected: `ℹ pass 1`

- [ ] **Step 3: Write the rubric references**

```bash
W=plugins/solution-architect/skills/estimate/workflow-based
{ cat docs/research/2026-10-06-linking-rubric/linking-core-v4.md; cat <<'EOF'

## Task rubric (the reviewer reads this; tasks live on components)

1. **Covers its links.** Every feature a component builds has at least one
   task that serves it.
2. **No double work.** The same work does not appear in two components.
3. **Right shape.** Each task's `shape` (`classic/references/task-shapes.md`)
   matches the work described.

## Evidence

Tested on 8 projects / 48 features (3 real leads, 5 reference fixtures):
the core rubric found 42 of 48 links and missed no whole feature; the
review workflow's Verify phase rejected 6 of 6 wrong additions. Full
artifacts: `docs/research/2026-10-06-linking-rubric/`.
EOF
} > $W/references/linking.md
```

Check: `grep -c '^[0-9]\. \*\*' $W/references/linking.md` prints `11` (8 core + 3 task).

```bash
{ printf '# Hidden work by project type — human reference\n\nResearched add-ons for six project types (78 sources). **Not an agent input**: in testing they made the linker over-link and gave the reviewer no surviving adds. Architects read them when reviewing ARCHITECTURE.md §6 before an estimate. Source and test data: `docs/research/2026-10-06-linking-rubric/`.\n\n'; for t in web-mobile data-pipeline llm-rag public-api ml-heavy iot; do printf '\n---\n\n'; cat docs/research/2026-10-06-linking-rubric/addons/addon-$t.md; done; } > $W/references/hidden-work-by-type.md
```

- [ ] **Step 4: Write `FLOW.md`**

Create `$W/workflow-based/FLOW.md`:

```markdown
# estimate — workflow mode

You are here because `requirements.json#scopeMode` is `"workflow"`. The
business-analyst package already holds the systems, to-be workflows and
features the PO confirmed. Your job: price those features, link each to
the components that build it, and get an engineer's scores.

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

1. **Gates.** Stop with the message if any fails:
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
   and `scoreProvenance: "proposed"` (`classic/references/scoring-guide.md`
   anchors verbatim). Context factors: derive four as the classic interview
   does (`classic/references/interview.md` §4); `stackFamiliarity` is level 1
   with cite "not assessed — adjust in the exported workbook".
6. **Score review (Q2).** `node scripts/score-review.mjs --write
   estimation-inputs.json --out scores-review.html`, serve it with the
   analyze-requirements `serve.mjs`, give the URL. When the engineer pastes
   the feedback block: save it, `node scripts/score-review.mjs --read
   feedback.json --inputs estimation-inputs.json`, apply `features`,
   `components`; for each `needsReason` entry ask once in chat why; for
   each `asks` entry propose a component from §6 (or a new one, marked
   proposed) and redo steps 3–4 for that feature only.
7. **Tasks.** For every component that builds something: agentic tasks
   (`shape` from `classic/references/task-shapes.md`, `scope`,
   `seedMinutes`), and a `milestone` ("M1 - <name>", ordered). Components
   that build nothing get `notEstimated` with a reason.
8. **Compute.** `node scripts/compute.mjs --inputs estimation-inputs.json --out estimation.json`
9. **Validate.** `node scripts/validate.mjs --inputs estimation-inputs.json --json estimation.json` → exit 0.
10. **Close (Q3).** AskUserQuestion: "Estimate ready: <presented range>.
    <n> features, <m> components, milestones <list>. Assumptions: <k> (<j>
    from the BA package, <k−j> new). Anything to change?" Options: Done ·
    Change a score or a link · Add a component · Open the review page again.
    A change → edit → steps 8–9 → ask again. Pages and estimation.md come
    in spec 3; `scripts/render.mjs` says so.

## Not asked, and why

Depth, delivery mode, agent/model, scope confirm, milestones, review
channel, task approval, stack familiarity, deadline/budget, show pricing
working: each is fixed, derived, PO-confirmed already, or shown in Q3.
See the spec's §2 table.
```

- [ ] **Step 5: README and spec notes**

In `$W/README.md`, after the first paragraph, add:

```markdown
## Two flows

`SKILL.md` routes on `requirements.json#scopeMode`: `classic/` is the
interview-driven flow (today's behaviour), `workflow-based/` prices the
business-analyst features and links them to components. Shared pricing
lives in `shared/lib/`. Commands below are the classic ones; prefix
`workflow-based/` for workflow mode (`compute.mjs`, `validate.mjs`,
`score-review.mjs`).
```

and replace `scripts/` with `classic/scripts/` on the three command lines (README lines 44–46).

In the spec `docs/superpowers/specs/2026-10-06-estimate-workflow-mode-design.md`:
- §3: change "per component: `minutes`, `low`, `high`" to "per component: `hours`, `low`, `high` (agentic baselines fit hours, as classic does)".
- §8: change "`inputs-fail.json` — one breach per W-rule above." to "W-rule breaches are in-memory mutations of `inputs-pass.json` inside `schema.test.mjs` (one case per rule)."
- §1: change the `shared/` block's `references/` line to "(references stay in `classic/references`; `shared/lib/scoring.mjs` reads the guide from there)".

- [ ] **Step 6: Full suite**

Run: `npm test 2>&1 | tail -6`
Expected: `ℹ fail 0`; pass count = Task 1's N + 39 new tests (4 + 25 + 5 + 4 + 5 + 4 + gates + 1), or `skip 4` for the browser tests on a machine without Chrome.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add plugins/solution-architect/workflows plugins/solution-architect/skills/estimate docs/superpowers/specs/2026-10-06-estimate-workflow-mode-design.md
```
```bash
/usr/bin/git commit -m "feat(estimate): review-links workflow, workflow FLOW.md and rubric references" -m "The link check is a plugin workflow: one fresh reviewer, then a verifier
per proposed add. linking.md carries the core rubric that tested best;
the six project-type add-ons ship as a human reference only."
```

---

### Task 7: Eval cases for workflow mode

**Files:**
- Create: `$W/evals/fixtures/workflow-sin-kowa-mini/{requirements.json,requirements.md,ARCHITECTURE.md}`
- Modify: `$W/evals/evals.json` (append two cases, ids 3 and 4)

**Interfaces:**
- Consumes: the fixture from Task 2 and the BA md fixture; the FLOW.md from Task 6.
- Produces: eval cases `workflow-happy-path` and `workflow-gate-no-architecture`. The existing three classic cases double as the router check (a lead without `scopeMode: "workflow"` must still run classic).

- [ ] **Step 1: Build the eval fixture lead**

```bash
W=plugins/solution-architect/skills/estimate
F=$W/evals/fixtures/workflow-sin-kowa-mini
mkdir -p $F
cp $W/workflow-based/scripts/test/fixtures/requirements.json $F/requirements.json
cp plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.md $F/requirements.md
cp $W/workflow-based/scripts/test/fixtures/ARCHITECTURE-mini.md $F/ARCHITECTURE.md
```

- [ ] **Step 2: Append the two cases**

In `$W/evals/evals.json`, append to the `evals` array (keep the file valid JSON; ids continue from the last one):

```json
{
  "id": 3,
  "name": "workflow-happy-path",
  "prompt": "The BA package for sin-kowa-mini is done and the PO signed off the scope (requirements.json, requirements.md). The architecture document is in ARCHITECTURE.md — I reviewed it myself this morning. Give me the estimate.",
  "expected_output": "The skill detects scopeMode \"workflow\" and follows workflow-based/FLOW.md. It asks exactly one gate question (has a human reviewed ARCHITECTURE.md?) and, after the user says yes, links every feature to §6 components with a why each, runs the review-links workflow (or, when the Workflow tool is unavailable in this sandbox, stops with the exact /config message and writes nothing), scores the five features, writes the score review page, and ends with the closing AskUserQuestion. It never asks about depth, delivery mode, agent/model, scope confirmation, milestones, review channel, stack familiarity, deadline or budget. estimation-inputs.json carries features with ids and scores only; components carry builds, tasks and milestones.",
  "files": [
    "evals/fixtures/workflow-sin-kowa-mini/requirements.json",
    "evals/fixtures/workflow-sin-kowa-mini/requirements.md",
    "evals/fixtures/workflow-sin-kowa-mini/ARCHITECTURE.md"
  ],
  "assertions": [
    "routed-to-workflow: the reply names scopeMode workflow and never offers the classic depth question (QUICK/STANDARD/DEEP) or the delivery-mode opt-out",
    "three-questions-max: the only AskUserQuestion prompts are the architecture-reviewed gate, the score-review hand-off, and the closing \"anything to change?\"; no question about agent/model, milestones, scope confirmation, review channel, familiarity, deadline or budget",
    "workflow-or-exact-stop: either /solution-architect:review-links was invoked before scoring, or the reply contains exactly \"Workflow mode needs dynamic workflows for the link review. Turn them on in /config (Dynamic workflows), then run /estimate again.\" and no estimation-inputs.json exists",
    "features-are-ids-and-scores: when estimation-inputs.json exists, every features[] entry has id, scores (five factors with n, anchor, cite), scoreNote and scoreProvenance and none of tasks, component, milestone, provenance",
    "components-carry-the-work: when estimation-inputs.json exists, every component with builds has a non-empty why on each build, a milestone, and at least one agentic task with shape and seedMinutes; a component with no builds has notEstimated",
    "validate-clean: when estimation.json exists, `node workflow-based/scripts/validate.mjs --inputs estimation-inputs.json --json estimation.json` exits 0",
    "no-pages: no estimate.html or estimation.md was written; if render was attempted the reply says pages come in spec 3"
  ]
},
{
  "id": 4,
  "name": "workflow-gate-no-architecture",
  "prompt": "requirements.json and requirements.md for sin-kowa-mini are ready, scope is PO-approved. Estimate it.",
  "expected_output": "The skill detects scopeMode \"workflow\", finds no ARCHITECTURE.md, and stops with the message that workflow mode needs the architecture document first. It does not fall back to classic, does not ask the depth question, and writes no files.",
  "files": [
    "evals/fixtures/workflow-sin-kowa-mini/requirements.json",
    "evals/fixtures/workflow-sin-kowa-mini/requirements.md"
  ],
  "assertions": [
    "stops-at-gate: the reply says workflow mode needs the architecture document and to run it first",
    "no-classic-fallback: no QUICK/STANDARD/DEEP question, no technique menu, no clear-vs-assumed gate",
    "nothing-written: no estimation-inputs.json, estimation.json, scores-review.html or estimate.html exists after the run"
  ]
}
```

- [ ] **Step 3: Validate the JSON and run the two cases**

Run: `node -e "const j=require('./plugins/solution-architect/skills/estimate/evals/evals.json'); console.log(j.evals.length, j.evals.map(e=>e.name).join(', '))"`
Expected: `5 gate-check-thin-evidence, …, workflow-happy-path, workflow-gate-no-architecture`

Run the new cases only (one at a time keeps each under about a dollar):

```bash
claude plugin eval plugins/solution-architect --skill estimate --case 'workflow-gate-no-architecture'
```
```bash
claude plugin eval plugins/solution-architect --skill estimate --case 'workflow-happy-path'
```

(If the CLI's flag names differ on this version, `claude plugin eval --help` shows them; the memory note from earlier sessions says `--case <glob>` makes a single-case run cheap.)

Expected: both cases pass. If `workflow-happy-path` ends at the "Workflow tool unavailable" stop, that is a pass of `workflow-or-exact-stop`; record in the task report that the sandbox had no Workflow tool, so the review phase was not exercised by the eval.

Then confirm the router did not disturb classic:

```bash
claude plugin eval plugins/solution-architect --skill estimate --case 'gate-check-thin-evidence'
```
Expected: passes as before.

- [ ] **Step 4: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/estimate/evals
```
```bash
/usr/bin/git commit -m "test(estimate): eval cases for workflow mode" -m "Happy path (three questions, features as ids and scores, components carry
the work, validate clean) and the no-architecture gate. The existing classic
cases double as the router check."
```

---

## Self-review notes

- Spec coverage: §1 → Task 1; §2 → Task 6 FLOW.md; §3 → Tasks 2–4; §4 → Task 6 references; §5 → Task 6 workflow; §6 → Task 3; §7 → Task 5; §8 → Tasks 2–5 tests + Task 7 evals; §9 untouched.
- Evaluation: Task 7 adds two `claude plugin eval` cases (happy path, no-architecture gate); the three classic cases double as the router check. The review workflow itself is not unit-testable (it runs agents); its design evidence is in `docs/research/2026-10-06-linking-rubric/`, and the happy-path eval exercises it when the sandbox exposes the Workflow tool.
- Three deviations recorded in Task 6 Step 5 (hours not minutes; in-test cases not `inputs-fail.json`; references stay in `classic/`).
- Names used across tasks: `loadPair`, `checkWorkflowInputs`, `computeWorkflowEstimation`, `mainBuilder`, `pageData`, `toHtml`, `diffLinks`, `applyLinks`, `readFeedback` — each defined once and imported by that name.
