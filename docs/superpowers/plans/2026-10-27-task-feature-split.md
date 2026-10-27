# Component tasks split by feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Component-based estimate page, expanding a component under a feature card shows only the tasks that serve that feature, and the card's hours count only those tasks. The xlsx export puts each task under a feature it serves.

**Bug (user, 2026-10-27):** "Feature A has 2 components Web and API. When expand Web in feature A it shows all tasks of Web not divide by feature. Feature B has same 2 components Web and API, expand either WEB or API show the same with feature A."

**Root cause:** a workflow-mode task (`components[].tasks[]`) records no feature. The page reads `TASKS[component]` (`tasksHtml(b)` in `assets/score-review.html`), so every card a component appears on lists all its tasks and claims all its hours. The task rubric already says "every feature a component builds has at least one task that serves it" (`references/linking.md`), but no field stores that link, so nothing checks it. Same gap: `xlsx-rows.mjs` puts all of a component's tasks under its first feature.

**Fix (user chose option A):** every task gets a required `features: ["FEAT-…"]`. The project price does not change: it comes from feature scores only (`rollup.mjs` → `featurePrice`/`projectPrice`). Task hours are a cross-check.

**Tech Stack:** Node ESM, `node:test`, plain browser JS in HTML templates, headless Chrome via `analyze-requirements/scripts/lib/cdp.mjs`.

All paths below are under `plugins/solution-architect/skills/estimate/workflow-based/` unless they start with `plugins/` or `docs/`.

## Global Constraints

- Field: `features` on each component task: a non-empty array of feature ids, each one in the component's `builds`. No default, no fallback for old inputs (option A): an old `estimation-inputs.json` fails validation with a clear message and the agent adds the field.
- A task shared by k features is listed on each of those feature cards, marked `shared with <other ids> · 1/k of its hours counted here`, and contributes `expected / k` hours to each card. So the card hours add up to the project total.
- The summary total (all tasks, each once) and the project price are unchanged.
- System subtotal: the hours of the tasks serving at least one of that system's features, each task counted once.
- xlsx: each task appears once, under the first feature (in `inputs.features` order) that its `features` lists.
- Never edit `assets/score-review.html` or `assets/estimate-components.html` by hand. Change the builders/template files, then regenerate; `build-template.test.mjs` and `build-pages.test.mjs` pin the assets byte for byte.
- Template script gate (`quality-gates.test.mjs`, `TEMPLATE_LIMITS`): ≤22 lines per function, ≤3 params. Repo gates for `.mjs`: ≤20 lines/function, ≤3 params, nesting ≤2, ≤200 lines and ≤10 functions per file. No apostrophes inside template literals in template JS.
- Classic mode is untouched (its tasks live on features). `shared/lib/agentic-task-schema.mjs` stays shared and unchanged; the new check goes in `scripts/lib/schema-components.mjs`.
- Commits: Conventional Commits, subject ≤50 chars, no AI attribution trailers.
- Version: solution-architect 3.2.1 → 3.3.0 (a new required input field) in `plugins/solution-architect/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Do not push (a plugin.json change on main publishes).

## Review Focus

1. The sum of all feature cards' hours equals the summary total, give or take rounding (the browser test asserts it).
2. A component on a feature card with no task for that feature cannot happen: the validator refuses it (W8 "no task serves it"). The page doesn't need to handle it.
3. The read-only score review (`score-review.html`, not FINAL) draws no tasks. Its asset must not change except where the builder chain forces it. Expect `score-review.html` byte-identical; only `estimate-components.html` changes.
4. The project price in `estimation.json` is identical before and after for the fixture (assert in Task 1).

---

### Task 1: Require `features` on every component task

**Files:**
- Modify: `scripts/lib/schema-components.mjs`
- Modify: `scripts/test/fixtures/inputs-pass.json` (add `features` to all 8 tasks)
- Test: `scripts/test/schema.test.mjs` (3 new CASES), `scripts/test/rollup.test.mjs` (price unchanged)

Fixture assignment (`inputs-pass.json`):

| component | task | features |
|---|---|---|
| api.stage | stage-engine | `["FEAT-001", "FEAT-002"]` |
| api.stage | stage-tests | `["FEAT-001"]` |
| api.orders | orders-impl | `["FEAT-003"]` |
| api.billing | billing-match, billing-docs | `["FEAT-005"]` |
| office | office-screens | `["FEAT-001", "FEAT-003", "FEAT-005"]` |
| worker.notify | notify-impl | `["FEAT-002"]` |
| worker.drafter | drafter-impl | `["FEAT-004"]` |

- [ ] **Step 1: Write the failing tests.** Add to `CASES` in `schema.test.mjs`:

```js
  ['W8 task without features', (i) => { delete comp(i, 'api.stage').tasks[0].features; }, 'task stage-engine: features must list the features it serves'],
  ['W8 task serves an unbuilt feature', (i) => { comp(i, 'api.stage').tasks[1].features = ['FEAT-003']; }, 'task stage-tests: serves FEAT-003, which api.stage does not build'],
  ['W8 build no task serves', (i) => { for (const t of comp(i, 'api.stage').tasks) t.features = ['FEAT-001']; }, 'component api.stage: builds FEAT-002 but no task serves it'],
