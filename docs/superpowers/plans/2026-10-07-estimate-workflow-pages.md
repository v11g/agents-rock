# Estimate workflow mode — pages and workbook export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace workflow mode's `render.mjs` stub with two internal pages — `estimate.html` (Workflow-based) and `estimate-components.html` (Component-based, with the v2 workbook export) — written into `<lead>/dist/` beside the architecture viewer.

**Architecture:** Node computes every number the pages print (`lib/page-view.mjs`, `lib/xlsx-rows.mjs`) and embeds it as one `page-data` JSON block; the templates only format. Both templates are built from the approved mockups by `rep()`-style builders pinned byte-for-byte by tests, like spec 2's `build-template.mjs`. Classic's xlsx export moves, unchanged in behaviour, into `shared/assets/xlsx-export.js` behind a three-function seam (`XLSX_SOURCE`).

**Tech Stack:** Node ≥ 20 ESM, `node:test`, no npm deps; headless Chrome via `analyze-requirements/scripts/lib/cdp.mjs` for browser tests.

**Spec:** `docs/superpowers/specs/2026-10-07-estimate-workflow-pages-design.md` (spec 3 of 4). Spec 2 code is merged at `de64fdc`; read `docs/superpowers/specs/2026-10-06-estimate-workflow-mode-design.md` for the data shape.

Paths below: `E = plugins/solution-architect/skills/estimate`, `W = $E/workflow-based`. Run every command from the worktree root.

## Global Constraints