```

  Before adding the fixture field, run `node --test scripts/test/schema.test.mjs`: the 3 new cases FAIL (no such message). Then add `features` to the fixture per the table. "the fixture is valid" must still pass.

  In `rollup.test.mjs` add: compute the fixture with and without the `features` fields (strip them from a clone) and `assert.deepEqual` the two `computed.price` blocks.

- [ ] **Step 2: Implement.** In `schema-components.mjs`, add and call from `checkWork` right after the per-task `checkAgenticTask` loop:

```js
// Each task names the features it serves, out of the component's builds; every
// build has at least one task (the task rubric's "covers its links").
function checkTaskFeatures(c, out) {
  const builds = new Set(c.builds.map((b) => b.feature));
  const served = new Set();
  for (const t of c.tasks ?? []) {
    if (!Array.isArray(t.features) || !t.features.length) { out.push(`task ${t.id}: features must list the features it serves`); continue; }
    for (const f of t.features) (builds.has(f) ? served.add(f) : out.push(`task ${t.id}: serves ${f}, which ${c.id} does not build`));
  }
  for (const f of builds) if (!served.has(f) && c.tasks?.length) out.push(`component ${c.id}: builds ${f} but no task serves it`);
}
```

  Keep the nesting at ≤2 (split a helper if the gate complains).

- [ ] **Step 3: Verify.** `node --test scripts/test/schema.test.mjs scripts/test/rollup.test.mjs` → PASS. Then `npm test` at the repo root: other suites that stage `inputs-pass.json` must still pass. Fix any test that builds tasks by hand by adding `features`.
- [ ] **Step 4: Commit** `fix(estimate): tasks name the features they serve`.

### Task 2: Carry `features` to the page data and the workbook

**Files:**
- Modify: `scripts/lib/page-html.mjs` (`taskTable`: 7th element)
- Modify: `scripts/lib/xlsx-rows.mjs` (owner per task, not per component; update the header comment)
- Test: `scripts/test/xlsx-rows.test.mjs`, new `scripts/test/page-html.test.mjs`

- [ ] **Step 1: Write the failing tests.**

  `page-html.test.mjs`: load the fixture pair, compute, call `taskTable(est)`. Assert `out['api.stage'].map((x) => x[6])` deep-equals `[['FEAT-001', 'FEAT-002'], ['FEAT-001']]`.

  `xlsx-rows.test.mjs`: extend the helper to `rows(editReq, editInputs)` (apply `editInputs(inputs)` before computing). Replace the test "every task appears once, under the first feature its component builds" with:

```js
test('every task appears once, under the first feature it serves', () => {
  const r = rows(undefined, (i) => { i.components.find((c) => c.id === 'api.stage').tasks[1].features = ['FEAT-002']; });
  const all = r.flatMap((x) => x.tasks.map((t) => t.name));
  assert.equal(all.length, 8);
  assert.equal(new Set(all).size, 8);
  assert.deepEqual(r[0].tasks.map((t) => t.name), ['Stage transitions with audit', 'Orders, quotes and invoicing screens']);
  assert.deepEqual(r[1].tasks.map((t) => t.name), ['Transition tests', 'Alert delivery']);
});
```

  Run both: they FAIL (no 7th element; Transition tests still under FEAT-001).

- [ ] **Step 2: Implement.** `taskTable`: append `t.features` as the 7th element; update the comment to `[name, low, expected, high hours, confidence, assumptions, features]`. `xlsx-rows.mjs`: replace `taskOwners`/`taskRows` so the owner is chosen per task: `inputs.features.find((f) => t.features.includes(f.id))`, keeping component roster order then task order within a feature.
- [ ] **Step 3: Verify.** Both tests PASS; `npm test` green (the `pages-browser.test.mjs` workbook test still counts 8 task rows).
- [ ] **Step 4: Commit** `fix(estimate): workbook puts tasks under their feature`.

### Task 3: Component-based page filters tasks and hours by feature

**Files:**
- Create: `scripts/template/feature-tasks.js`
- Modify: `scripts/build-components-template.mjs`
- Regenerate: `assets/estimate-components.html` (`node scripts/build-components-template.mjs`)
- Test: new `scripts/test/feature-tasks-browser.test.mjs` (`pages-browser.test.mjs` is already over 200 lines)

The page code lives in `assets/score-review.html` (built from `docs/mockups/estimate-workflow-mode/score-review.body.html` by `build-template.mjs`), and `build-components-template.mjs` turns it into the FINAL page with `rep()`. All changes here are `rep()`s in the components builder, because only the FINAL page draws tasks. The targets in `assets/score-review.html` today:

```js
// ---- components: tasks and hours (Component-based page only) ----
const pert = ([, o, m, pp]) => (o + 4 * m + pp) / 6;
const hoursOf = (id) => …;
function tasksHtml(b) { … }                                   // ends with </table></details>`;\n}
…compRow: ${FINAL ? `<span class="chrs">${hoursOf(bid)}h</span>` : ''}
…paintBuilt: if (FINAL) { const h = by.reduce((n, b) => n + hoursOf(b), 0); … ${by.map((b) => tasksHtml(compById[b])).join('')}
…totals: const hrs = FINAL ? new Set(s.features.flatMap((c) => buildersOf(c.id))) : null;
         ${[...hrs].reduce((n, b) => n + hoursOf(b), 0).toLocaleString('en-US')}h</b><span>${hrs.size} components, each counted once</span>
```

- [ ] **Step 1: Write the failing test** `feature-tasks-browser.test.mjs` (skip without Chrome, like `also-builds-browser.test.mjs`), using `componentsPage(mutate)` from `./stage.mjs` with `stage-tests.features = ['FEAT-002']`:
  1. `#c-FEAT-001` → its `details.tasks` whose summary starts with `Stage Engine` lists exactly `['Stage transitions with audit']`.
  2. `#c-FEAT-002` → Stage Engine lists `['Stage transitions with audit', 'Transition tests']`, and the first row's text contains `shared with FEAT-001`.
  3. The sum of every `[data-hrs]` card value equals the summary's expected-effort hours within ±5 (rounding per card and component).
  4. `page.errors` is `[]`.

  Run it: 1–3 FAIL today.

- [ ] **Step 2: Create `scripts/template/feature-tasks.js`:**

```js
// ---- components: tasks and hours, per feature (Component-based page only) ----
// TASKS[component]: [name, low, expected, high, confidence, assumptions, features].
// A task shared by k features counts 1/k of its hours on each card, so the
// cards add up to the project total.
const pert = (x) => x[2]; // expected hours from estimation.json (agentic baselines)
const hoursOf = (id) => Math.round((TASKS[id] || []).reduce((n, x) => n + pert(x), 0));
const tasksFor = (id, capId) => (TASKS[id] || []).filter((x) => x[6].includes(capId));
const hoursFor = (id, capId) => Math.round(tasksFor(id, capId).reduce((n, x) => n + pert(x) / x[6].length, 0));
const sysHours = (ids) => Math.round(COMPS.flatMap((b) => TASKS[b.id] || []).filter((x) => x[6].some((f) => ids.includes(f))).reduce((n, x) => n + pert(x), 0));
function sharedNote(x, capId) {
  const others = x[6].filter((f) => f !== capId);
  return others.length ? `<div class="dim">shared with ${others.map(esc).join(', ')} · 1/${x[6].length} of its hours counted here</div>` : '';
}
function taskRow(x, capId) {
  const note = x[5] ? `<div class="dim">${esc(x[5])}</div>` : '';
  return `<tr><td>${esc(x[0])}${note}${sharedNote(x, capId)}</td><td class="r">${x[1]} / ${x[2]} / ${x[3]}</td><td class="r"><b>${Math.round(pert(x))}h</b></td><td><span class="conf c-${x[4]}">${x[4]}</span></td></tr>`;
}
function tasksHtml(b, capId) {
  const ts = tasksFor(b.id, capId);
  return `<details class="tasks side-effort"><summary>${esc(b.name)} · ${ts.length} tasks · ${hoursFor(b.id, capId)}h for this feature</summary><table><tr><th>Task</th><th class="r">Low / Expected / High h</th><th class="r">Expected</th><th>Confidence</th></tr>${ts.map((x) => taskRow(x, capId)).join('')}</table></details>`;
}
```

- [ ] **Step 3: Builder `rep()`s** in `build-components-template.mjs`:
  - Replace the block from `// ---- components: tasks and hours (Component-based page only) ----` through the end of `tasksHtml` (regex up to `</table></details>\`;\n}\n`) with `readFileSync(at('./template/feature-tasks.js'), 'utf8')`.
  - Delete the two existing `rep()`s for `const pert = ([, o, m, pp]) …` and `<th class="r">O / M / P h</th>`. The new block replaces both, so they would throw "nothing matched".
  - `<span class="chrs">${hoursOf(bid)}h</span>` → `<span class="chrs">${hoursFor(bid, capId)}h</span>`.
  - `by.reduce((n, b) => n + hoursOf(b), 0)` → `by.reduce((n, b) => n + hoursFor(b, capId), 0)`.
  - `tasksHtml(compById[b])` → `tasksHtml(compById[b], capId)`.
  - `${[...hrs].reduce((n, b) => n + hoursOf(b), 0).toLocaleString('en-US')}h</b><span>${hrs.size} components, each counted once</span>` → `${sysHours(s.features.map((c) => c.id)).toLocaleString('en-US')}h</b><span>${hrs.size} components, each task counted once</span>`.
  - Leave the summary (`COMPS.reduce((n, b) => n + hoursOf(b.id), 0)`, "each component counted once") as it is.

- [ ] **Step 4: Regenerate and verify.** `node scripts/build-components-template.mjs`; `git diff --stat` shows `assets/estimate-components.html` changed and `assets/score-review.html` unchanged. Run `node --test scripts/test/feature-tasks-browser.test.mjs scripts/test/build-pages.test.mjs scripts/test/quality-gates.test.mjs scripts/test/pages-browser.test.mjs scripts/test/also-builds-browser.test.mjs` → PASS, then `npm test`. (Known flake: estimate `browser.test` "opening a system switches the cards" fails sometimes in full runs and passes alone.)
- [ ] **Step 5: Commit** `fix(estimate): feature cards show only their tasks`.

### Task 4: Agent instructions, proposal fixture, changelog, version

**Files:**
- Modify: `FLOW.md` step 7, `references/linking.md` task rubric #1
- Modify: `plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini/estimation-inputs.json`; regenerate `estimation.json` beside it
- Modify: `CHANGELOG.md` (repo root, `## Unreleased`), `plugins/solution-architect/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

- [ ] **Step 1: FLOW.md step 7.** After "agentic tasks (`shape` …, `scope`, `seedMinutes`)" add: "and `features`, the features this task serves, taken from the component's `builds`. A task for several features lists them all. Every feature the component builds needs at least one task."
- [ ] **Step 2: linking.md rubric #1** becomes: "**Covers its links.** Each task lists the features it serves in `features`; every feature a component builds has at least one task that lists it (the validator enforces both)."
- [ ] **Step 3: Proposal fixture.** Add `features` to its 8 tasks using the same table as Task 1 (the ids match). Regenerate: `node plugins/solution-architect/skills/estimate/workflow-based/scripts/compute.mjs --inputs <fixture>/estimation-inputs.json --out <fixture>/estimation.json`, then run `validate.mjs` on it → exit 0. `git diff` on `estimation.json` should show only the `inputs` copy changing; `computed` stays the same.
- [ ] **Step 4: CHANGELOG** under `## Unreleased` → `### Fixed`: "Component-based estimate: a feature card now lists only the tasks that serve that feature, and its hours count only those (a task shared by several features counts a share on each). Each component task needs a `features` list; older `estimation-inputs.json` files fail validation until it is added. The price does not change." Bump solution-architect to 3.3.0 in both manifests.
- [ ] **Step 5: Verify.** `npm test` at the repo root → all pass (known flake aside).
- [ ] **Step 6: Commit** `fix(estimate): document task features, bump 3.3.0`.

## Done when

- `npm test` green.
- Manual check by the user (stop here, do not merge): render the Sin Kowa lead (or the fixture) and open `estimate-components.html`. Under Feature A, Web shows only A's tasks; under Feature B, only B's; shared tasks say so; card hours add up to the summary total.