- Both pages are internal; no `--client-only`, no redaction, no `estimation.md` (spec E1, E2).
- `exclusions: string[]` lives only in `estimation-inputs.json`; `requirements.json` is read, never written (E3).
- Pages render into the `--out` folder (the lead's `dist/`); Component-based C2/C3 links point at `index.html#panel-containers` and `index.html#panel-components-<containerId>` (E4).
- The classic export keeps its 4 tabs and its formulas; classic behaviour does not change (E6). Classic tests that assert behaviour (`xlsx-export.test.mjs`, `browser.test.mjs`, `e2e.test.mjs`) are not edited.
- Pages compute no price: every amount comes from `estimation.json` via `page-view.mjs`.
- Size gates: modules ≤ 200 lines, ≤ 10 functions, ≤ 22 lines per function, ≤ 3 params; template scripts ≤ 22 lines per function, ≤ 3 params (`quality-gates.test.mjs`).
- Never `git stash`; `/usr/bin/git`, one command per Bash call. Conventional Commits, no AI attribution lines.
- TDD: each test fails before the code that makes it pass.

## Review Focus

1. **A component that builds features but is no feature's main builder** (fixture: `office`) — its tasks must still reach the workbook's Task Breakdown. Pinned in Task 4.
2. **Currency other than USD** — prices read `SGD 39,000`, not `$39,000`. Pinned in Task 8 (browser).
3. **No tasks anywhere (zero hours)** — the cross-check shows `—`, not `Infinity`/`NaN`. Pinned in Task 2.
4. **`requirements.json` without `scope.out`, inputs without `exclusions`** — the exclusions list is empty, no crash. Pinned in Task 2.
5. **`dist/index.html` missing** — both pages still written, one warning line. Pinned in Task 8.

---

## File map

| File | Status | Responsibility |
| --- | --- | --- |
| `$W/scripts/lib/rollup.mjs` | modify | per-task `low`/`high` hours in `computed` |
| `$W/scripts/lib/schema.mjs` | modify | W12 `exclusions` shape |
| `$W/scripts/lib/page-view.mjs` | create | price, milestone and register views for both pages |
| `$E/shared/assets/xlsx-export.js` | create (moved) | the v2 workbook export, page-agnostic |
| `$E/classic/assets/estimate-template.html` | modify | export block → seam + `<!-- slot:XLSX -->` |
| `$E/classic/scripts/render.mjs` | modify | fills the XLSX slot |
| `$W/scripts/lib/xlsx-rows.mjs` | create | workflow data → classic export rows |
| `$W/scripts/template/arch-link.js` | create | C2/C3 links from the roster, not Sin Kowa names |
| `$W/scripts/lib/score-html.mjs` | modify | exports `systemData`, `MATH_EXPORTS`; page data gains `arch`, `c3` |
| `$W/scripts/build-template.mjs` | modify | uses `arch-link.js` |
| `$W/scripts/template/view.js` | create | renders Summary, Milestones, register, Method from `PAGE` |
| `$W/scripts/template/prelude.js` | create | Workflow page's `PAGE`, `DATA`, `$`, `esc` |
| `$W/scripts/build-workflow-template.mjs` | create | `assets/estimate-template.html` from `estimate.src.html` |
| `$W/scripts/build-components-template.mjs` | create | `assets/estimate-components.html` from `assets/score-review.html` |
| `$W/scripts/lib/pair-findings.mjs` | create | shared validation for `validate.mjs` and `render.mjs` |
| `$W/scripts/lib/page-html.mjs` | create | fills both templates |
| `$W/scripts/render.mjs` | replace | writes both pages |
| `$W/FLOW.md`, `$E/README.md`, `$E/evals/evals.json` | modify | steps 6, 10, 11; eval assertions |

---

### Task 1: Per-task hours and the exclusions field

**Files:**
- Modify: `$W/scripts/lib/rollup.mjs` (`componentRow`)
- Modify: `$W/scripts/lib/schema.mjs`
- Modify: `$W/scripts/test/fixtures/inputs-pass.json`
- Test: `$W/scripts/test/rollup.test.mjs`, `$W/scripts/test/schema.test.mjs`

**Interfaces:**
- Produces: `computed.components[id].tasks[taskId] = { e, low, high, sigma, confidence, calibrated, matchLevel }` (hours, rounded to 2 dp). `inputs.exclusions?: string[]`. Finding text `exclusions must be a list of non-empty strings`.

- [ ] **Step 1: Write the failing tests**

Append to `$W/scripts/test/rollup.test.mjs`:

```js
test('each task carries its low and high hours beside the expected', () => {
  const { inputs, req } = loadPair(fx);
  const t = computeWorkflowEstimation(inputs, req, []).computed.components['api.billing'].tasks['billing-match'];
  assert.equal(t.low, 1);   // seed o 60 min, uncalibrated
  assert.equal(t.e, 2.17);  // PERT of 60/120/240 min
  assert.equal(t.high, 4);  // seed p 240 min
});
```

In `$W/scripts/test/schema.test.mjs`, add two rows at the end of `CASES` (before the closing `];`):

```js
  ['W12 exclusions not a list', (i) => { i.exclusions = 'hosting'; }, 'exclusions must be a list of non-empty strings'],
  ['W12 empty exclusion', (i) => { i.exclusions = ['']; }, 'exclusions must be a list of non-empty strings'],
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test $W/scripts/test/rollup.test.mjs $W/scripts/test/schema.test.mjs`
Expected: FAIL — `t.low` is `undefined`; the two W12 cases report no matching finding.

- [ ] **Step 3: Implement**

In `$W/scripts/lib/rollup.mjs`, `componentRow`, replace the `tasks[task.id] = …` line with:

```js
    tasks[task.id] = { e: round2(a.e), low: round2(a.lowH), high: round2(a.highH), sigma: round2(a.sigma), confidence: a.confidence, calibrated: a.calibrated, matchLevel: a.matchLevel };
```

In `$W/scripts/lib/schema.mjs`, add after `checkAssumptions`:

```js
// Commercial exclusions the BA never writes (hosting, support, security testing);
// the page lists them after requirements.json scope.out (spec 3 E3).
function checkExclusions(inputs, out) {
  if (!('exclusions' in inputs)) return;
  if (!(Array.isArray(inputs.exclusions) && inputs.exclusions.every(nonEmpty))) out.push('exclusions must be a list of non-empty strings');
}
```

and call it in `checkWorkflowInputs` after `checkAssumptions(inputs, out);`:

```js
  checkExclusions(inputs, out);
```

In `$W/scripts/test/fixtures/inputs-pass.json`, add after the `"assumptions": [ … ]` array (add a comma after its closing `]`):

```json
  "exclusions": ["Hosting and third-party subscription fees"]
```

- [ ] **Step 4: Run the workflow suite**

Run: `node --test $W/scripts/test/*.test.mjs`
Expected: PASS, `ℹ fail 0` (browser tests may skip without Chrome).

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add $W/scripts/lib/rollup.mjs $W/scripts/lib/schema.mjs $W/scripts/test/fixtures/inputs-pass.json $W/scripts/test/rollup.test.mjs $W/scripts/test/schema.test.mjs
/usr/bin/git commit -m "feat(estimate): task hour range and exclusions in workflow mode"
```

---

### Task 2: Page views — price, milestones, register

**Files:**
- Create: `$W/scripts/lib/page-view.mjs`
- Test: `$W/scripts/test/page-view.test.mjs`

**Interfaces:**
- Consumes: `estimation.json` shape from spec 2 + Task 1; `req` from `loadRequirements` (`req.raw.scope.out`).
- Produces:
  - `priceView(est) → { price, featureCount, context: [{key, label, level, anchor, multiplier}], overheads: [{label, pct, amount}], avgUnc, avgRisk, effort: {components, tasks, hours, rate|null} }`
  - `milestoneView(est) → [{ name, title, features: [{id, name, system}], components, share, low, high }]`, ordered M1 < M2 < M10
  - `registerView(est, req) → { assumptions: string[], exclusions: string[] }` (scope.out first, then inputs.exclusions)

- [ ] **Step 1: Write the failing test**

Create `$W/scripts/test/page-view.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { computeWorkflowEstimation } from '../lib/rollup.mjs';
import { priceView, milestoneView, registerView } from '../lib/page-view.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));
function estimate(mutate) {
  const { inputs, req } = loadPair(fx);
  if (mutate) mutate(inputs, req);
  return { est: computeWorkflowEstimation(inputs, req, []), req };
}

test('priceView: the computed price, five context rows, eight overhead lines, effort', () => {
  const { est } = estimate();
  const v = priceView(est);
  assert.equal(v.price.presentLow, est.computed.price.presentLow);
  assert.equal(v.featureCount, 5);
  assert.deepEqual(v.context.map((c) => c.key), ['codebaseMaturity', 'stackFamiliarity', 'specQuality', 'compliance', 'clientDecisions']);
  assert.deepEqual(v.context[2], { key: 'specQuality', label: 'Specification quality', level: 3, anchor: 'Outline or slide deck', multiplier: 1.2 });
  assert.equal(v.overheads.length, 8);
  assert.equal(v.overheads.at(-1).label, 'Cross-feature integration');
  assert.deepEqual({ components: v.effort.components, tasks: v.effort.tasks }, { components: 6, tasks: 8 });
  assert.equal(v.avgUnc, 3);
});

test('priceView: no tasks anywhere → zero hours and no implied rate', () => {
  const { est } = estimate((i) => { for (const c of i.components) c.tasks = []; });
  assert.equal(priceView(est).effort.hours, 0);
  assert.equal(priceView(est).effort.rate, null);
});

test('milestoneView: features land with their main builder, in milestone order', () => {
  const { est } = estimate();
  const ms = milestoneView(est);
  assert.deepEqual(ms.map((m) => m.name), ['M1 - Walking skeleton', 'M2 - Money', 'M3 - Operations']);
  assert.deepEqual(ms.map((m) => m.features.map((f) => f.id)), [['FEAT-001', 'FEAT-003'], ['FEAT-002', 'FEAT-005'], ['FEAT-004']]);
  assert.equal(ms[0].title, '1. Walking skeleton');
  assert.ok(Math.abs(ms.reduce((n, m) => n + m.share, 0) - 1) < 0.02);
  assert.ok(ms[2].low > 0 && ms[2].low < ms[2].high && ms[2].high < est.computed.price.presentHigh);
});

test('registerView: assumptions as text; exclusions = scope.out then inputs.exclusions', () => {
  const { est, req } = estimate();
  const r = registerView(est, req);
  assert.equal(r.assumptions.length, 2);
  assert.deepEqual(r.exclusions, ['last-mile delivery tracking', 'Hosting and third-party subscription fees']);
});

test('registerView: no scope.out and no exclusions → empty list', () => {
  const { est, req } = estimate((i, r) => { delete i.exclusions; delete r.raw.scope; });
  assert.deepEqual(registerView(est, req).exclusions, []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test $W/scripts/test/page-view.test.mjs`
Expected: FAIL with `Cannot find module '…/lib/page-view.mjs'`.

- [ ] **Step 3: Implement**

Create `$W/scripts/lib/page-view.mjs`:

```js
// Everything the two estimate pages print, computed here so the pages only
// format numbers and never derive a price (the classic page's rule too).
import { CONTEXT_FACTORS } from '../../../shared/lib/project-price.mjs';
import { round2 } from '../../../shared/lib/estimate-math.mjs';

const CTX_LABEL = {
  codebaseMaturity: 'Codebase maturity', stackFamiliarity: 'Stack & domain familiarity', specQuality: 'Specification quality',
  compliance: 'Compliance & data sensitivity', clientDecisions: 'Client decision structure',
};
const OVH_LABEL = {
  foundation: 'Shared foundation & scaffolding', discovery: 'Discovery & specification', ux: 'UX / UI design', qa: 'QA & user acceptance testing',
  devops: 'DevOps, environments & release', docs: 'Documentation & handover', pm: 'Project management & client comms', integration: 'Cross-feature integration',
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const byMilestone = (a, b) => a.localeCompare(b, undefined, { numeric: true });

function contextRows(inputs) {
  return Object.keys(CONTEXT_FACTORS).map((key) => {
    const level = inputs.contextLevels[key];
    return { key, label: CTX_LABEL[key], level, anchor: inputs.contextProvenance?.[key]?.anchor ?? '', multiplier: CONTEXT_FACTORS[key][level - 1] ?? 1 };
  });
}

function overheadRows(price) {
  return Object.entries(price.overheads.lines).map(([key, pct]) => ({ label: OVH_LABEL[key] ?? key, pct, amount: round2(price.adjustedBase * pct) }));
}

// Hours once per component: a shared component is listed under several
// features but built once.
function effort(computed) {
  const comps = Object.values(computed.components).filter((c) => c.builds.length);
  const hours = round2(comps.reduce((n, c) => n + c.hours, 0));
  const tasks = comps.reduce((n, c) => n + Object.keys(c.tasks).length, 0);
  return { components: comps.length, tasks, hours, rate: hours ? round2(computed.price.p50 / hours) : null };
}

export function priceView(est) {
  const { inputs, computed } = est;
  const avg = (k) => round2(mean(inputs.features.map((f) => f.scores[k].n)));
  return {
    price: computed.price, featureCount: inputs.features.length, context: contextRows(inputs),
    overheads: overheadRows(computed.price), avgUnc: avg('unc'), avgRisk: avg('risk'), effort: effort(computed),
  };
}

// A milestone's range is its share of the feature build applied to the
// presented range — the mockup's rule.
function milestoneRow(name, feats, computed) {
  const mine = feats.filter(([, f]) => f.milestone === name);
  const total = computed.price.featurePoints;
  const share = total ? mine.reduce((n, [, f]) => n + f.point, 0) / total : 0;
  return {
    name, title: name.replace(/^M(\d+) - /, '$1. '),
    features: mine.map(([id, f]) => ({ id, name: f.name, system: f.system })),
    components: Object.values(computed.components).filter((c) => c.milestone === name && c.builds.length).length,
    share: round2(share), low: round2(computed.price.presentLow * share), high: round2(computed.price.presentHigh * share),
  };
}

export function milestoneView(est) {
  const feats = Object.entries(est.computed.features);
  const names = [...new Set(feats.map(([, f]) => f.milestone).filter(Boolean))].sort(byMilestone);
  return names.map((name) => milestoneRow(name, feats, est.computed));
}

export function registerView(est, req) {
  return {
    assumptions: (est.inputs.assumptions ?? []).map((a) => a.text),
    exclusions: [...(req.raw.scope?.out ?? []), ...(est.inputs.exclusions ?? [])],
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test $W/scripts/test/page-view.test.mjs $W/scripts/test/quality-gates.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add $W/scripts/lib/page-view.mjs $W/scripts/test/page-view.test.mjs
/usr/bin/git commit -m "feat(estimate): price, milestone and register views for workflow pages"
```

---

### Task 3: Move the classic xlsx export into `shared/assets/xlsx-export.js`

**Files:**
- Create: `$E/shared/assets/xlsx-export.js` (generated by the one-off script below, then committed)
- Modify: `$E/classic/assets/estimate-template.html` (export block)
- Modify: `$E/classic/scripts/render.mjs` (XLSX slot)
- Modify: `$E/classic/scripts/test/render.test.mjs` (slot list only), `$E/classic/scripts/test/references.test.mjs` (where the workbook bytes are read)
- Modify: `$W/scripts/test/quality-gates.test.mjs` (gate the shared file)

**Interfaces:**
- Produces: a script that expects, before it runs, `const XLSX_SOURCE = { rows: () => Row[], container: (row) => string, levels: () => contextLevels }`, and defines `window.__buildWorkbook()` (base64) and `window.__downloadXlsx()`. `Row = { name, scores?: {tech|size|deps|unc|risk: {n, anchor, cite}}, scoreNote, provenance, scoreProvenance, milestone, tasks: [{name, category, o, m, p, confidence, assumptions: string[]}] }`.

- [ ] **Step 1: Record the classic baseline**

Run: `node --test $E/classic/scripts/test/*.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail|skipped)'`
Write the four numbers down; Step 6 must match them exactly.

- [ ] **Step 2: Write the failing tests**

In `$E/classic/scripts/test/render.test.mjs`, change the slot test's name and list:

```js
test('template carries exactly the six slots and no external URLs', () => {
  const markers = [...tpl().matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(markers)], ['DATA', 'FONTS', 'GUIDE', 'TITLE', 'VIEWER', 'XLSX']);
```

(leave the rest of that test as it is).

In `$E/classic/scripts/test/references.test.mjs`, `rollupDefinitions()`, change the file it reads:

```js
  const html = readFileSync(new URL('../../../shared/assets/xlsx-export.js', import.meta.url), 'utf8');
```

In `$W/scripts/test/quality-gates.test.mjs`, append:

```js
const xlsxExport = new URL('../../../shared/assets/xlsx-export.js', import.meta.url).pathname;
test('gates: shared/assets/xlsx-export.js', () => {
  assert.deepEqual(violations(readFileSync(xlsxExport, 'utf8'), TEMPLATE_LIMITS), []);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `node --test $E/classic/scripts/test/render.test.mjs $E/classic/scripts/test/references.test.mjs $W/scripts/test/quality-gates.test.mjs`
Expected: FAIL — slot list lacks `XLSX`; `ENOENT … xlsx-export.js` twice.

- [ ] **Step 4: Extract the block**

Save as `$TMPDIR/extract-xlsx.mjs` (scratch, not committed) and run `node $TMPDIR/extract-xlsx.mjs` from the worktree root:

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const E = 'plugins/solution-architect/skills/estimate';
const T = `${E}/classic/assets/estimate-template.html`;
const html = readFileSync(T, 'utf8');
const open = html.indexOf('<!-- internal:start --><script>\n// Feature breakdown → spreadsheet export.');
const bodyStart = html.indexOf('\n', html.indexOf('hidden by the client-view CSS.', open)) + 1;
const close = html.lastIndexOf('</script><!-- internal:end -->');
if (open < 0 || bodyStart <= 0 || close < bodyStart) throw new Error('export block markers not found');
let code = html.slice(bodyStart, close);

function cut(startMark, endMark) {
  const a = code.indexOf(startMark);
  const b = code.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error(`not found: ${startMark}`);
  const piece = code.slice(a, b + endMark.length);
  code = code.slice(0, a) + code.slice(b + endMark.length);
  return piece;
}
// The two page-specific functions stay in the classic page.
const container = cut('function xlsxContainer(f) {', '\n}\n\n');
const rows = cut('// Every feature, whatever the breakdown filter shows', '\n}\n\n');

const swaps = [
  ['return fillRollup(noted, DATA.inputs.contextLevels);', 'return fillRollup(noted, XLSX_SOURCE.levels());'],
  ['const rows = exportRows();', 'const rows = XLSX_SOURCE.rows();'],
];
for (const [from, to] of swaps) {
  if (!code.includes(from)) throw new Error(`seam not found: ${from}`);
  code = code.replace(from, to);
}
code = code.replaceAll('xlsxContainer(f)', 'XLSX_SOURCE.container(f)')
  .replaceAll('SCORE_KEYS', 'XLSX_FACTORS').replaceAll('SCORE_LABELS', 'XLSX_FACTOR_LABELS');
if (/DATA\.|exportRows|xlsxContainer|SCORE_KEYS|SCORE_LABELS/.test(code)) throw new Error('a page global is still referenced');

const header = `// The v2 estimator workbook export, shared by the classic page and the
// workflow-mode Component-based page. Clones the sample workbook (base64
// below), fills the Ballpark and Project Roll-up tabs, adds Task Breakdown and
// Score Rationale, and leaves every template formula live so the workbook
// keeps repricing when a human edits a score. The page defines
// XLSX_SOURCE = { rows(), container(row), levels() } before this script;
// nothing here reads page globals.
const XLSX_FACTORS = ['tech', 'size', 'deps', 'unc', 'risk'];
const XLSX_FACTOR_LABELS = { tech: 'Tech', size: 'Size', deps: 'Deps', unc: 'Unc', risk: 'Risk' };
`;
mkdirSync(`${E}/shared/assets`, { recursive: true });
writeFileSync(`${E}/shared/assets/xlsx-export.js`, header + code);
const seam = 'const XLSX_SOURCE = { rows: exportRows, container: xlsxContainer, levels: () => DATA.inputs.contextLevels };\n<!-- slot:XLSX -->\n';
writeFileSync(T, html.slice(0, bodyStart) + container + rows + seam + html.slice(close));
console.log('ok');
```

Before running, open `$E/classic/assets/estimate-template.html` and confirm `SCORE_LABELS` there reads `{ tech: 'Tech', size: 'Size', deps: 'Deps', unc: 'Unc', risk: 'Risk' }`; if it differs, copy the real value into the header string.

- [ ] **Step 5: Fill the slot in classic render**

In `$E/classic/scripts/render.mjs`, after the `assetsDir` line add:

```js
const xlsxExportPath = new URL('../../shared/assets/xlsx-export.js', import.meta.url).pathname;
```

and change the slot spread at the end of `slots` to:

```js
    ...(isAgentic ? {} : { GUIDE: guideTableHtml(loadGuide()), XLSX: readFileSync(xlsxExportPath, 'utf8') }),
```

(The agentic template has no export and no XLSX marker; `embed` is strict both ways.)

- [ ] **Step 6: Run the classic suite and compare with Step 1**

Run: `node --test $E/classic/scripts/test/*.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail|skipped)'`
Expected: the same four numbers as Step 1, `fail 0`. Then `node --test $W/scripts/test/quality-gates.test.mjs` → PASS. If a classic browser test fails with a redeclaration error, a moved name collides with another classic script block — rename it in the shared file with an `xlsx` prefix and re-run.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add $E/shared/assets/xlsx-export.js $E/classic/assets/estimate-template.html $E/classic/scripts/render.mjs $E/classic/scripts/test/render.test.mjs $E/classic/scripts/test/references.test.mjs $W/scripts/test/quality-gates.test.mjs
/usr/bin/git commit -m "refactor(estimate): share the xlsx export behind a row seam"
```

---

### Task 4: Workbook rows from workflow data

**Files:**
- Create: `$W/scripts/lib/xlsx-rows.mjs`
- Test: `$W/scripts/test/xlsx-rows.test.mjs`

**Interfaces:**
- Consumes: `mainBuilder(featureId, components)` from `rollup.mjs`; `featureProvenance(reqFeature)` from `requirements.mjs`; Task 1's per-task `low/e/high`.
- Produces: `xlsxRows(est, req) → Row[]` (Task 3's `Row`, plus `id` and `container` — the main builder's container name), sorted by milestone (M1 < M2 < M10), input order within a milestone.

- [ ] **Step 1: Write the failing test**

Create `$W/scripts/test/xlsx-rows.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { computeWorkflowEstimation } from '../lib/rollup.mjs';
import { xlsxRows } from '../lib/xlsx-rows.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));
function rows() {
  const { inputs, req } = loadPair(fx);
  return xlsxRows(computeWorkflowEstimation(inputs, req, []), req);
}

test('one row per feature, milestone order, main builder sets milestone and container', () => {
  const r = rows();
  assert.deepEqual(r.map((x) => x.id), ['FEAT-001', 'FEAT-003', 'FEAT-002', 'FEAT-005', 'FEAT-004']);
  const f1 = r[0];
  assert.equal(f1.name, 'Order pipeline & stage engine');
  assert.equal(f1.milestone, 'M1 - Walking skeleton');
  assert.equal(f1.container, 'Core API'); // main builder api.stage, parent api
  assert.equal(f1.provenance, 'stated');
  assert.equal(r.find((x) => x.id === 'FEAT-004').provenance, 'proposed'); // BA label "recommended"
  assert.equal(f1.scores.tech.n, 3);
});

test('every task appears once, under the first feature its component builds', () => {
  const r = rows();
  const all = r.flatMap((x) => x.tasks.map((t) => t.name));
  assert.equal(all.length, 8);
  assert.equal(new Set(all).size, 8);
  // office builds FEAT-001, -003, -005 and is no feature's main builder: its task still lands, under FEAT-001
  assert.deepEqual(r[0].tasks.map((t) => t.name), ['Stage transitions with audit', 'Transition tests', 'Orders, quotes and invoicing screens']);
});

test('task hours map to o / m / p and the shape becomes the category', () => {
  const t = rows().find((x) => x.id === 'FEAT-005').tasks.find((x) => x.name === 'Three-way match');
  assert.deepEqual({ o: t.o, m: t.m, p: t.p, category: t.category, confidence: t.confidence },
    { o: 1, m: 2.17, p: 4, category: 'small_implementation', confidence: 'UNCALIBRATED' });
  assert.deepEqual(t.assumptions, []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test $W/scripts/test/xlsx-rows.test.mjs`
Expected: FAIL with `Cannot find module '…/lib/xlsx-rows.mjs'`.

- [ ] **Step 3: Implement**

Create `$W/scripts/lib/xlsx-rows.mjs`:

```js
// Feeds the shared v2 workbook export (shared/assets/xlsx-export.js) rows in
// the shape the classic page passes it: one per feature, its tasks under it.
// Workflow tasks live on components, so each component's tasks go under the
// first feature it builds — listed once, never dropped.
import { mainBuilder } from './rollup.mjs';
import { featureProvenance } from './requirements.mjs';

const byMilestone = (a, b) => a.milestone.localeCompare(b.milestone, undefined, { numeric: true });

function containerName(c, components) {
  if (!c) return '';
  return (c.parent && components.find((x) => x.id === c.parent))?.name ?? c.name;
}

function taskOwners(inputs) {
  const owners = {};
  for (const c of inputs.components) {
    const first = inputs.features.find((f) => (c.builds ?? []).some((b) => b.feature === f.id));
    if (first && c.tasks?.length) (owners[first.id] ??= []).push(c);
  }
  return owners;
}

function taskRows(c, computed) {
  const done = computed.components[c.id].tasks;
  return c.tasks.map((t) => ({
    name: t.name, category: t.shape, o: done[t.id].low, m: done[t.id].e, p: done[t.id].high,
    confidence: done[t.id].confidence, assumptions: t.assumptions ?? [],
  }));
}

export function xlsxRows(est, req) {
  const { inputs, computed } = est;
  const owners = taskOwners(inputs);
  return inputs.features.map((f) => ({
    id: f.id, name: req.features[f.id].name, scores: f.scores, scoreNote: f.scoreNote ?? '',
    scoreProvenance: f.scoreProvenance, provenance: featureProvenance(req.features[f.id]),
    milestone: computed.features[f.id].milestone ?? '', container: containerName(mainBuilder(f.id, inputs.components), inputs.components),
    tasks: (owners[f.id] ?? []).flatMap((c) => taskRows(c, computed)),
  })).sort(byMilestone);
}
```

(`Array.prototype.sort` is stable, so input order holds within a milestone.)

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test $W/scripts/test/xlsx-rows.test.mjs $W/scripts/test/quality-gates.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add $W/scripts/lib/xlsx-rows.mjs $W/scripts/test/xlsx-rows.test.mjs
/usr/bin/git commit -m "feat(estimate): workbook rows from workflow-mode data"
```

---

### Task 5: Architecture links from the roster (score review fix)

Spec 2's score review hardcodes Sin Kowa: C3 only for a container named "Backend API", and `architecture.html`. This task makes the links come from the component roster and point at `index.html` (E4), in the shared template both pages use.

**Files:**
- Create: `$W/scripts/template/arch-link.js`
- Modify: `$W/scripts/build-template.mjs`, `$W/assets/score-review.html` (rebuilt), `$W/scripts/lib/score-html.mjs`
- Modify: `$W/FLOW.md` step 6 (review page goes into `dist/`)
- Test: `$W/scripts/test/score-review.test.mjs`, `$W/scripts/test/browser.test.mjs`

**Interfaces:**
- Produces: `pageData(...)` gains `arch: 'index.html'` and `c3: { [containerName]: containerId }` (containers that have components). `score-html.mjs` exports `systemData(system, req)` and `MATH_EXPORTS: string[]`.

- [ ] **Step 1: Write the failing tests**

Append to `$W/scripts/test/score-review.test.mjs` (it already imports what it needs to load the fixture; add `import { pageData } from '../lib/score-html.mjs';` and `import { loadGuide } from '../../../shared/lib/scoring.mjs';` at the top if absent, and use the file's existing fixture path helper):

```js
test('page data names the architecture viewer and the containers with a C3 view', () => {
  const { inputs, req } = loadPair(fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url)));
  const d = pageData({ inputs, req, guide: loadGuide() });
  assert.equal(d.arch, 'index.html');
  assert.deepEqual(d.c3, { 'Core API': 'api', 'Background Worker': 'worker' });
});
```

Append to `$W/scripts/test/browser.test.mjs`:

```js
test('architecture links come from the roster', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    const hrefs = await page.eval(`JSON.stringify([...document.querySelectorAll('#c-FEAT-001 a.archlink')].map((a) => a.getAttribute('href')))`);
    assert.deepEqual(JSON.parse(hrefs), ['index.html#panel-components-api', 'index.html#panel-containers']);
  } finally { await page.close(); }
});
```

(FEAT-001 is built by `api.stage` — container Core API, which has components — and by `office`, a container with none.)

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test $W/scripts/test/score-review.test.mjs $W/scripts/test/browser.test.mjs`
Expected: FAIL — `d.arch` undefined; hrefs are `architecture.html#panel-containers` only.

- [ ] **Step 3: Implement**

Create `$W/scripts/template/arch-link.js`:

```js
// the architecture document holds the C4 views; this page links there instead of redrawing them.
// PAGE.c3 maps a container's name to its id when it has components (a C3 view); the rest live in C2.
const ARCH = PAGE.arch;
const archLink = (containers) => {
  const c3 = containers.filter((c) => PAGE.c3[c]);
  const c2 = containers.some((c) => !PAGE.c3[c]);
  return [...c3.map((c) => `<a class="archlink" href="${ARCH}#panel-components-${PAGE.c3[c]}" target="_blank" rel="noopener">C3 ${esc(c)} ↗</a>`),
    c2 && `<a class="archlink" href="${ARCH}#panel-containers" target="_blank" rel="noopener">C2 containers ↗</a>`].filter(Boolean).join(' · ');
};
```

In `$W/scripts/build-template.mjs`, add before the `// ---- the 22-line function gate` block:

```js
// ---- architecture links: from the roster, to the viewer beside the page (spec 3 E4) ----
rep(/\/\/ the architecture document holds the C4 views[^\n]*\n\/\/ \(C3 is the Backend API[^\n]*\nconst ARCH = 'architecture\.html';\nconst archLink = [\s\S]*?\.join\(' · '\); \};\n/,
  readFileSync(at('./template/arch-link.js'), 'utf8'));
```

In `$W/scripts/lib/score-html.mjs`:
- `export` the `systemData` function (`export function systemData(s, req) {` — change it from an arrow-free `function` declaration if needed, keep the body).
- Add `export const MATH_EXPORTS = ['WEIGHTS', 'BANDS', 'MODEL_PARAMS', 'weightedScore', 'bandFor', 'pointEstimate', 'spreadFor', 'featurePrice'];` and use it in `toHtml`: `MATH: inlineModule(extractExports(mathSrc, MATH_EXPORTS)),`.
- In `pageData`, add to the returned object:

```js
    arch: 'index.html',
    c3: Object.fromEntries(inputs.components.filter((c) => isParent(c, inputs.components)).map((c) => [c.name, c.id])),
```

Rebuild the asset: `node $W/scripts/build-template.mjs`.

In `$W/FLOW.md` step 6, change `--out scores-review.html` to `--out <lead>/dist/score-review.html` and add after that sentence: "It sits beside the architecture viewer so its C2/C3 links open."

- [ ] **Step 4: Run the workflow suite**

Run: `node --test $W/scripts/test/*.test.mjs`
Expected: PASS (including `build-template.test.mjs`, which pins the rebuilt asset, and the template gate).

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add $W/scripts/template/arch-link.js $W/scripts/build-template.mjs $W/assets/score-review.html $W/scripts/lib/score-html.mjs $W/FLOW.md $W/scripts/test/score-review.test.mjs $W/scripts/test/browser.test.mjs
/usr/bin/git commit -m "fix(estimate): architecture links from the component roster"
```

---

### Task 6: Workflow-based page template

**Files:**
- Create: `$W/scripts/template/view.js`, `$W/scripts/template/prelude.js`, `$W/scripts/build-workflow-template.mjs`, `$W/assets/estimate-template.html` (built)
- Test: `$W/scripts/test/build-pages.test.mjs`

**Interfaces:**
- Consumes: `PAGE = { currency, view: priceView(), milestones: milestoneView(), register: registerView(), data: {project, mapLabel, systems: systemData[]} }`.
- Produces: template with slots `TITLE`, `DATA`; template globals `viewSummary(view)`, `viewRoadmap(page)`, `viewMethod(view)`, `viewMoney(n)` (used by Task 7 too).

- [ ] **Step 1: Write the failing test**

Create `$W/scripts/test/build-pages.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));

// Every edit to a template lives in its builder, so a rebuild from the mockup
// never silently undoes one (as build-template.test.mjs does for the review).
function pinned(builder, asset) {
  const out = join(mkdtempSync(join(tmpdir(), 'wf-pages-')), 'page.html');
  execFileSync('node', [at(builder), '--out', out], { cwd: tmpdir() });
  assert.equal(readFileSync(out, 'utf8'), readFileSync(at(asset), 'utf8'));
}

test('build-workflow-template.mjs reproduces assets/estimate-template.html', () => {
  pinned('../build-workflow-template.mjs', '../../assets/estimate-template.html');
});

test('the Workflow-based template has its slots, no mockup leftovers, internal parts visible', () => {
  const t = readFileSync(at('../../assets/estimate-template.html'), 'utf8');
  assert.deepEqual([...new Set([...t.matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]))].sort(), ['DATA', 'TITLE']);
  for (const gone of ['MOCKUP', 'Sin Kowa', 'estimate-feature-mockup.html', 'estimate-mockup.html', '/*DATA*/', '<body class="client">']) {
    assert.ok(!t.includes(gone), `template still carries ${gone}`);
  }
  assert.ok(t.includes('href="estimate-components.html"'));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test $W/scripts/test/build-pages.test.mjs`
Expected: FAIL — builder and asset missing.

- [ ] **Step 3: Write the template scripts**

Create `$W/scripts/template/prelude.js`:

```js
const PAGE = JSON.parse(document.getElementById('page-data').textContent);
const DATA = PAGE.data;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
```

Create `$W/scripts/template/view.js`:

```js
// ---- price sections, shared by the Workflow-based and Component-based pages ----
// Every amount arrives computed in PAGE (scripts/lib/page-view.mjs); this
// formats and places them and prices nothing.
const viewMoney = (n) => `${PAGE.currency === 'USD' ? '$' : `${PAGE.currency} `}${Math.round(n).toLocaleString('en-US')}`;
const viewKv = (rows, sum) => rows.map(([a, b]) => `<tr><td>${a}</td><td class="r">${b}</td></tr>`).join('')
  + `<tr class="sum"><td>${sum[0]}</td><td class="r">${sum[1]}</td></tr>`;
function viewBuRow(r, max) {
  return `<div class="bu-row ${r.cls ?? ''}"><div class="lbl">${r.lbl}<small>${r.note}</small></div>
    <div class="bu-bar"><i style="left:${r.from / max * 100}%;width:${Math.max(0.4, (r.to - r.from) / max * 100)}%"></i></div><div class="amt">${r.amt}</div></div>`;
}
function viewHeadline(p) {
  $('#headline').innerHTML = `<div class="big"><span>Range to present</span><b>${viewMoney(p.presentLow)} – ${viewMoney(p.presentHigh)}</b><span>expected cost to worst realistic case</span></div>
    <div><span>If one fixed number is unavoidable</span><b>${viewMoney(p.singleNumber)}</b><span>confident figure (80% chance at or under)</span></div>
    <div><span>Expected cost</span><b>${viewMoney(p.p50)}</b><span>half the time lower, half higher</span></div>
    <div><span>Implied accuracy</span><b>±${Math.round(p.impliedAccuracy * 100)}%</b><span>under 30%: a ballpark you can quote</span></div>`;
}
function viewSummary(v) {
  const p = v.price; const base = p.adjustedBase; const out = base + p.overheads.amount;
  viewHeadline(p);
  const rows = [
    { lbl: 'Feature build', note: `${v.featureCount} scored features`, from: 0, to: p.featurePoints, amt: viewMoney(p.featurePoints) },
    { lbl: `× ${p.contextMultiplier.toFixed(2)} project context`, note: 'spec quality, decisions, compliance, familiarity', from: p.featurePoints, to: base, amt: `+${viewMoney(base - p.featurePoints)}` },
    { lbl: `+ ${Math.round(p.overheads.totalPct * 100)}% work outside features`, note: 'foundation, discovery, UX, QA, DevOps, docs, PM, integration', from: base, to: out, amt: `+${viewMoney(p.overheads.amount)}` },
    { lbl: `+ ${(p.contingencyRate * 100).toFixed(1)}% contingency`, note: 'known unknowns inside the agreed scope', from: out, to: p.p50, amt: `+${viewMoney(p.contingencyAmount)}` },
    { lbl: '= Expected cost', note: '', from: 0, to: p.p50, amt: viewMoney(p.p50), cls: 'total' },
    { lbl: 'Range to present', note: 'expected cost → worst realistic case, rounded up to 500', from: p.presentLow, to: p.presentHigh, amt: `${viewMoney(p.presentLow)}–${viewMoney(p.presentHigh)}`, cls: 'range' },
  ];
  $('#buildup').innerHTML = `<h3>How the price builds up</h3>${rows.map((r) => viewBuRow(r, p.presentHigh || 1)).join('')}`;
}
function viewMs(m) {
  const n = m.features.length;
  return `<div class="m"><div class="dim num">${n} feature${n === 1 ? '' : 's'} finished<span class="internal"> · ${m.components} components</span></div>
    <h4>${esc(m.title)}</h4>
    <div class="amt internal"><b>${viewMoney(m.low)}–${viewMoney(m.high)}</b> · ${Math.round(m.share * 100)}% of the build</div>
    <div>${m.features.map((f) => `<span class="chip" data-f="${f.id}" title="${esc(f.system ?? '')}">${esc(f.name)}</span>`).join('')}</div></div>`;
}
function viewRoadmap(page) {
  $('#ms').innerHTML = page.milestones.map(viewMs).join('');
  $('#assume').innerHTML = page.register.assumptions.map((a) => `<li>${esc(a)}</li>`).join('');
  $('#exclude').innerHTML = page.register.exclusions.map((a) => `<li>${esc(a)}</li>`).join('');
}
function viewContext(v) {
  $('#ctx').innerHTML = `<tr><th>Factor</th><th>Level</th><th class="r">Multiplier</th></tr>${v.context.map((c) =>
    `<tr><td>${esc(c.label)}</td><td>${c.level} · ${esc(c.anchor)}</td><td class="r">${c.multiplier.toFixed(2)}</td></tr>`).join('')}
    <tr class="sum"><td colspan="2">Composite (1 + sum of deviations, cap 2.5)</td><td class="r">${v.price.contextMultiplier.toFixed(2)}</td></tr>`;
}
function viewOverheads(v) {
  const o = v.price.overheads;
  $('#ovh').innerHTML = `<tr><th>Cost line</th><th class="r">% of base</th><th class="r">Amount</th></tr>${v.overheads.map((r) =>
    `<tr><td>${esc(r.label)}</td><td class="r">${Math.round(r.pct * 100)}%</td><td class="r">${viewMoney(r.amount)}</td></tr>`).join('')}
    <tr class="sum"><td>Total</td><td class="r">${Math.round(o.totalPct * 100)}%</td><td class="r">${viewMoney(o.amount)}</td></tr>`;
}
function viewMethod(v) {
  const p = v.price; const e = v.effort;
  viewContext(v); viewOverheads(v);
  $('#cont').innerHTML = viewKv([['Average uncertainty across features', v.avgUnc.toFixed(2)], ['Average risk across features', v.avgRisk.toFixed(2)],
    ['Rate: 5% + 2% × uncertainty + 2% × risk', `${(p.contingencyRate * 100).toFixed(1)}%`]], ['On build + outside work', viewMoney(p.contingencyAmount)]);
  $('#rng').innerHTML = viewKv([['Optimistic (20% chance at or under)', viewMoney(p.p20)], ['Expected cost', viewMoney(p.p50)],
    ['Confident (80%)', viewMoney(p.p80)], ['Worst realistic case (95%)', viewMoney(p.p95)]],
  ['Presented: expected → worst, rounded up to 500', `${viewMoney(p.presentLow)}–${viewMoney(p.presentHigh)}`]);
  $('#xcheck').innerHTML = viewKv([['Components', e.components], ['Tasks', e.tasks], ['Expected effort (agentic baselines)', `${Math.round(e.hours).toLocaleString('en-US')}h`]],
    ['Implied rate at the expected cost', e.rate === null ? '—' : `${viewMoney(e.rate)}/h`]);
}
```

- [ ] **Step 4: Write the builder**

Create `$W/scripts/build-workflow-template.mjs`:

```js
// Builds assets/estimate-template.html (the Workflow-based page) from the
// approved mockup. Like build-template.mjs, every change to the mockup is a
// rep() below; build-pages.test.mjs pins the output to the committed asset.
// Usage: node build-workflow-template.mjs [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const M = at('../../../../../../docs/mockups/estimate-workflow-mode/');
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > 0 ? process.argv[outFlag + 1] : at('../assets/estimate-template.html');
let html = readFileSync(`${M}estimate.src.html`, 'utf8');

// A function replacement: the inserted scripts contain `$'`, which a string
// replacement would expand.
function rep(from, to) {
  const next = html.replace(from, () => to);
  if (next === html) throw new Error(`workflow template builder: nothing matched ${String(from).slice(0, 60)}`);
  html = next;
}

rep('<title>Sin Kowa — estimate</title>', '<title><!-- slot:TITLE --> — estimate</title>');
rep('</style>', `${readFileSync(`${M}reading.css`, 'utf8')}</style>`); // as build-workflow.py
rep('<body class="client">', '<body>'); // internal page (spec 3 E8): the client gets the proposal
rep(/<span class="mock">[^<]*<\/span>\s*\n/, '');
rep('<h1>Sin Kowa Digital Transformation — estimate', '<h1><!-- slot:TITLE --> — estimate');
rep(/<p class="sub">[^<]*<\/p>/, '<p class="sub" id="subline"></p>');
rep('<a href="estimate-mockup.html" aria-current="page">', '<a href="estimate.html" aria-current="page">');
rep('<a href="estimate-feature-mockup.html">Component-based</a>', '<a href="estimate-components.html">Component-based</a>');
rep('`estimate-feature-mockup.html#step=', '`estimate-components.html#step=');
rep('What Sin Kowa can use at the end of each milestone.', 'What the client can use at the end of each milestone.');
rep('<script type="module">\n/*DATA*/\n/*ENG*/\n/*ROLLUP*/', [
  '<script type="application/json" id="page-data"><!-- slot:DATA --></script>',
  '<script type="module">',
  readFileSync(at('./template/prelude.js'), 'utf8'),
  readFileSync(at('./template/view.js'), 'utf8'),
].join('\n'));
rep('renderSummary(); renderSystems(); renderBreakdown(); renderRoadmap(); renderMethod();', [
  "$('#subline').textContent = `${DATA.systems.length} systems · ${DATA.systems.reduce((n, s) => n + s.features.length, 0)} features · scope reviewed by the PO, scores reviewed internally · prices in ${PAGE.currency}`;",
  'viewSummary(PAGE.view); renderSystems(); renderBreakdown(); viewRoadmap(PAGE); viewMethod(PAGE.view);',
].join('\n'));

writeFileSync(OUT, html);
console.log(OUT);
```

Run: `node $W/scripts/build-workflow-template.mjs`

- [ ] **Step 5: Run the tests and the gate**

Run: `node --test $W/scripts/test/build-pages.test.mjs $W/scripts/test/quality-gates.test.mjs`
Expected: PASS. The gate scans `assets/*.html` automatically; the mockup's own script already passes it (checked in planning). If `Sin Kowa` survives somewhere (a `howto` example), replace that example text with a neutral one in a `rep()` and rebuild.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add $W/scripts/template/view.js $W/scripts/template/prelude.js $W/scripts/build-workflow-template.mjs $W/assets/estimate-template.html $W/scripts/test/build-pages.test.mjs
/usr/bin/git commit -m "feat(estimate): workflow-based page template from the mockup"
```

---

### Task 7: Component-based page template

**Files:**
- Create: `$W/scripts/build-components-template.mjs`, `$W/assets/estimate-components.html` (built)
- Test: `$W/scripts/test/build-pages.test.mjs` (extend)

**Interfaces:**
- Consumes: `assets/score-review.html` (Task 5 state), `template/view.js` (Task 6), `shared/assets/xlsx-export.js` seam (Task 3).
- Produces: template with slots `TITLE`, `DATA`, `MATH`, `XLSX`; expects `PAGE` = score-review page data + `{ currency, view, milestones, register, tasks: {componentId: [[name, low, e, high, confidence, assumptions]]}, xlsx: {rows, levels} }`. Button `#xlsx` calls `window.__downloadXlsx()`.

- [ ] **Step 1: Write the failing tests**

Append to `$W/scripts/test/build-pages.test.mjs`:

```js
test('build-components-template.mjs reproduces assets/estimate-components.html', () => {
  pinned('../build-components-template.mjs', '../../assets/estimate-components.html');
});

test('the Component-based template is the review read-only, with tasks, price and export', () => {
  const t = readFileSync(at('../../assets/estimate-components.html'), 'utf8');
  assert.deepEqual([...new Set([...t.matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]))].sort(), ['DATA', 'MATH', 'TITLE', 'XLSX']);
  for (const want of ['const FINAL = true;', 'const TASKS = PAGE.tasks;', 'id="xlsx"', 'href="estimate.html"', 'id="method"', 'const XLSX_SOURCE']) {
    assert.ok(t.includes(want), `template lacks ${want}`);
  }
  assert.ok(!t.includes('architecture.html'));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test $W/scripts/test/build-pages.test.mjs`
Expected: FAIL — builder and asset missing.

- [ ] **Step 3: Write the builder**

Create `$W/scripts/build-components-template.mjs`:

```js
// Builds assets/estimate-components.html (the Component-based page) from the
// score-review template: the same page read-only (FINAL), plus tasks and
// hours, the price sections and the workbook export — what the mockup's
// build-score.py does for estimate-feature-mockup.html. Every change is a
// rep(); build-pages.test.mjs pins the output. Usage: node build-components-template.mjs [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const M = at('../../../../../../docs/mockups/estimate-workflow-mode/');
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > 0 ? process.argv[outFlag + 1] : at('../assets/estimate-components.html');
let html = readFileSync(at('../assets/score-review.html'), 'utf8');
const py = readFileSync(`${M}build-score.py`, 'utf8');
const est = readFileSync(`${M}estimate.src.html`, 'utf8');

// `to` may be a function; a string is wrapped so `$'` in inserted scripts is never expanded.
function rep(from, to) {
  const next = html.replace(from, typeof to === 'function' ? to : () => to);
  if (next === html) throw new Error(`components template builder: nothing matched ${String(from).slice(0, 60)}`);
  html = next;
}
function between(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`components template builder: no ${start}`);
  return src.slice(a + start.length, b);
}
// The final page's CSS, exactly as build-score.py assembles FCSS.
const cut = (a, b) => est.slice(est.indexOf(a), est.indexOf(b));
const fcss = between(py, "FCSS = '''", "'''") + cut('/* summary */', '/* systems */')
  + cut('/* roadmap */', '/* internal-only').replace('repeat(3,minmax(0,1fr))', 'repeat(4,minmax(0,1fr))')
  + between(py, "repeat(4,minmax(0,1fr))') + '''", "'''");

rep('</style>', `${fcss}</style>`);
rep('<title><!-- slot:TITLE --> — score review</title>', '<title><!-- slot:TITLE --> — estimate (component-based)</title>');
rep('<h1><!-- slot:TITLE --> — score review', '<h1><!-- slot:TITLE --> — estimate');
rep(/<p class="sub">After the PO's scope review · <span id="subcount"><\/span>[^<]*<\/p>/,
  '<p class="sub">Component-based view · <span id="subcount"></span> · scores signed off in the score review</p>');
rep('    <button class="btn" id="theme" type="button">Dark</button>\n  </div>',
  '    <div class="head-ctl"><nav class="view pages" aria-label="Estimate view"><a href="estimate.html">Workflow-based</a><a href="estimate-components.html" aria-current="page">Component-based</a></nav>\n    <button class="btn" id="theme" type="button">Dark</button></div>\n  </div>');
rep(/<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">The engineer's view of the estimate: the signed-off score review, read-only, with the price on top. <b>Scoring</b> shows each feature's scores and price; <b>Effort</b> shows the components behind it, with their hours and tasks. The client receives the proposal.</p>
  <section class="card" id="summary"><h2>Summary</h2><p class="sec-lead">The price for this scope, from the features below.</p>
    <div class="headline" id="headline"></div><div class="buildup" id="buildup"></div>
    <p><button class="btn" id="xlsx" type="button" title="every feature as the v2 estimator workbook">download xlsx</button> <span class="quiet">Adjust stack familiarity or any score in the workbook; it reprices itself.</span></p></section>`);
rep('  <details class="guide">', `  <section class="card" id="roadmap"><h2>Milestones</h2><p class="sec-lead">Each milestone lists the client's features it finishes. Its range is its share of the build applied to the project range.</p><div class="ms" id="ms"></div></section>
  <section class="card" id="register"><h2>Assumptions &amp; exclusions</h2><p class="sec-lead">Shared word for word with the proposal.</p>
    <div class="twocol"><div><h3>Assumptions</h3><ul id="assume"></ul></div><div><h3>Exclusions</h3><ul id="exclude"></ul></div></div></section>
  <section class="card" id="method"><h2>Method</h2><p class="sec-lead">Estimator v2: five weighted scores per feature price it on continuous bands; the project roll-up adds the work feature scoring never captures.</p>
    <div class="twocol"><div><h3>Project context factors</h3><table class="kv" id="ctx"></table></div><div><h3>Work outside the features</h3><table class="kv" id="ovh"></table></div></div>
    <div class="twocol"><div><h3>Contingency</h3><table class="kv" id="cont"></table></div><div><h3>Range</h3><table class="kv" id="rng"></table></div></div>
    <h3>Cross-check: the engineering work behind the price</h3><p class="sec-lead">If the implied rate sits far from what the team costs, the scores or the task list need another look.</p><table class="kv" id="xcheck" style="max-width:40rem"></table></section>
  <details class="guide">`);
rep(/<span class="howto-page">You score the <b>features<\/b>[\s\S]*?<\/span>/,
  '<span class="howto-page"><b>Scoring</b> shows each feature&#39;s scores and price; <b>Effort</b> the components behind it, with tasks and hours. Containers and components are the ones in the architecture document: <a class="archlink" href="index.html#panel-containers" target="_blank" rel="noopener">C2 containers ↗</a></span>');
rep('const FINAL = false;', 'const FINAL = true;');
rep('const TASKS = {};', 'const TASKS = PAGE.tasks;');
rep('const pert = ([, o, m, pp]) => (o + 4 * m + pp) / 6;', 'const pert = (x) => x[2]; // expected hours from estimation.json (agentic baselines)');
rep('<th class="r">O / M / P h</th>', '<th class="r">Low / Expected / High h</th>');
rep(/draw\(\)\.then\(\(\) => \{ if \(FINAL\) setTimeout\(pinFromHash, 150\); \}\);\n/, (m) => `${m}${readFileSync(at('./template/view.js'), 'utf8')}
viewSummary(PAGE.view); viewRoadmap(PAGE); viewMethod(PAGE.view);
const XLSX_SOURCE = { rows: () => PAGE.xlsx.rows, container: (row) => row.container, levels: () => PAGE.xlsx.levels };
{ // the shared workbook export, block-scoped so its helpers never collide with this page's
<!-- slot:XLSX -->
}
$('#xlsx').onclick = () => window.__downloadXlsx();
`);

writeFileSync(OUT, html);
console.log(OUT);
```

Run: `node $W/scripts/build-components-template.mjs`

- [ ] **Step 4: Run the tests and the gate**

Run: `node --test $W/scripts/test/build-pages.test.mjs $W/scripts/test/quality-gates.test.mjs`
Expected: PASS. If a `rep` throws "nothing matched", open `assets/score-review.html`, copy the current text of that spot into the `rep` (the mockup body is the source of truth), and rebuild.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add $W/scripts/build-components-template.mjs $W/assets/estimate-components.html $W/scripts/test/build-pages.test.mjs
/usr/bin/git commit -m "feat(estimate): component-based page template with workbook export"
```

---

### Task 8: `render.mjs` — both pages into `dist/`

**Files:**
- Create: `$W/scripts/lib/pair-findings.mjs`, `$W/scripts/lib/page-html.mjs`
- Replace: `$W/scripts/render.mjs`
- Modify: `$W/scripts/validate.mjs` (uses `pairFindings`)
- Modify: `$W/scripts/test/cli.test.mjs` (drop the "until spec 3" test)
- Test: `$W/scripts/test/stage.mjs` (helper), `$W/scripts/test/render.test.mjs`, `$W/scripts/test/pages-browser.test.mjs`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6, 7.
- Produces: `pairFindings(inputs, req, jsonPath?) → string[]`; `workflowHtml({est, req, template}) → string`; `componentsHtml({est, req, assets: {template, guide, mathSrc, xlsxSrc}}) → string`; `taskTable(est)`; CLI `render.mjs --inputs <file> --json <file> --out <dir>` (exit 1 on findings).

- [ ] **Step 1: Write the failing tests**

Create `$W/scripts/test/stage.mjs` (a helper, not a test file — the test glob only picks up `*.test.mjs`):

```js
// A computed sin-kowa-mini lead in a temp folder, for render and page tests.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const script = (n) => fileURLToPath(new URL(`../${n}.mjs`, import.meta.url));
const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

export function staged(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-render-'));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  inputs.measurementsPath = fx('measurements.jsonl');
  if (mutate) mutate(inputs);
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  execFileSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  return dir;
}
```

Create `$W/scripts/test/render.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { staged, script } from './stage.mjs';

const pageOf = (html) => JSON.parse(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const render = (dir, out = join(dir, 'dist')) => spawnSync('node', [script('render'), '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json'), '--out', out]);

test('render writes both pages and warns when the viewer is missing', () => {
  const dir = staged();
  const r = render(dir);
  assert.equal(r.status, 0, String(r.stderr));
  assert.match(String(r.stdout), /Architecture viewer not found in dist\//);
  const wf = readFileSync(join(dir, 'dist', 'estimate.html'), 'utf8');
  assert.ok(!wf.includes('<!-- slot:'));
  const p = pageOf(wf);
  assert.equal(p.data.systems.length, 2);
  assert.deepEqual(p.register.exclusions, ['last-mile delivery tracking', 'Hosting and third-party subscription fees']);
  assert.equal(p.view.price.presentLow, JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8')).computed.price.presentLow);
  const cp = pageOf(readFileSync(join(dir, 'dist', 'estimate-components.html'), 'utf8'));
  assert.deepEqual(cp.tasks['api.billing'][0], ['Three-way match', 1, 2.17, 4, 'UNCALIBRATED', '']);
  assert.equal(cp.xlsx.rows.length, 5);
  assert.equal(cp.arch, 'index.html');
});

test('no warning when the architecture viewer sits in dist/', () => {
  const dir = staged();
  execFileSync('mkdir', ['-p', join(dir, 'dist')]);
  writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html>');
  const r = render(dir);
  assert.equal(r.status, 0);
  assert.doesNotMatch(String(r.stdout), /viewer not found/);
});

test('render refuses a stale estimation.json and writes nothing', () => {
  const dir = staged();
  const est = JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8'));
  est.computed.features['FEAT-001'].point += 1;
  writeFileSync(join(dir, 'estimation.json'), JSON.stringify(est));
  const r = render(dir);
  assert.equal(r.status, 1);
  assert.match(String(r.stderr), /computed block differs/);
  assert.equal(existsSync(join(dir, 'dist', 'estimate.html')), false);
});

test('render refuses invalid inputs', () => {
  const dir = staged();
  const inputs = JSON.parse(readFileSync(join(dir, 'estimation-inputs.json'), 'utf8'));
  inputs.exclusions = [''];
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  assert.equal(render(dir).status, 1);
});
```

Create `$W/scripts/test/pages-browser.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';
import { readZip } from '../../../classic/scripts/test/zip.mjs';
import { staged } from './stage.mjs';

const skip = !findChrome();
const settle = () => new Promise((r) => setTimeout(r, 1500));
const renderer = fileURLToPath(new URL('../render.mjs', import.meta.url));
function pages(mutate) {
  const dir = staged(mutate);
  execFileSync('node', [renderer, '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json'), '--out', join(dir, 'dist')]);
  return (name) => pathToFileURL(join(dir, 'dist', name)).href;
}
const text = (page, sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).textContent`);

test('Workflow-based page: price, milestones, register, Method visible, no errors', { skip }, async () => {
  const page = await openPage(pages()('estimate.html'));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.match(await text(page, '#headline'), /\$39,000 – \$48,500/);
    assert.equal(await page.eval(`document.querySelectorAll('#ms .m').length`), 3);
    assert.equal(await page.eval(`document.querySelectorAll('#exclude li').length`), 2);
    assert.notEqual(await page.eval(`getComputedStyle(document.getElementById('method')).display`), 'none');
    assert.match(await text(page, '#subline'), /2 systems · 5 features/);
  } finally { await page.close(); }
});

test('prices carry the currency code when it is not USD', { skip }, async () => {
  const page = await openPage(pages((i) => { i.currency = 'SGD'; })('estimate.html'));
  try {
    await settle();
    assert.match(await text(page, '#headline'), /SGD 39,000 – SGD 48,500/);
  } finally { await page.close(); }
});

test('Component-based page: read-only, tasks with hours, no errors', { skip }, async () => {
  const page = await openPage(pages()('estimate-components.html'));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('.pick button').length`), 0);
    assert.equal(await page.eval(`getComputedStyle(document.querySelector('.bar')).display`), 'none');
    assert.match(await text(page, '#headline'), /\$39,000 – \$48,500/);
    assert.match(await page.eval(`document.body.textContent`), /Three-way match/);
  } finally { await page.close(); }
});

test('the workbook export: features in milestone order, 8 tasks, familiarity level 1', { skip }, async () => {
  const page = await openPage(pages()('estimate-components.html'));
  try {
    await settle();
    const files = readZip(Buffer.from(await page.eval('window.__buildWorkbook()'), 'base64'));
    const sheet = (n) => files.get(`xl/worksheets/${n}`).toString('utf8');
    assert.match(sheet('sheet2.xml'), /<c r="A7"[^>]*t="inlineStr"><is><t>Order pipeline &amp; stage engine<\/t>/);
    assert.match(sheet('sheet2.xml'), /<c r="A8"[^>]*t="inlineStr"><is><t>Order intake &amp; quotation<\/t>/);
    assert.equal((sheet('sheet6.xml').match(/<row r=/g) ?? []).length, 9); // header + 8 tasks
    assert.match(sheet('sheet5.xml'), /<c r="C12"[^>]*><v>1<\/v>/); // stackFamiliarity
    assert.match(files.get('xl/workbook.xml').toString('utf8'), /Task Breakdown[\s\S]*Score Rationale|Score Rationale[\s\S]*Task Breakdown/);
  } finally { await page.close(); }
});
```

In `$W/scripts/test/cli.test.mjs`, delete the test `'render refuses in workflow mode until spec 3'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test $W/scripts/test/render.test.mjs $W/scripts/test/pages-browser.test.mjs`
Expected: FAIL — render exits 2 ("pages come in spec 3").

- [ ] **Step 3: Implement**

Create `$W/scripts/lib/pair-findings.mjs`:

```js
// One validation for validate.mjs and render.mjs: the inputs' shape, then a
// byte-level check that estimation.json's computed block is a fresh recompute.
import { readFileSync } from 'node:fs';
import { loadMeasurements, resolveMeasurementsPath } from '../../../shared/lib/measurements.mjs';
import { checkWorkflowInputs } from './schema.mjs';
import { computeWorkflowEstimation } from './rollup.mjs';

function checkComputed(inputs, req, jsonPath) {
  const est = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const measurements = loadMeasurements(resolveMeasurementsPath(inputs)).records;
  const fresh = computeWorkflowEstimation(inputs, req, measurements).computed;
  return JSON.stringify(est.computed) === JSON.stringify(fresh) ? [] : ['estimation.json: computed block differs from a fresh recompute — run compute.mjs'];
}

export function pairFindings(inputs, req, jsonPath) {
  const findings = checkWorkflowInputs(inputs, req);
  if (!findings.length && jsonPath) findings.push(...checkComputed(inputs, req, jsonPath));
  return findings;
}
```

Replace `$W/scripts/validate.mjs` with:

```js
// Inputs findings plus, when --json is given, a byte-level check that the
// computed block equals a fresh recompute (lib/pair-findings.mjs).
import { loadPair } from './lib/requirements.mjs';
import { pairFindings } from './lib/pair-findings.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs) { console.error('usage: validate.mjs --inputs estimation-inputs.json [--json estimation.json]'); process.exit(1); }
const { inputs, req } = loadPair(args.inputs);
const findings = pairFindings(inputs, req, args.json);
if (findings.length) { console.error(findings.join('\n')); process.exit(1); }
console.log('ok');
```

Create `$W/scripts/lib/page-html.mjs`:

```js
// Fills the two estimate templates. Both pages are internal (spec 3 E2): the
// client gets the proposal. Numbers come from estimation.json through
// page-view.mjs; the templates only format them.
import { embed } from '../../../../analyze-requirements/scripts/lib/embed.mjs';
import { inlineModule, extractExports } from '../../../shared/lib/inline.mjs';
import { pageData, systemData, MATH_EXPORTS } from './score-html.mjs';
import { priceView, milestoneView, registerView } from './page-view.mjs';
import { xlsxRows } from './xlsx-rows.mjs';

const json = (v) => JSON.stringify(v).replaceAll('</script', '<\\/script');

function common(est, req) {
  return { currency: est.inputs.currency ?? 'USD', view: priceView(est), milestones: milestoneView(est), register: registerView(est, req) };
}

// The Effort side's task rows: [name, low, expected, high hours, confidence, assumptions].
export function taskTable(est) {
  const out = {};
  for (const c of est.inputs.components) {
    const done = est.computed.components[c.id]?.tasks ?? {};
    if (c.tasks?.length) out[c.id] = c.tasks.map((t) => [t.name, done[t.id].low, done[t.id].e, done[t.id].high, done[t.id].confidence, (t.assumptions ?? []).join('; ')]);
  }
  return out;
}

export function workflowHtml({ est, req, template }) {
  const data = { project: est.inputs.project, mapLabel: req.mapLabel, systems: req.systems.map((s) => systemData(s, req)) };
  return embed({ template, slots: { TITLE: est.inputs.project, DATA: json({ ...common(est, req), data }) } });
}

export function componentsHtml({ est, req, assets }) {
  const page = {
    ...pageData({ inputs: est.inputs, req, guide: assets.guide }), ...common(est, req),
    tasks: taskTable(est), xlsx: { rows: xlsxRows(est, req), levels: est.inputs.contextLevels },
  };
  return embed({
    template: assets.template,
    slots: { TITLE: est.inputs.project, DATA: json(page), MATH: inlineModule(extractExports(assets.mathSrc, MATH_EXPORTS)), XLSX: assets.xlsxSrc },
  });
}
```

Replace `$W/scripts/render.mjs` with:

```js
// Workflow-mode pages: estimate.html (Workflow-based) and
// estimate-components.html (Component-based), both internal, written into the
// lead's dist/ beside the architecture viewer. Validation runs first: an
// unvalidated estimate never renders (spec 3 W13).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPair } from './lib/requirements.mjs';
import { pairFindings } from './lib/pair-findings.mjs';
import { workflowHtml, componentsHtml } from './lib/page-html.mjs';
import { loadGuide } from '../../shared/lib/scoring.mjs';

const asset = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs || !args.json || !args.out) {
  console.error('usage: render.mjs --inputs estimation-inputs.json --json estimation.json --out <lead>/dist');
  process.exit(1);
}
const { inputs, req } = loadPair(args.inputs);
const findings = pairFindings(inputs, req, args.json);
if (findings.length) { console.error(findings.join('\n')); process.exit(1); }
const est = JSON.parse(readFileSync(args.json, 'utf8'));
const assets = {
  template: asset('../assets/estimate-components.html'), guide: loadGuide(),
  mathSrc: asset('../../shared/lib/pricing.mjs'), xlsxSrc: asset('../../shared/assets/xlsx-export.js'),
};
mkdirSync(args.out, { recursive: true });
writeFileSync(join(args.out, 'estimate.html'), workflowHtml({ est, req, template: asset('../assets/estimate-template.html') }));
writeFileSync(join(args.out, 'estimate-components.html'), componentsHtml({ est, req, assets }));
if (!existsSync(join(args.out, 'index.html'))) console.log('Architecture viewer not found in dist/ — C2/C3 links will not open until it is rendered.');
console.log(join(args.out, 'estimate.html'));
console.log(join(args.out, 'estimate-components.html'));
```

- [ ] **Step 4: Run the workflow suite**

Run: `node --test $W/scripts/test/*.test.mjs`
Expected: PASS, `ℹ fail 0`. Browser tests skip only when no Chrome is on the machine. If the Workflow-based page reports a console error from the mermaid CDN import, that import sits in the mockup's `try/catch`; any other error is real — fix it.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add $W/scripts/lib/pair-findings.mjs $W/scripts/lib/page-html.mjs $W/scripts/render.mjs $W/scripts/validate.mjs $W/scripts/test/cli.test.mjs $W/scripts/test/stage.mjs $W/scripts/test/render.test.mjs $W/scripts/test/pages-browser.test.mjs
/usr/bin/git commit -m "feat(estimate): render workflow-based and component-based pages"
```

---

### Task 9: Flow, README, eval, spec notes

**Files:**
- Modify: `$W/FLOW.md` (steps 10–11), `$E/README.md`, `$E/evals/evals.json` (case 3), `plugins/solution-architect/evals/workflow-happy-path/graders/` (eval graders), `docs/superpowers/specs/2026-10-07-estimate-workflow-pages-design.md` (deviation notes)

- [ ] **Step 1: FLOW.md**

Replace step 10 in `$W/FLOW.md` with:

```markdown
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
```

In step 5 (Score) or step 7 (Tasks), add one line: "Write `exclusions` — the commercial items the price leaves out that the BA scope does not name (hosting and subscriptions, post-launch support, security testing, hardware), one sentence each."

- [ ] **Step 2: README.md**

In `$E/README.md` "Two flows", change the last sentence to:

```markdown
Commands below are the classic ones; prefix `workflow-based/` for workflow
mode (`compute.mjs`, `validate.mjs`, `score-review.mjs`, `render.mjs`), whose
render writes two internal pages into the lead's `dist/`: `estimate.html`
(Workflow-based) and `estimate-components.html` (Component-based, with the
xlsx download). The xlsx export itself lives in `shared/assets/xlsx-export.js`.
```

- [ ] **Step 3: Eval case**

The live eval is plugin-level: `plugins/solution-architect/evals/workflow-happy-path/` (graders in `graders/*.md`). The sandbox grants no Bash, so the run stops at the "Workflow tool unavailable" gate and renders nothing; graders must accept that branch.

Replace `plugins/solution-architect/evals/workflow-happy-path/graders/no-pages.md` with two graders:

`graders/no-estimation-md.md`:

```markdown
---
type: file_exists
path: "estimation.md"
exists: false
---

Workflow mode never writes estimation.md (spec 3 E1).
```

`graders/pages-or-stop.md`:

```markdown
---
type: llm
focus: trace
---

Workflow mode renders two internal pages into the lead's dist/ folder:
estimate.html and estimate-components.html.

PASS if either (a) the agent ran workflow-based/scripts/render.mjs, both
files exist in dist/, and the closing question names both page URLs, or
(b) the agent stopped at a gate (architecture not reviewed, or the
dynamic-workflows /config message) before any estimate existed, and wrote
no page.
FAIL if it wrote a classic estimate.html, rendered without validating, or
closed without naming the pages after rendering them.
```

Delete the old file: `/usr/bin/git rm plugins/solution-architect/evals/workflow-happy-path/graders/no-pages.md`.

Mirror the change in the skill's descriptive copy, `$E/evals/evals.json` case id 3 (`workflow-happy-path`): in `expected_output`, replace "writes the score review page, and ends with the closing AskUserQuestion." with "writes the score review page, renders estimate.html and estimate-components.html into dist/, and ends with the closing AskUserQuestion naming both pages."; replace the `no-pages` assertion with `"pages-written: when estimation.json exists, dist/estimate.html and dist/estimate-components.html exist, no estimation.md was written, and the closing question names both page URLs"`.

Validate: `node -e "JSON.parse(require('fs').readFileSync('$E/evals/evals.json','utf8'))"` → no output.

- [ ] **Step 4: Spec deviation notes**

Append to `docs/superpowers/specs/2026-10-07-estimate-workflow-pages-design.md`:

```markdown
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
```

- [ ] **Step 5: Full suite and commit**

Run: `npm test 2>&1 | tail -8`
Expected: `ℹ fail 0`.

```bash
/usr/bin/git add $W/FLOW.md $E/README.md $E/evals/evals.json plugins/solution-architect/evals/workflow-happy-path/graders docs/superpowers/specs/2026-10-07-estimate-workflow-pages-design.md
/usr/bin/git commit -m "docs(estimate): flow, readme and eval for workflow pages"
```

- [ ] **Step 6: Eval run (one case, about $1)**

Run the plugin eval for the one case, the same way spec 2 ran it (`claude plugin eval … --case workflow-happy-path`; check `claude plugin eval --help` for the plugin path argument). Expected: the run stops at the gate, `pages-or-stop` passes on branch (b). Report that the render step is covered by `render.test.mjs` and `pages-browser.test.mjs`, not by the eval.
