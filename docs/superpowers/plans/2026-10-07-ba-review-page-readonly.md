# BA Read-only Review Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the decision page of business-analyst 0.4.0 with a read-only page. The page reads like the PO's own document, and only what the interview added is marked ★ New. The paste-back decision machinery goes, and the interview settles every asked question.

**Architecture:** Node scripts with byte-identical Python twins, parity-tested, as today. `review-data.mjs` turns `requirements.json` into page data and holds the two refusals (undecided items, ids in shown text). `review-page.mjs` draws static HTML from that data into a fixed template with two slots. Nothing is embedded as JSON, and the page carries no script. `leftOut`, the `review` record, `review apply` and the guard are deleted. The scope rules stop requiring a workflow per system and a step per feature.

**Tech Stack:** Node ≥ 20 (`node:test`), Python ≥ 3.10, plain HTML/CSS. Headless Chrome for the browser test, via `plugins/solution-architect/skills/analyze-requirements/scripts/lib/cdp.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-07-ba-review-page-readonly.md` (R1–R8). Mockup: `~/Downloads/review-mockup.html`. The approved page drops its scope table, milestones and exclusions sections.

## Global Constraints

- Work in the worktree `.claude/worktrees/ba-review-page`, branch `feat/ba-review-page`. Use `/usr/bin/git`, one git command per call.
- Never `git stash`, never push, never merge, never touch the main checkout.
- Commit messages follow Conventional Commits with scope `business-analyst`, e.g. `feat(business-analyst): read-only review page`.
- Commit messages carry no `Co-Authored-By`, no `Claude-Session` and no "Generated with" line.
- The branch is rebased on `feat/workflow-based-estimator` at `6d8cd35`, so the estimate and proposal pages are here. Task 5 touches them, and solution-architect stays at 3.0.1 (it bumps only in release commits).
- The scope-mode question (§7) recommends nothing either: its options state what each mode gives, and the question text names the cues seen.
- The version stays 0.4.0, because the branch is not merged yet.
- `S` below means `plugins/business-analyst/skills/business-analyst`. Paths in steps are relative to the worktree root unless they start with `S/`.
- Run the BA suite with `node --test S/scripts/test/*.test.mjs` from the worktree root. Run one file with `node --test S/scripts/test/<file>`.
- Module gates: ≤200 lines, ≤10 functions, ≤22 lines per function, ≤3 params. `quality-gates.test.mjs` checks them, and only `function` declarations and block arrows (`=> {`) count.
- Page text the PO sees is business words only: no ids (R3), no tech words in names (already enforced by `checkNames`).
- The page reads "★ New" for interview additions and "Added: <source>" under them. The page template itself must contain no `★` character, so a page with no additions has none.
- Interview options never recommend: no "(Recommended)" in any option the agent writes. Assumption options start with "Assume". There is no "Don't know" option: every asked question closes as an answer, an assumption or out of scope, and a typed "don't know" is asked once more. Only unasked P3 gaps stay open questions.

## Review Focus

1. **Markup or quotes in a name.** `Order <b>pipeline</b> & "stage"` must show as text. Task 1 pins this with a test in `review-page.test.mjs`, and Task 1 also covers it in the browser test.
2. **Non-ASCII text.** "Café — order" and the ★ tag must come out as the same bytes from Node and Python. Task 1 pins this in `review-parity.test.mjs` ("markup and non-ascii text").
3. **A system the input gave no steps for.** It has no workflows and its features have `steps: []`. The page draws no flow, and the md shows `—` in "Where in the workflow". Task 3 adds the tests in `scope-checks`, `scope-md`, `review-page` and parity.
4. **Assumptions.** A `resolved` assumption is not shown. With no assumptions there is no Assumptions section, and with no additions the summary has no ★. Task 1 pins both.
5. **Branches.** A branch whose target is a main step is a loop back (`↺ back to …`); any other is a side box (`↳ from …`). Task 1 pins both strings.

---

### Task 1: Read-only review page

Replace the card page with the static page. Delete `review apply`, its guard and the decisions script, together with their tests and Python twins.

**Files:**
- Rewrite: `S/scripts/lib/review-data.mjs`, `S/scripts/lib/review-page.mjs`, `S/assets/review-page.html`, `S/scripts/review.mjs`, `S/scripts/review_data.py`, `S/scripts/review.py`
- Create: `S/scripts/review_page.py`
- Delete: `S/assets/review-decisions.js`, `S/scripts/lib/review-apply.mjs`, `S/scripts/review_apply.py`, `S/scripts/lib/review-guard.mjs`, `S/scripts/review_guard.py`, `S/scripts/test/review-apply.test.mjs`, `S/scripts/test/review-guard.test.mjs`
- Rewrite tests: `S/scripts/test/review-page.test.mjs`, `S/scripts/test/review-browser.test.mjs`, `S/scripts/test/review-parity.test.mjs`
- Modify: `S/scripts/test/review-fixture.mjs` (add `decided()`, drop the decision helpers), `S/scripts/test/python-parity.test.mjs` (drop the page and apply blocks), `S/scripts/test/quality-gates.test.mjs` (module list)

**Interfaces:**
- Consumes `ID_TOKEN` and `collectIds` from `lib/checks.mjs`, `toBe`, `modeOf` and `scopeIds` from `lib/scope-rules.mjs`, and `checkScope` from `lib/scope-checks.mjs`. In Python, the same names from `validate.py` and `scope_checks.py` (`ID_TOKEN`, `collect_ids`, `to_be`, `mode_of`, `scope_ids`, `check_scope`).
- Produces:
  - `pageData(pkg, date)` returns `{ title, date, systems: [{ name, purpose, flows: [{ name, steps: string[], branches: [{ from, to, label: string|null, back: boolean }], sub: { startsAt, rejoins: string|null, share: string|null } | null }], features: [{ name, does, added: string|null }] }], assumptions: [{ text, added: string|null }] }`.
  - `undecided(pkg)` returns `string[]`.
  - `idLeaks(pkg)` returns `string[]`.
  - `bodyHtml(data)` returns a string.
  - `fillPage(template, title, body)` returns a string.
  - `pageHtml(pkg, date)` returns a string.
  - Python twins: `page_data`, `undecided`, `id_leaks` in `review_data.py`, and `body_html`, `fill_page`, `page_html` in `review_page.py`.
  - Test fixture: `decided()` in `review-fixture.mjs` returns the workflow pass package with every scope item confirmed. FEAT-004 has source `PO in interview, 2026-10-07`, plus ASM-002 added in the interview.

- [ ] **Step 1: Write the fixture helper**

In `S/scripts/test/review-fixture.mjs`, keep the existing imports, `DATE`, `withQuestion` and `reviewed` (Task 2 removes the last two). Delete `decisions`, `YES_WF3`, `NO_FEAT4`, `ANSWER_Q3`, `NO_SYS2`, `heldSystem` and `draftSystem`. Then add:

```js
// The pass package once the interview settled it: every system, workflow
// and feature decided; one feature and one assumption added by the PO.
export function decided() {
  const { pkg } = loadWorkflow();
  Object.assign(pkg.workflows[2], { label: 'confirmed', source: 'PO brief, System 2' });
  Object.assign(pkg.features[3], { label: 'confirmed', source: `PO in interview, ${DATE}` });
  pkg.assumptions.push({
    id: 'ASM-002', text: 'Offline scan gaps last under 1 hour; longer outages are a change request.',
    impact: 'low', status: 'accepted', source: `PO in interview, ${DATE}`,
  });
  return pkg;
}
```

`reviewed()` still uses `NO_FEAT4.note`. Inline it: replace `NO_FEAT4.note` with `'we invoice from the signed DO'` (both places).

- [ ] **Step 2: Write the failing page tests**

Replace `S/scripts/test/review-page.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageData, undecided, idLeaks } from '../lib/review-data.mjs';
import { fillPage, pageHtml } from '../lib/review-page.mjs';
import { loadWorkflow } from './scope-cases.mjs';
import { DATE, decided } from './review-fixture.mjs';

const script = fileURLToPath(new URL('../review.mjs', import.meta.url));
const IDS = /\b(?:G|ACT|SYS|WF|FEAT|FR|BR|SC|Q|ASM|NFR|INT|DAT|CON)-\d{3}\b/;

function runPage(pkg, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'ba-review-'));
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  const out = join(dir, 'review.html');
  const args = [script, 'page', '--json', join(dir, 'r.json'), '--out', out, '--date', DATE, ...extra];
  const r = spawnSync('node', args, { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, html: existsSync(out) ? readFileSync(out, 'utf8') : null };
}

test('features keep their table order; interview additions carry their source', () => {
  const [one, two] = pageData(decided(), DATE).systems;
  assert.deepEqual(one.features.map((f) => [f.name, f.added]), [['Order pipeline & stage engine', null], ['Short-pack alert', null]]);
  assert.deepEqual(two.features.map((f) => [f.name, f.added]), [
    ['Order intake & quotation', null], ['Invoice from packed quantities', 'PO in interview, 2026-10-07'], ['One login, role-based screens', null]]);
});

test('workflows: steps, side branches, loops back and the sub-flow note', () => {
  const [one, two] = pageData(decided(), DATE).systems;
  assert.deepEqual(one.flows, [{
    name: 'Order pipeline', steps: ['Order In', 'Pack', 'Pack Review', 'Shipped'], sub: null, branches: [
      { from: 'Pack', to: 'Short-pack alert', label: "can't fulfil", back: false },
      { from: 'Pack Review', to: 'Pack', label: 'mismatch', back: true }],
  }]);
  assert.deepEqual(two.flows.map((w) => [w.name, w.sub]), [['Order to cash', null],
    ['Custom order', { startsAt: 'Order received', rejoins: 'Order pipeline', share: 'about 20% of orders' }]]);
});

test('assumptions: resolved ones are not shown; interview ones carry their source', () => {
  const pkg = decided();
  pkg.assumptions.push({ id: 'ASM-003', text: 'Old belief.', impact: 'low', status: 'resolved' });
  assert.deepEqual(pageData(pkg, DATE).assumptions, [
    { text: 'Packers carry a phone with a camera on the warehouse floor.', added: null },
    { text: 'Offline scan gaps last under 1 hour; longer outages are a change request.', added: 'PO in interview, 2026-10-07' }]);
});

test('undecided scope is listed, systems then workflows then features (R2)', () => {
  assert.deepEqual(undecided(decided()), []);
  const pkg = loadWorkflow().pkg;
  pkg.systems[1].label = 'assumed';
  assert.deepEqual(undecided(pkg), [
    'SYS-002: not decided; ask the PO in the interview',
    'WF-003: not decided; ask the PO in the interview',
    'FEAT-004: not decided; ask the PO in the interview',
  ]);
});

test('the page is static html in the shape of the document', () => {
  const html = pageHtml(decided(), DATE);
  assert.doesNotMatch(html, /<script|<button|<input|<textarea|@TITLE@|@BODY@/);
  assert.doesNotMatch(html, IDS);
  assert.match(html, /<title>Sin Kowa Mini<\/title>/);
  for (const part of [
    '<p class="summary">2 systems · 5 features · 2 assumptions · <span class="tag">★ New</span> 2 added in interview</p>',
    '<h2>System 2: Orders &amp; invoicing</h2>',
    '<tr class="new"><td><span class="tag">★ New</span> Invoice from packed quantities<span class="src">Added: PO in interview, 2026-10-07</span></td><td>Raises the invoice from what was packed and shipped</td></tr>',
    '<p class="flowcap">Custom order — starts at Order received, rejoins Order pipeline · about 20% of orders</p>',
    '<div class="row side"><span class="arrow">↳ from Pack, can\'t fulfil</span><div class="step alt">Short-pack alert</div></div>',
    '<div class="row side"><span class="arrow">↺ back to Pack from Pack Review, mismatch</span></div>',
    '<li class="new"><span class="tag">★ New</span> Offline scan gaps last under 1 hour; longer outages are a change request.<span class="src">Added: PO in interview, 2026-10-07</span></li>',
  ]) assert.ok(html.includes(part), part);
});

test('no assumptions and no additions: no section, no ★ anywhere', () => {
  const pkg = decided();
  pkg.assumptions = [];
  pkg.features[3].source = 'PO brief, System 2';
  const html = pageHtml(pkg, DATE);
  assert.doesNotMatch(html, /<h2>Assumptions<\/h2>|★/);
  assert.ok(html.includes('<p class="summary">2 systems · 5 features · 0 assumptions</p>'));
});

test('markup in text is escaped, never drawn', () => {
  const pkg = decided();
  pkg.features[0].name = 'Order <b>pipeline</b> & "stage"';
  assert.ok(pageHtml(pkg, DATE).includes('<td>Order &lt;b&gt;pipeline&lt;/b&gt; &amp; &quot;stage&quot;</td>'));
});

test('the template slots: title escaped, body as is, a missing slot refused', () => {
  const t = '<title><!--@TITLE@--></title><main><!--@BODY@--></main>';
  assert.equal(fillPage(t, 'A & B', '<p>x</p>'), '<title>A &amp; B</title><main><p>x</p></main>');
  assert.throws(() => fillPage('<title></title>', 't', 'b'), /slot/);
});

test('an id in text the page shows is refused, one line per field (R3)', () => {
  const pkg = decided();
  assert.deepEqual(idLeaks(pkg), []);
  pkg.features[0].does = 'Moves an order (see BR-001)';
  pkg.workflows[1].branches[0].label = 'per FR-003';
  pkg.features[3].source = 'PO in interview, after FR-004';
  pkg.assumptions[1].text = 'Scans as in FR-002.';
  assert.deepEqual(idLeaks(pkg), [
    'WF-002: branch label names an id (FR-003); the PO page shows it',
    'FEAT-001: does names an id (BR-001); the PO page shows it',
    'FEAT-004: source names an id (FR-004); the PO page shows it',
    'ASM-002: text names an id (FR-002); the PO page shows it',
  ]);
});

test('text the page never shows may name ids', () => {
  const pkg = decided();
  pkg.features[2].source = 'PO brief, FR-003';
  pkg.openQuestions[0].question = 'About WF-003?';
  pkg.workflows[0].steps[0] = 'see FR-001';
  pkg.assumptions.push({ id: 'ASM-003', text: 'Gone, see FR-001.', impact: 'low', status: 'resolved' });
  assert.deepEqual(idLeaks(pkg), []);
});

test('review page: writes the file and says where', () => {
  const r = runPage(decided());
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^review page written: .*review\.html\n$/);
  assert.equal(r.html, pageHtml(decided(), DATE));
});

test('review page: refuses undecided items, one line each, and writes nothing', () => {
  const r = runPage(loadWorkflow().pkg);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, 'WF-003: not decided; ask the PO in the interview\nFEAT-004: not decided; ask the PO in the interview\n');
  assert.equal(r.html, null);
});

test('review page: refuses a broken scope and writes nothing', () => {
  const pkg = decided();
  pkg.features[1].steps = ['WF-002:Nowhere'];
  const r = runPage(pkg);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /^FEAT-002: unknown step WF-002:Nowhere$/m);
  assert.equal(r.html, null);
});

test('review page: refuses an id leak and writes nothing', () => {
  const pkg = decided();
  pkg.features[0].does = 'Moves an order (see BR-001)';
  const r = runPage(pkg);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, 'FEAT-001: does names an id (BR-001); the PO page shows it\n');
  assert.equal(r.html, null);
});

test('review page: classic mode writes nothing and exits 0', () => {
  const pkg = decided();
  for (const k of ['systems', 'features', 'scopeMode', 'mapLabel']) delete pkg[k];
  const r = runPage(pkg);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'classic mode: no review page\n');
  assert.equal(r.html, null);
});

test('review: page is the only command; a flag needs a value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-review-'));
  writeFileSync(join(dir, 'r.json'), JSON.stringify(decided()));
  const apply = spawnSync('node', [script, 'apply', '--json', join(dir, 'r.json')], { encoding: 'utf8' });
  assert.equal(apply.status, 1);
  assert.equal(apply.stderr, 'usage: review.mjs page --json <requirements.json> --out <review.html> [--date YYYY-MM-DD]\n');
  const bare = spawnSync('node', [script, 'page', '--json', join(dir, 'r.json'), '--out'], { encoding: 'utf8' });
  assert.equal(bare.status, 1);
  assert.equal(bare.stderr, '--out: needs a value\n');
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `node --test S/scripts/test/review-page.test.mjs`
Expected: FAIL. The import of `undecided` from `../lib/review-data.mjs` fails with "does not provide an export named 'undecided'".

- [ ] **Step 4: Write `S/scripts/lib/review-data.mjs`**

```js
// requirements.json → what the read-only review page shows (spec R1–R4).
// Business words only: ids never reach the page.
import { ID_TOKEN } from './checks.mjs';
import { toBe } from './scope-rules.mjs';

const NEW = 'PO in interview';
const added = (r) => (typeof r.source === 'string' && r.source.startsWith(NEW) ? r.source : null);
const title = (lead) => lead.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const shownAssumptions = (pkg) => (pkg.assumptions ?? []).filter((a) => a.status !== 'resolved');
const flowMap = (pkg) => new Map((pkg.workflows ?? []).map((w) => [w.id, w]));

function flowData(w, flows) {
  const steps = w.steps ?? [];
  return {
    name: w.name, steps,
    branches: (w.branches ?? []).map((b) => ({ from: b.from, to: b.to, label: b.label ?? null, back: steps.includes(b.to) })),
    sub: w.sub ? {
      startsAt: w.sub.startsAt.slice(w.sub.startsAt.indexOf(':') + 1),
      rejoins: flows.get(w.sub.rejoins)?.name ?? null, share: w.sub.share ?? null,
    } : null,
  };
}

export function pageData(pkg, date) {
  const flows = flowMap(pkg);
  const feats = new Map(pkg.features.map((f) => [f.id, f]));
  const systems = pkg.systems.map((s) => ({
    name: s.name, purpose: s.purpose,
    flows: (s.workflows ?? []).map((id) => flowData(flows.get(id), flows)),
    features: (s.features ?? []).map((id) => feats.get(id)).map((f) => ({ name: f.name, does: f.does, added: added(f) })),
  }));
  const assumptions = shownAssumptions(pkg).map((a) => ({ text: a.text, added: added(a) }));
  return { title: title(pkg.lead), date, systems, assumptions };
}

// R2: the page shows decided scope only; the interview settles the rest.
export function undecided(pkg) {
  return [...pkg.systems, ...toBe(pkg), ...pkg.features]
    .filter((r) => r.label !== 'confirmed')
    .map((r) => `${r.id}: not decided; ask the PO in the interview`);
}

// R3: every free text the page shows verbatim, as [record id, field, text].
function shownText(pkg) {
  const flows = flowMap(pkg);
  const when = (ok, row) => (ok ? [row] : []);
  const flowText = (w) => [[w.id, 'name', w.name], ...(w.steps ?? []).map((x) => [w.id, 'step', x]),
    ...(w.branches ?? []).flatMap((b) => [...when(!(w.steps ?? []).includes(b.to), [w.id, 'step', b.to]), [w.id, 'branch label', b.label]]),
    [w.id, 'share', w.sub?.share]];
  return [
    ...pkg.systems.flatMap((s) => [[s.id, 'name', s.name], [s.id, 'purpose', s.purpose]]),
    ...pkg.systems.flatMap((s) => (s.workflows ?? []).map((id) => flows.get(id))).flatMap(flowText),
    ...pkg.features.flatMap((f) => [[f.id, 'name', f.name], [f.id, 'does', f.does], ...when(added(f), [f.id, 'source', f.source])]),
    ...shownAssumptions(pkg).flatMap((a) => [[a.id, 'text', a.text], ...when(added(a), [a.id, 'source', a.source])]),
  ];
}

// The page must not carry ids (R3): one finding per field that names one.
export function idLeaks(pkg) {
  const out = [];
  for (const [id, field, text] of shownText(pkg)) {
    const ids = [...new Set(String(text ?? '').match(ID_TOKEN) ?? [])];
    if (ids.length) out.push(`${id}: ${field} names an id (${ids.join(', ')}); the PO page shows it`);
  }
  return out;
}
```

- [ ] **Step 5: Write `S/scripts/lib/review-page.mjs`**

```js
// Draws the read-only review page (spec R1): requirements.json in the shape
// of the PO's own document, static HTML, no script. The template holds the
// styles; two slots take the title and the body. A slot missing or doubled
// throws, so a template edit can never ship a page without its content.
import { readFileSync } from 'node:fs';
import { pageData } from './review-data.mjs';

const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const TAG = '<span class="tag">★ New</span> ';
const src = (added) => `<span class="src">Added: ${esc(added)}</span>`;
const why = (b) => `from ${esc(b.from)}${b.label ? `, ${esc(b.label)}` : ''}`;
const asset = (name) => readFileSync(new URL(`../../assets/${name}`, import.meta.url), 'utf8');

function flowHtml(w) {
  const s = w.sub;
  const sub = s ? ` — starts at ${esc(s.startsAt)}${s.rejoins ? `, rejoins ${esc(s.rejoins)}` : ''}${s.share ? ` · ${esc(s.share)}` : ''}` : '';
  const steps = w.steps.map((x) => `<div class="step">${esc(x)}</div>`).join('<span class="arrow">→</span>');
  const branches = w.branches.map((b) => (b.back
    ? `<div class="row side"><span class="arrow">↺ back to ${esc(b.to)} ${why(b)}</span></div>`
    : `<div class="row side"><span class="arrow">↳ ${why(b)}</span><div class="step alt">${esc(b.to)}</div></div>`));
  return [`<div class="flow"><p class="flowcap">${esc(w.name)}${sub}</p>`, `<div class="row">${steps}</div>`, ...branches, '</div>'].join('\n');
}

function featureRow(f) {
  if (!f.added) return `<tr><td>${esc(f.name)}</td><td>${esc(f.does)}</td></tr>`;
  return `<tr class="new"><td>${TAG}${esc(f.name)}${src(f.added)}</td><td>${esc(f.does)}</td></tr>`;
}

function systemHtml(s, i) {
  return ['<section>', `<h2>System ${i + 1}: ${esc(s.name)}</h2>`, `<p>${esc(s.purpose)}</p>`, ...s.flows.map(flowHtml),
    '<table>', '<tr><th>Feature</th><th>What it does</th></tr>', ...s.features.map(featureRow), '</table>', '</section>'].join('\n');
}

function assumptionsHtml(list) {
  if (!list.length) return [];
  const li = (a) => (a.added ? `<li class="new">${TAG}${esc(a.text)}${src(a.added)}</li>` : `<li>${esc(a.text)}</li>`);
  return ['<section>', '<h2>Assumptions</h2>', '<ul>', ...list.map(li), '</ul>', '</section>'];
}

function summary(d) {
  const feats = d.systems.flatMap((s) => s.features);
  const fresh = [...feats, ...d.assumptions].filter((r) => r.added).length;
  const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const parts = [n(d.systems.length, 'system'), n(feats.length, 'feature'), n(d.assumptions.length, 'assumption')];
  return parts.join(' · ') + (fresh ? ` · ${TAG}${fresh} added in interview` : '');
}

export function bodyHtml(d) {
  return ['<header>', `<h1>${esc(d.title)}</h1>`, `<p class="byline">Requirements review · ${esc(d.date)} · read-only</p>`,
    `<p class="summary">${summary(d)}</p>`, '</header>', ...d.systems.map(systemHtml), ...assumptionsHtml(d.assumptions)].join('\n');
}

function fill(template, slot, value) {
  const parts = template.split(slot);
  if (parts.length !== 2) throw new Error(`template slot ${slot} must appear once`);
  return parts.join(value);
}

export function fillPage(template, title, body) {
  return fill(fill(template, '<!--@TITLE@-->', esc(title)), '<!--@BODY@-->', body);
}

export function pageHtml(pkg, date) {
  const d = pageData(pkg, date);
  return fillPage(asset('review-page.html'), d.title, bodyHtml(d));
}
```

- [ ] **Step 6: Write the template `S/assets/review-page.html`**

Replace the whole file. It must contain each slot exactly once, no `<script>` and no `★`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><!--@TITLE@--></title>
<style>
/* Read-only: the PO's own document, re-drawn from requirements.json. Rows the interview added are tinted. */
:root {
  --bg: #ffffff; --ink: #1f2328; --muted: #656d76; --line: #d0d7de;
  --box: #eceafc; --box-line: #9b87e0; --new-bg: #fff6d6; --new-line: #e3b341; --head-bg: #f6f8fa;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0d1117; --ink: #e6edf3; --muted: #9198a1; --line: #30363d;
  --box: #26214a; --box-line: #7d6ad0; --new-bg: #3a2f0b; --new-line: #bb8009; --head-bg: #161b22; color-scheme: dark;
} }
:root[data-theme="dark"] {
  --bg: #0d1117; --ink: #e6edf3; --muted: #9198a1; --line: #30363d;
  --box: #26214a; --box-line: #7d6ad0; --new-bg: #3a2f0b; --new-line: #bb8009; --head-bg: #161b22; color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 860px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 20px; margin: 36px 0 6px; padding-top: 18px; border-top: 1px solid var(--line); }
.byline, .summary { color: var(--muted); font-size: 13px; margin: 0 0 6px; }
.tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--new-bg); border: 1px solid var(--new-line); color: var(--ink); }
table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 14px; }
th, td { text-align: left; vertical-align: top; padding: 7px 10px; border: 1px solid var(--line); }
th { background: var(--head-bg); }
td:first-child { width: 34%; font-weight: 500; }
tr.new td, li.new { background: var(--new-bg); }
tr.new td:first-child { border-left: 3px solid var(--new-line); }
.src { display: block; font-size: 12px; color: var(--muted); font-weight: 400; margin-top: 2px; }
ul { padding-left: 20px; }
li { margin: 4px 0; }
li.new { list-style: none; margin-left: -20px; padding: 6px 10px 6px 17px; border-left: 3px solid var(--new-line); border-radius: 0 4px 4px 0; }
.flow { overflow-x: auto; padding: 4px 0; margin: 10px 0; }
.flowcap { font-size: 13px; color: var(--muted); margin: 0 0 6px; }
.row { display: flex; align-items: center; gap: 6px; width: max-content; }
.row + .row { margin-top: 8px; }
.side { padding-left: 48px; }
.step { background: var(--box); border: 1px solid var(--box-line); border-radius: 4px; padding: 8px 12px; font-size: 13px; text-align: center; max-width: 160px; }
.step.alt { border-style: dashed; }
.arrow { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<main>
<!--@BODY@-->
</main>
</body>
</html>
```

- [ ] **Step 7: Write `S/scripts/review.mjs`**

```js
// The read-only PO review page (spec R1–R3):
//   node review.mjs page --json requirements.json --out review.html [--date YYYY-MM-DD]
import { readFileSync, writeFileSync } from 'node:fs';
import { collectIds } from './lib/checks.mjs';
import { modeOf, scopeIds } from './lib/scope-rules.mjs';
import { checkScope } from './lib/scope-checks.mjs';
import { pageHtml } from './lib/review-page.mjs';
import { undecided, idLeaks } from './lib/review-data.mjs';

const USAGE = 'usage: review.mjs page --json <requirements.json> --out <review.html> [--date YYYY-MM-DD]';

function fail(findings) {
  console.error(findings.join('\n'));
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail([`${argv[i]}: needs a value`]);
    args[argv[i].slice(2)] = value;
    i += 1;
  }
  return args;
}

const pad = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Checks run in order and stop at the first that finds something: a broken
// scope cannot be drawn, so undecided items and ids wait for it.
function page(pkg, args) {
  if (modeOf(pkg) === 'classic') return console.log('classic mode: no review page');
  const checks = [() => checkScope(pkg, new Set([...collectIds(pkg), ...scopeIds(pkg)])), () => undecided(pkg), () => idLeaks(pkg)];
  for (const check of checks) {
    const findings = check();
    if (findings.length) fail(findings);
  }
  writeFileSync(args.out, pageHtml(pkg, args.date ?? today()));
  console.log(`review page written: ${args.out}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (cmd !== 'page') fail([USAGE]);
page(JSON.parse(readFileSync(args.json, 'utf8')), args);
```

- [ ] **Step 8: Delete the decision machinery**

```bash
/usr/bin/git rm S/assets/review-decisions.js S/scripts/lib/review-apply.mjs S/scripts/review_apply.py S/scripts/lib/review-guard.mjs S/scripts/review_guard.py S/scripts/test/review-apply.test.mjs S/scripts/test/review-guard.test.mjs
```

(Write the real path for `S` in commands, i.e. `plugins/business-analyst/skills/business-analyst/...`.)

- [ ] **Step 9: Run the page tests to see them pass**

Run: `node --test S/scripts/test/review-page.test.mjs`
Expected: PASS, 16 tests.

- [ ] **Step 10: Write the failing parity tests**

Replace `S/scripts/test/review-parity.test.mjs` with:

```js
// Python twin of review.mjs: same bytes, same refusals, same exit codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkflow } from './scope-cases.mjs';
import { DATE, decided } from './review-fixture.mjs';

const SCRIPT = {
  node: fileURLToPath(new URL('../review.mjs', import.meta.url)),
  python3: fileURLToPath(new URL('../review.py', import.meta.url)),
};

// Runs one review command in a fresh dir; `rest` builds the flags after the script.
function runIn(cmd, pkg, rest) {
  const dir = mkdtempSync(join(tmpdir(), 'ba-review-parity-'));
  const json = join(dir, 'r.json');
  const out = join(dir, 'p.html');
  writeFileSync(json, JSON.stringify(pkg));
  const r = spawnSync(cmd, [SCRIPT[cmd], ...rest(json, out)], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout.replace(out, 'OUT'), err: r.stderr, html: existsSync(out) ? readFileSync(out, 'utf8') : null };
}

const page = (json, out) => ['page', '--json', json, '--out', out, '--date', DATE];
const both = (pkg, rest = page) => ['node', 'python3'].map((cmd) => runIn(cmd, pkg, rest));

const unicode = () => {
  const pkg = decided();
  pkg.features[0].name = 'Café order — <stage> & "pack"';
  return pkg;
};
const classic = () => {
  const pkg = decided();
  for (const k of ['systems', 'features', 'scopeMode', 'mapLabel']) delete pkg[k];
  return pkg;
};
const leak = () => {
  const pkg = decided();
  pkg.features[3].source = 'PO in interview, see FR-004';
  return pkg;
};

export const PAGE_CASES = [
  ['a decided package', decided, 0],
  ['markup and non-ascii text', unicode, 0],
  ['undecided drafts', () => loadWorkflow().pkg, 1],
  ['an id in a ★ New source', leak, 1],
  ['classic mode', classic, 0],
];

for (const [name, make, code] of PAGE_CASES) {
  test(`review.py page matches review.mjs: ${name}`, () => {
    const [n, p] = both(make());
    assert.deepEqual(p, n);
    assert.equal(n.code, code);
  });
}

test('review.py refuses apply and a bare flag like review.mjs', () => {
  for (const rest of [(json) => ['apply', '--json', json], (json) => ['page', '--json', json, '--out']]) {
    const [n, p] = both(decided(), rest);
    assert.deepEqual(p, n);
    assert.equal(n.code, 1);
  }
});
```

In `S/scripts/test/python-parity.test.mjs`, make these changes:

- Delete the `for (const [name, pkg] of [['draft', …], ['reviewed', …]])` block ("review.py page writes the same bytes").
- Delete `APPLY_CASES` and the loop that runs it.
- Delete the now-unused `pyReview` and `jsReview` constants.
- Trim the review-fixture import to the names still used (`reviewed`, plus `DATE` if anything left uses it). Keep `exec`, which the json-only test still uses.

- [ ] **Step 11: Run parity to see it fail**

Run: `node --test S/scripts/test/review-parity.test.mjs`
Expected: FAIL. `review.py` still imports `review_apply`, so python3 exits with `ModuleNotFoundError`, and its result differs from node's.

- [ ] **Step 12: Write `S/scripts/review_data.py`**

```python
"""Read-only review page data; mirrors lib/review-data.mjs (parity-tested)."""
from scope_checks import to_be
from validate import ID_TOKEN

NEW = 'PO in interview'


def added(r):
    src = r.get('source')
    return src if isinstance(src, str) and src.startswith(NEW) else None


def title(lead):
    return ' '.join(w[:1].upper() + w[1:] for w in lead.split('-'))


def shown_assumptions(pkg):
    return [a for a in pkg.get('assumptions') or [] if a.get('status') != 'resolved']


def flow_data(w, flows):
    steps = w.get('steps') or []
    sub = w.get('sub')
    return {
        'name': w['name'], 'steps': steps,
        'branches': [{'from': b['from'], 'to': b['to'], 'label': b.get('label'), 'back': b['to'] in steps}
                     for b in w.get('branches') or []],
        'sub': {'startsAt': sub['startsAt'][sub['startsAt'].index(':') + 1:],
                'rejoins': (flows.get(sub.get('rejoins')) or {}).get('name'),
                'share': sub.get('share')} if sub else None,
    }


def page_data(pkg, date):
    flows = {w['id']: w for w in pkg.get('workflows') or []}
    feats = {f['id']: f for f in pkg['features']}
    systems = [{
        'name': s['name'], 'purpose': s['purpose'],
        'flows': [flow_data(flows[i], flows) for i in s.get('workflows') or []],
        'features': [{'name': feats[i]['name'], 'does': feats[i]['does'], 'added': added(feats[i])}
                     for i in s.get('features') or []],
    } for s in pkg['systems']]
    assumptions = [{'text': a['text'], 'added': added(a)} for a in shown_assumptions(pkg)]
    return {'title': title(pkg['lead']), 'date': date, 'systems': systems, 'assumptions': assumptions}


def undecided(pkg):
    return [f"{r['id']}: not decided; ask the PO in the interview"
            for r in pkg['systems'] + to_be(pkg) + pkg['features'] if r.get('label') != 'confirmed']


def when(ok, row):
    return [row] if ok else []


def flow_text(w):
    steps = w.get('steps') or []
    rows = [[w['id'], 'name', w.get('name')]] + [[w['id'], 'step', x] for x in steps]
    for b in w.get('branches') or []:
        rows += when(b.get('to') not in steps, [w['id'], 'step', b.get('to')]) + [[w['id'], 'branch label', b.get('label')]]
    return rows + [[w['id'], 'share', (w.get('sub') or {}).get('share')]]


def shown_text(pkg):
    flows = {w['id']: w for w in pkg.get('workflows') or []}
    rows = [row for s in pkg['systems'] for row in ([s['id'], 'name', s.get('name')], [s['id'], 'purpose', s.get('purpose')])]
    rows += [row for s in pkg['systems'] for i in s.get('workflows') or [] for row in flow_text(flows[i])]
    for f in pkg['features']:
        rows += [[f['id'], 'name', f.get('name')], [f['id'], 'does', f.get('does')]] + when(added(f), [f['id'], 'source', f.get('source')])
    for a in shown_assumptions(pkg):
        rows += [[a['id'], 'text', a.get('text')]] + when(added(a), [a['id'], 'source', a.get('source')])
    return rows


def id_leaks(pkg):
    out = []
    for rid, field, text in shown_text(pkg):
        ids = list(dict.fromkeys(ID_TOKEN.findall('' if text is None else str(text))))
        if ids:
            out.append(f"{rid}: {field} names an id ({', '.join(ids)}); the PO page shows it")
    return out
```

- [ ] **Step 13: Write `S/scripts/review_page.py`**

```python
"""Draws the read-only review page; mirrors lib/review-page.mjs. Byte-identical
page, kept in lockstep by scripts/test/review-parity.test.mjs."""
import os

from review_data import page_data

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
TAG = '<span class="tag">★ New</span> '


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def src(added):
    return f'<span class="src">Added: {esc(added)}</span>'


def why(b):
    return f"from {esc(b['from'])}" + (f", {esc(b['label'])}" if b['label'] else '')


def flow_html(w):
    s = w['sub']
    cap = esc(w['name'])
    if s:
        cap += f" — starts at {esc(s['startsAt'])}"
        cap += f", rejoins {esc(s['rejoins'])}" if s['rejoins'] else ''
        cap += f" · {esc(s['share'])}" if s['share'] else ''
    steps = '<span class="arrow">→</span>'.join(f'<div class="step">{esc(x)}</div>' for x in w['steps'])
    branches = [f'<div class="row side"><span class="arrow">↺ back to {esc(b["to"])} {why(b)}</span></div>' if b['back']
                else f'<div class="row side"><span class="arrow">↳ {why(b)}</span><div class="step alt">{esc(b["to"])}</div></div>'
                for b in w['branches']]
    return '\n'.join([f'<div class="flow"><p class="flowcap">{cap}</p>', f'<div class="row">{steps}</div>', *branches, '</div>'])


def feature_row(f):
    if not f['added']:
        return f"<tr><td>{esc(f['name'])}</td><td>{esc(f['does'])}</td></tr>"
    return f"<tr class=\"new\"><td>{TAG}{esc(f['name'])}{src(f['added'])}</td><td>{esc(f['does'])}</td></tr>"


def system_html(s, i):
    return '\n'.join(['<section>', f"<h2>System {i + 1}: {esc(s['name'])}</h2>", f"<p>{esc(s['purpose'])}</p>",
                      *(flow_html(w) for w in s['flows']), '<table>', '<tr><th>Feature</th><th>What it does</th></tr>',
                      *(feature_row(f) for f in s['features']), '</table>', '</section>'])


def assumptions_html(items):
    if not items:
        return []
    lis = [f"<li class=\"new\">{TAG}{esc(a['text'])}{src(a['added'])}</li>" if a['added'] else f"<li>{esc(a['text'])}</li>"
           for a in items]
    return ['<section>', '<h2>Assumptions</h2>', '<ul>', *lis, '</ul>', '</section>']


def count(k, word):
    return f"{k} {word}{'' if k == 1 else 's'}"


def summary(d):
    feats = [f for s in d['systems'] for f in s['features']]
    fresh = len([r for r in feats + d['assumptions'] if r['added']])
    parts = [count(len(d['systems']), 'system'), count(len(feats), 'feature'), count(len(d['assumptions']), 'assumption')]
    return ' · '.join(parts) + (f' · {TAG}{fresh} added in interview' if fresh else '')


def body_html(d):
    return '\n'.join(['<header>', f"<h1>{esc(d['title'])}</h1>",
                      f"<p class=\"byline\">Requirements review · {esc(d['date'])} · read-only</p>",
                      f'<p class="summary">{summary(d)}</p>', '</header>',
                      *(system_html(s, i) for i, s in enumerate(d['systems'])), *assumptions_html(d['assumptions'])])


def fill(template, slot, value):
    parts = template.split(slot)
    if len(parts) != 2:
        raise ValueError(f'template slot {slot} must appear once')
    return value.join(parts)


def fill_page(template, title, body):
    return fill(fill(template, '<!--@TITLE@-->', esc(title)), '<!--@BODY@-->', body)


def page_html(pkg, date):
    with open(os.path.join(ASSETS, 'review-page.html'), encoding='utf-8') as f:
        template = f.read()
    d = page_data(pkg, date)
    return fill_page(template, d['title'], body_html(d))
```

- [ ] **Step 14: Write `S/scripts/review.py`**

```python
#!/usr/bin/env python3
"""Python port of review.mjs: the read-only PO review page.

  python3 review.py page --json requirements.json --out review.html [--date YYYY-MM-DD]
"""
import datetime
import json
import sys

from review_data import id_leaks, undecided
from review_page import page_html
from scope_checks import check_scope, mode_of, scope_ids
from validate import collect_ids

USAGE = 'usage: review.mjs page --json <requirements.json> --out <review.html> [--date YYYY-MM-DD]'


def fail(findings):
    print('\n'.join(findings), file=sys.stderr)
    sys.exit(1)


def parse_args(argv):
    args, i = {}, 0
    while i < len(argv):
        if argv[i].startswith('--'):
            value = argv[i + 1] if i + 1 < len(argv) else None
            if value is None or value.startswith('--'):
                fail([f'{argv[i]}: needs a value'])
            args[argv[i][2:]] = value
            i += 1
        i += 1
    return args


def page(pkg, args):
    if mode_of(pkg) == 'classic':
        print('classic mode: no review page')
        return
    checks = [lambda: check_scope(pkg, set(collect_ids(pkg)) | set(scope_ids(pkg))),
              lambda: undecided(pkg), lambda: id_leaks(pkg)]
    for check in checks:
        findings = check()
        if findings:
            fail(findings)
    with open(args['out'], 'w', encoding='utf-8', newline='') as f:
        f.write(page_html(pkg, args.get('date') or datetime.date.today().isoformat()))
    print(f"review page written: {args['out']}")


def main(argv):
    cmd, args = (argv[0] if argv else None), parse_args(argv[1:])
    if cmd != 'page':
        fail([USAGE])
    with open(args['json'], encoding='utf-8') as f:
        page(json.load(f), args)


if __name__ == '__main__':
    main(sys.argv[1:])
```

The block above replaces the whole file.

- [ ] **Step 15: Run parity to see it pass**

Run: `node --test S/scripts/test/review-parity.test.mjs S/scripts/test/python-parity.test.mjs`
Expected: PASS.

- [ ] **Step 16: Rewrite the browser test**

Replace `S/scripts/test/review-browser.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/cdp.mjs';
import { pageHtml } from '../lib/review-page.mjs';
import { DATE, decided } from './review-fixture.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };

function open(pkg) {
  const file = join(mkdtempSync(join(tmpdir(), 'ba-review-browser-')), 'review.html');
  writeFileSync(file, pageHtml(pkg, DATE));
  return openPage(pathToFileURL(file).href);
}

test('the page draws with no script, no controls and no ids', skip, async () => {
  const page = await open(decided());
  try {
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('script, button, input, textarea, select').length`), 0);
    assert.equal(await page.eval(`/\\b(?:SYS|WF|FEAT|FR|BR|Q|ASM)-\\d{3}\\b/.test(document.body.innerText)`), false);
    assert.equal(await page.eval(`document.querySelectorAll('tr.new, li.new').length`), 2);
    assert.equal(await page.eval(`document.querySelectorAll('.flow').length`), 3);
  } finally { page.close(); }
});

test('markup in a name shows as text, never as html', skip, async () => {
  const pkg = decided();
  pkg.features[0].name = 'Order <b>pipeline</b> & "stage"';
  const page = await open(pkg);
  try {
    assert.equal(await page.eval(`document.querySelector('td').textContent`), 'Order <b>pipeline</b> & "stage"');
    assert.equal(await page.eval(`document.querySelectorAll('td b').length`), 0);
  } finally { page.close(); }
});
```

- [ ] **Step 17: Update the gate list**

In `S/scripts/test/quality-gates.test.mjs`, set `MODULES` to:

```js
const MODULES = [
  'scripts/review.mjs', 'scripts/lib/left-out.mjs', 'scripts/lib/review-checks.mjs', 'scripts/lib/review-data.mjs',
  'scripts/lib/review-page.mjs', 'scripts/lib/scope-render.mjs',
];
```

(Task 2 drops the two left-out lines.) Also change the comment above it to: `// The review page's modules. checks.mjs predates the gates and is over them; it is not listed, and this work only shrinks it.` — unchanged wording is fine.

- [ ] **Step 18: Run the whole BA suite**

Run: `node --test S/scripts/test/*.test.mjs`
Expected: PASS, no failures. The browser tests are skipped only if Chrome is missing.

- [ ] **Step 19: Commit**

```bash
/usr/bin/git add -A plugins/business-analyst/skills/business-analyst
/usr/bin/git commit -m "feat(business-analyst): read-only review page"
```

---

### Task 2: Remove the review record and `leftOut`

**Files:**
- Delete: `S/scripts/lib/left-out.mjs`, `S/scripts/left_out.py`, `S/scripts/lib/review-checks.mjs`, `S/scripts/review_checks.py`, `S/scripts/test/left-out.test.mjs`, `S/scripts/test/review-cases.mjs`, `S/scripts/test/review-checks.test.mjs`
- Modify: `S/scripts/lib/checks.mjs`, `S/scripts/validate.py`, `S/scripts/lib/scope-rules.mjs`, `S/scripts/scope_checks.py`, `S/scripts/lib/scope-render.mjs`, `S/scripts/scope_render.py`
- Modify tests: `S/scripts/test/checks.test.mjs`, `S/scripts/test/scope-md.test.mjs`, `S/scripts/test/python-parity.test.mjs`, `S/scripts/test/review-fixture.mjs`, `S/scripts/test/quality-gates.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `checkPackage({ pkg, md })` and Python's `check_package(pkg, md)` no longer read `review` or `leftOut`. `renderScope(pkg)` no longer prints "Reviewed by PO" or "Left out in review".

- [ ] **Step 1: Write the failing tests**

Append to `S/scripts/test/checks.test.mjs`, adding the imports it needs at the top:

```js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderScope } from '../lib/scope-render.mjs';
import { loadWorkflow } from './scope-cases.mjs';

const validate = fileURLToPath(new URL('../validate.mjs', import.meta.url));

test('validate --json without --md checks the JSON only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-json-only-'));
  const { pkg } = loadWorkflow();
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  assert.match(execFileSync('node', [validate, '--json', join(dir, 'r.json')], { encoding: 'utf8' }), /requirements package valid/);
  pkg.features[0].steps = ['WF-002:Nowhere'];
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  assert.throws(() => execFileSync('node', [validate, '--json', join(dir, 'r.json')], { stdio: 'pipe' }));
});

test('review and leftOut are no longer part of the package', () => {
  const { pkg, md } = loadWorkflow();
  pkg.leftOut = [{ id: 'FEAT-009' }];
  pkg.features[0].review = { answer: 'maybe', date: '2026-10-07' };
  assert.deepEqual(checkPackage({ pkg, md }), []);
  assert.doesNotMatch(renderScope(pkg), /Reviewed by PO|Left out in review/);
});
```

If `checks.test.mjs` already imports any of these names, merge them into the existing import rather than importing twice.

- [ ] **Step 2: Run to see it fail**

Run: `node --test S/scripts/test/checks.test.mjs`
Expected: FAIL in "review and leftOut are no longer part of the package". The findings include `FEAT-009: leftOut kind must be system|workflow|feature` and `FEAT-001: review answer must be yes`.

- [ ] **Step 3: Strip `checks.mjs` and `validate.py`**

In `S/scripts/lib/checks.mjs`:

- Delete `import { checkReview } from './review-checks.mjs';`.
- Delete the line `for (const e of pkg.leftOut ?? []) ids.add(e.id);` in `collectIds`.
- Make the end of `checkPackage` read:

```js
  const scope = checkScope(pkg, ids);
  const json = [
    ...checkDuplicates(pkg),
    ...checkRefs(pkg, ids),
    ...checkLabels(pkg),
    ...checkAmbiguity(pkg),
    ...checkReadiness(pkg),
    ...scope,
  ];
  if (md == null) return json;
  // A broken scope cannot be rendered, so the md compare waits for it.
  return [...json, ...checkMd(pkg, md), ...checkMdOrphanIds(pkg, md, ids), ...(scope.length ? [] : checkScopeMd(pkg, md))];
}
```

In `S/scripts/validate.py`:

- Delete `from review_checks import check_review`.
- In `collect_ids`, delete the loop `for e in rows(pkg, 'leftOut'):` and its body line.
- Make `check_package` read:

```python
def check_package(pkg, md):
    schema_findings = check_schema(pkg)
    if schema_findings:
        return schema_findings
    ids = set(collect_ids(pkg)) | set(scope_ids(pkg))
    scope = check_scope(pkg, ids)
    json_findings = [
        *check_duplicates(pkg),
        *check_refs(pkg, ids),
        *check_labels(pkg),
        *check_ambiguity(pkg),
        *check_readiness(pkg),
        *scope,
    ]
    if md is None:
        return json_findings
    return [*json_findings, *check_md(pkg, md), *check_md_orphan_ids(None, md, ids),
            *([] if scope else check_scope_md(pkg, md))]
```

- [ ] **Step 4: Strip the left-out rules from the scope checks**

In `S/scripts/lib/scope-rules.mjs`, delete `outIds` and `flowOf`, then make the two functions read:

```js
export function checkFlows(pkg) {
  const findings = [];
  const idx = stepIndex(pkg);
  const flows = toBe(pkg).map((w) => w.id);
  const asIs = (pkg.workflows ?? []).filter((w) => w.state === 'as-is').map((w) => w.id);
  for (const w of toBe(pkg)) {
    for (const b of w.branches ?? []) {
      if (!idx.has(`${w.id}:${b.from}`)) findings.push(`${w.id}: branch from unknown step ${b.from}`);
    }
    if (w.sub && !idx.has(w.sub.startsAt)) findings.push(`${w.id}: sub.startsAt unknown`);
    if (w.sub && !flows.includes(w.sub.rejoins)) findings.push(`${w.id}: sub.rejoins is not a to-be workflow`);
    for (const r of w.replaces ?? []) if (!asIs.includes(r)) findings.push(`${w.id}: replaces unknown as-is workflow ${r}`);
  }
  return findings;
}

export function checkFeatureSteps(pkg) {
  const findings = [];
  const idx = stepIndex(pkg);
  for (const f of pkg.features) {
    const steps = f.steps ?? [];
    if (steps.length === 1 && steps[0] === '*') continue;
    if (!steps.length) findings.push(`${f.id}: needs at least one step`);
    for (const s of steps) if (!idx.has(s)) findings.push(`${f.id}: unknown step ${s}`);
  }
  return findings;
}
```

In `S/scripts/scope_checks.py`, delete `out_ids` and `flow_of`, then make the two functions read:

```python
def check_flows(pkg):
    findings = []
    idx = step_index(pkg)
    flows = [w['id'] for w in to_be(pkg)]
    as_is = [w['id'] for w in pkg.get('workflows') or [] if w.get('state') == 'as-is']
    for w in to_be(pkg):
        for b in w.get('branches') or []:
            if f"{w['id']}:{b.get('from')}" not in idx:
                findings.append(f"{w['id']}: branch from unknown step {b.get('from')}")
        sub = w.get('sub')
        if sub and sub.get('startsAt') not in idx:
            findings.append(f"{w['id']}: sub.startsAt unknown")
        if sub and sub.get('rejoins') not in flows:
            findings.append(f"{w['id']}: sub.rejoins is not a to-be workflow")
        for r in w.get('replaces') or []:
            if r not in as_is:
                findings.append(f"{w['id']}: replaces unknown as-is workflow {r}")
    return findings


def check_feature_steps(pkg):
    findings = []
    idx = step_index(pkg)
    for f in pkg['features']:
        steps = f.get('steps') or []
        if steps == ['*']:
            continue
        if not steps:
            findings.append(f"{f['id']}: needs at least one step")
        findings += [f"{f['id']}: unknown step {s}" for s in steps if s not in idx]
    return findings
```

- [ ] **Step 5: Strip the md section**

In `S/scripts/lib/scope-render.mjs`, delete `reviewedLine` and `leftOutTable` and the comment above `reviewedLine`. Make `renderScope` return:

```js
  return [START, '### To-be scope', intro, systemsTable(pkg),
    ...pkg.systems.map((s) => systemBlock(s, ctx)), END].join('\n\n');
```

In `S/scripts/scope_render.py`, delete `reviewed_line` and `left_out_table`. Make `render_scope` return:

```python
    return '\n\n'.join([START, '### To-be scope', intro, systems_table(pkg),
                        *(system_block(s, ctx) for s in pkg['systems']), END])
```

- [ ] **Step 6: Delete the files and old tests**

```bash
/usr/bin/git rm plugins/business-analyst/skills/business-analyst/scripts/lib/left-out.mjs plugins/business-analyst/skills/business-analyst/scripts/left_out.py plugins/business-analyst/skills/business-analyst/scripts/lib/review-checks.mjs plugins/business-analyst/skills/business-analyst/scripts/review_checks.py plugins/business-analyst/skills/business-analyst/scripts/test/left-out.test.mjs plugins/business-analyst/skills/business-analyst/scripts/test/review-cases.mjs plugins/business-analyst/skills/business-analyst/scripts/test/review-checks.test.mjs
```

Then clean the tests that used them:

- `scope-md.test.mjs`: delete the test "the reviewed md shows the left-out table and the reviewed line" and the `reviewed` import.
- `python-parity.test.mjs`:
  - Delete the `moveOut`, `REVIEW_CASES` and `reviewed` imports, `PY_MOVE` with its loop ("left_out.py moves out and back"), and the `REVIEW_CASES` loop.
  - In "validate.py --json without --md matches node", change `writePair(reviewed().pkg, '')` to `writePair(loadWorkflow().pkg, '')`.
- `review-fixture.mjs`: delete `withQuestion` and `reviewed`, plus the imports only they used (`applyScope`, `moveOut`). What stays: `DATE`, `decided`, and the `loadWorkflow` import.
- `quality-gates.test.mjs`: remove `'scripts/lib/left-out.mjs'` and `'scripts/lib/review-checks.mjs'` from `MODULES`.

- [ ] **Step 7: Run the suite**

Run: `node --test S/scripts/test/*.test.mjs`
Expected: PASS.

Run: `/usr/bin/grep -rn "leftOut\|left_out\|left-out\|review_checks\|review-checks\|checkReview" plugins/business-analyst/skills/business-analyst/scripts`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add -A plugins/business-analyst/skills/business-analyst
/usr/bin/git commit -m "refactor(business-analyst): drop the review record and leftOut"
```

---

### Task 3: A system may have no workflow; a feature may sit on no step

**Files:**
- Modify: `S/scripts/lib/scope-checks.mjs`, `S/scripts/scope_checks.py`, `S/scripts/lib/scope-rules.mjs`, `S/scripts/lib/scope-render.mjs`, `S/scripts/scope_render.py`
- Modify tests: `S/scripts/test/scope-cases.mjs`, `S/scripts/test/scope-checks.test.mjs`, `S/scripts/test/scope-md.test.mjs`, `S/scripts/test/python-parity.test.mjs`, `S/scripts/test/review-page.test.mjs`, `S/scripts/test/review-parity.test.mjs`

**Interfaces:**
- Consumes: `pageData` from Task 1.
- Produces: `noFlows()` in `scope-cases.mjs` returns `{ pkg, md }`. In it, SYS-002 has `workflows: []`, WF-003 and WF-004 are gone, FEAT-003 and FEAT-004 have `steps: []`, and the traces and question refs to the removed workflows are cleared.

- [ ] **Step 1: Write the failing tests**

In `S/scripts/test/scope-cases.mjs`, delete these two `CASES` entries:

- `pkgCase('system without workflow', 'SYS-002: needs a to-be workflow', …)`
- `pkgCase('feature without steps', 'FEAT-001: needs at least one step', …)`

Then append:

```js
// SYS-002 as an input that lists features but draws no workflow: the
// system owns none and its features sit on no step.
export function noFlows() {
  const { pkg, md } = loadWorkflow();
  const gone = new Set(['WF-003', 'WF-004']);
  pkg.workflows = pkg.workflows.filter((w) => !gone.has(w.id));
  pkg.systems[1].workflows = [];
  for (const f of pkg.features.slice(2, 4)) f.steps = [];
  for (const fr of pkg.requirements) if (gone.has(fr.traces?.workflow)) delete fr.traces.workflow;
  pkg.openQuestions[0].affects = [];
  return { pkg, md };
}
```

Append to `S/scripts/test/scope-checks.test.mjs`, and add `noFlows` to its `scope-cases.mjs` import:

```js
test('a system with no workflow and features on no step are valid', () => {
  const { pkg } = noFlows();
  assert.deepEqual(checkPackage({ pkg, md: null }), []);
});
```

Append to `S/scripts/test/scope-md.test.mjs`, adding `noFlows` to its import:

```js
test('a system with no workflow shows its feature table only; no step reads —', () => {
  const { pkg, md } = noFlows();
  const out = applyScope(md, pkg);
  assert.ok(out.includes('### SYS-002 Orders & invoicing\n\nQuotation through to a paid invoice.\n\n| ID | Feature |'));
  assert.ok(out.includes('| FEAT-003 | Order intake & quotation | Captures email and phone orders and prices them | — | FR-003 |'));
});
```

Append to `S/scripts/test/review-page.test.mjs`, and add `noFlows` to the `scope-cases.mjs` import:

```js
test('a system with no workflow draws its feature table only', () => {
  const { pkg } = noFlows();
  pkg.features[3].label = 'confirmed';
  assert.deepEqual(pageData(pkg, DATE).systems[1].flows, []);
  assert.doesNotMatch(pageHtml(pkg, DATE).split('<h2>System 2')[1], /class="flow"/);
});
```

In `S/scripts/test/review-parity.test.mjs`, add `noFlows` to the `scope-cases.mjs` import. Add this case to `PAGE_CASES` before `classic mode`:

```js
  ['a system with no workflow', () => { const { pkg } = noFlows(); pkg.features[3].label = 'confirmed'; return pkg; }, 0],
```

Append to `S/scripts/test/python-parity.test.mjs`, adding `noFlows` to its `scope-cases.mjs` import:

```js
test('scope.py and validate.py agree with node on a system with no workflow', () => {
  const { pkg, md } = noFlows();
  const bare = md.replace(/<!-- scope:start -->[\s\S]*?<!-- scope:end -->\n*/, '');
  const a = writePair(pkg, bare);
  const b = writePair(pkg, bare);
  assert.equal(run('node', jsScope, a.jsonPath, a.mdPath).code, 0);
  assert.equal(run('python3', pyScope, b.jsonPath, b.mdPath).code, 0);
  assert.equal(readFileSync(b.mdPath, 'utf8'), readFileSync(a.mdPath, 'utf8'));
  assert.deepEqual(exec('python3', [py, '--json', a.jsonPath]), exec('node', [js, '--json', a.jsonPath]));
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test S/scripts/test/scope-checks.test.mjs S/scripts/test/scope-md.test.mjs S/scripts/test/review-page.test.mjs S/scripts/test/review-parity.test.mjs S/scripts/test/python-parity.test.mjs`
Expected: FAIL, in three ways:

- The scope-checks test reports `SYS-002: needs a to-be workflow`, `FEAT-003: needs at least one step` and `FEAT-004: needs at least one step`.
- The scope-md test fails because the FEAT-003 row ends `|  | FR-003 |`.
- The page and parity tests exit 1 with the same "needs" findings.

- [ ] **Step 3: Relax the rules**

`S/scripts/lib/scope-checks.mjs`, in `checkMembership`: delete the line `if (!(s.workflows ?? []).length) findings.push(\`${s.id}: needs a to-be workflow\`);`.

`S/scripts/scope_checks.py`, in `check_membership`: delete these two lines:

```python
        if not s.get('workflows'):
            findings.append(f"{s['id']}: needs a to-be workflow")
```

`S/scripts/lib/scope-rules.mjs`, in `checkFeatureSteps`: delete the line `if (!steps.length) findings.push(\`${f.id}: needs at least one step\`);`.

`S/scripts/scope_checks.py`, in `check_feature_steps`: delete these two lines:

```python
        if not steps:
            findings.append(f"{f['id']}: needs at least one step")
```

`S/scripts/lib/scope-render.mjs`, in `whereCell`, add after `const refs = f.steps ?? [];`:

```js
  if (!refs.length) return '—';
```

`S/scripts/scope_render.py`, in `where_cell`, add after `refs = f.get('steps') or []`:

```python
    if not refs:
        return '—'
```

- [ ] **Step 4: Run the suite**

Run: `node --test S/scripts/test/*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add -A plugins/business-analyst/skills/business-analyst
/usr/bin/git commit -m "feat(business-analyst): allow systems without a workflow"
```

---

### Task 4: Interview rules, docs and evals

**Files:**
- Modify: `S/SKILL.md`, `S/references/interview.md`, `S/references/writing.md`, `S/references/review.md`, `S/README.md`
- Delete: `plugins/business-analyst/evals/ba-review-decisions/` (whole directory)
- Modify: `plugins/business-analyst/evals/ba-review-page/` (replace grader `page-not-tickboxes.md` with `decide-in-interview.md`)
- Modify: `plugins/business-analyst/evals/ba-interview-first-turn/graders/one-scope-question.md` (no pick marked; evidence in the question text)
- Test: `S/scripts/test/review-page.test.mjs` (docs tests)

**Interfaces:** none (docs only).

- [ ] **Step 1: Write the failing docs tests**

Append to `S/scripts/test/review-page.test.mjs`:

```js
const doc = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DOCS = ['SKILL.md', 'README.md', 'references/interview.md', 'references/writing.md', 'references/review.md'];

test('docs: the review page is read-only; nothing is pasted back', () => {
  for (const p of DOCS) {
    assert.doesNotMatch(doc(p), /Copy decisions|review\.mjs apply|--confirm|leftOut|review decisions|No, keep them|\(Recommended\)/, p);
  }
  assert.match(doc('SKILL.md'), /\*\*review page\*\*/);
});

test('docs: interview options name their hint, assume with a boundary, never recommend', () => {
  const t = doc('references/interview.md');
  assert.match(t, /starts with "Assume"/);
  assert.match(t, /no hint in the input/);
  assert.match(t, /Every question you ask closes/);
  assert.match(t, /must pick an assumption or leave it out/);
  assert.doesNotMatch(t, /include "Don't know"|"Don't know" (?:becomes|takes|leaves)/);
  assert.match(t, /Never draft systems, workflows or features/);
  assert.match(t, /PO in interview, <date>/);
  assert.match(t, /status `accepted`/);
});

test('docs: the scope-mode question marks no pick and states the evidence', () => {
  const t = doc('references/interview.md');
  assert.match(t, /"Workflow: systems, their steps and features"/);
  assert.match(t, /"Classic: one flat list of requirements"/);
  assert.doesNotMatch(t + doc('SKILL.md'), /recommended option first|Recommend a mode|Recommend `workflow`|recommend `classic`|recommend one from the input/);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test S/scripts/test/review-page.test.mjs`
Expected: FAIL, with `SKILL.md` matching `review decisions` and `interview.md` matching `Copy decisions`.

- [ ] **Step 3: Rewrite `S/references/interview.md`**

§1: append to the "Triage rule" paragraph:

```markdown
Every question you ask closes (§2b); only gaps you never ask stay open
questions.
```

§2 rule 2 — replace with:

```markdown
2. Ground every question in what the client said: "You mentioned approved
   contracts are stored in SharePoint. Does the new system need to A. read
   from it, B. write back, C. both, D. neither?" In the question tool the
   options are the choices (at most 4); free text arrives through "Other".
   Never recommend: no option is labelled or ordered as your pick. Options are: real answers when the input suggests them; one or
   more assumptions, each of which starts with "Assume" and states its
   boundary ("Assume under 1 hour offline; longer is a change request");
   and "Leave <thing> out of scope". There is no "Don't know" option.
   Every option names the input hint it rests on ("docx System 4 says
   dead spots inside the warehouse"), or says "no hint in the input".
```

§2 rule 7 — replace "(client doesn't know yet — record the question)" with "(client doesn't know yet — offer the assumptions that bound it)".

Insert a new §2b after §2a:

```markdown
## §2b How a question ends

Every question you ask closes one of three ways:

| The user picks | You record |
| --- | --- |
| a real answer, or one typed through "Other" | the item it settles, label `confirmed`, source the user (or the client) |
| "Assume …" | an ASM row: the option's text, impact high for P1 / medium for P2 / low for P3, status `accepted` (the PO decided it, so it never blocks `READY_FOR_ARCHITECTURE`), source `PO in interview, <date>`; the review page shows it ★ New |
| "Leave … out of scope" | FR scope `out` (or a `scope.out` entry when there is no FR); Part 3 lists it |

The user types "don't know" (or similar) in "Other" → ask once more with
the same options and say they must pick an assumption or leave it out —
the estimate cannot price an open gap. An asked question never stays
open. Gaps you never ask (P3) stay in the open-questions register for
engineers; the review page never shows it.
```

**§2a.** Replace the sentence "Only what you draft yourself (a workflow built from a feature list, a missing step) is `recommended`." with:

```markdown
Never draft systems, workflows or features yourself. Workflows come only
from the input: a diagram, or steps it lists. A system the input gives no
steps for has no workflow, and its features have `steps: []`. A gap you
see (a missing step, a feature the evidence implies) is a question for
the user; a yes adds it.
```

Keep the existing sentence that a system, feature or workflow the user asks for is `confirmed`, source `PO in interview, <date>`.

**§7 scope-mode question.** Replace from "Recommend a mode from the input…" through "…Absent means `classic`." with:

```markdown
Ask the mode in one question through the host's question tool. In the
question text, name the cues below that the input shows ("Your PRD names
two business areas, Warehouse ops and Invoicing, and draws a to-be
workflow"), or say it shows none. Mark no option as your pick. The options
say what each mode gives:

- "Workflow: systems, their steps and features"
- "Classic: one flat list of requirements"

The cues:

1. Two or more named business areas, each with its own features
   ("Warehouse ops", "Invoicing" — the word "system" is not required).
2. A to-be workflow, drawn as a diagram or listed as steps. An as-is
   diagram alone is not a cue: classic mode records as-is workflows too.

Skip the question when the user already named a mode, or on a re-run
(keep the existing `scopeMode`). Absent means `classic`.
```

**§7 workflow-mode question group.** Make items 2 and 3 and the paragraph after them read:

```markdown
2. **To-be workflows**: only those the input draws or lists as steps
   (short step names, 2–5 words, plus side exits and loops; sub-workflows
   say where they start and rejoin). A system without one is fine.
3. **Features**: per system, what the client asked for. Each one points at
   the steps it serves (`["*"]` for platform-wide ones such as login; `[]`
   when its system has no workflow) and lists its FRs. Every in-scope FR
   must land in a feature; an FR that fits nowhere is a question for the
   user, not a new feature.

Everything here comes from the input or the user's answers. Nothing is
drafted, so every system, workflow and feature is `confirmed` before the
review page (§8 refuses anything else). A workflow that grows in the
interview keeps its id.
```

**§8.** Replace the whole section with:

```markdown
## §8 PO review page (workflow mode)

After the fresh-eyes review, show the PO the scope in the shape of their
own document. Per system the page shows its purpose, the workflows the
input drew, and a feature table; then the assumptions. Rows added in the
interview carry ★ New and "Added: <source>". The page is read-only:
nothing to answer, nothing to paste. Open questions never appear on it.

1. `node scripts/review.mjs page --json <dir>/requirements.json --out <dir>/review.html`.
   Exit 1 → show its lines.
   - `not decided; ask the PO in the interview` → ask that item as one
     question (§2), record the answer (§2b), and re-run.
   - Any other line → fix those fields in the JSON (no ids in text the PO
     sees) and re-run.
2. Show it.
   - claude.ai: present the file. It shows as a file card, and a click
     opens the page beside the chat. Don't rebuild it as an artifact.
   - Claude Code: give the path.

   Say in one line: check it reads like your document; tell me in chat
   anything to change.
3. A change in chat is a re-run (SKILL.md Re-run). Ask one question per
   unclear change, edit the JSON, re-run `scope` and validate, then go to
   step 1 again.

The user says skip or later → go to step 11.
```

- [ ] **Step 4: Rewrite the SKILL.md parts**

In `S/SKILL.md`:

**Hard rule 3** becomes:

```markdown
3. Unknowns are never silently filled, and an asked question never stays
   open. It closes as an answer, an assumption the user picked
   ("Assume …"), or out of scope. Only gaps you never ask stay open
   questions. Distinguish unknown (client doesn't know: offer bounded
   assumptions) from undecided (client must choose: present the options).
```

**Step 2's scope-mode sentence** ("Scope mode: recommend one from the input, then confirm it with the user in one question through the host's question tool (§7).") becomes:

```markdown
Scope mode: ask it in one question through the host's question tool,
naming the evidence and marking no pick (§7).
```

**Step 10** becomes:

```markdown
10. **Review page** (workflow mode): `references/interview.md` §8. A
    read-only page in the shape of the PO's own document. Classic mode:
    go to step 11.
```

**The last sentence of step 11** becomes:

```markdown
Workflow mode: end with one line: say **review page** any time to see it
again.
```

**Replace the whole `## Review decisions` section**, including the "Decided items never leave scope silently…" paragraph, with:

```markdown
## Review page

The user says "review page" (any session) and the lead has a
workflow-mode `requirements.json` → re-run step 10. Nothing else is asked.
A change the PO wants is a re-run (below), then the page again.
```

**Step 8.** Keep "The same holds for `scope` and `review` below."

- [ ] **Step 5: Rewrite the writing.md, review.md and README parts**

`S/references/writing.md`:

- Replace the sentences from "The PO review adds `review` on decided items…" through "…(`review.mjs page` refuses one)." with:

```markdown
Assumptions may carry `source`; one the PO picked in the interview has
`source: "PO in interview, <date>"`. Every question asked in the
interview closes as an answer, an assumption or out of scope, so
`openQuestions` holds only gaps never asked (P3), for engineers. `systems`, `features` and to-be
workflows hold only what will be built; downstream skills read them as
is. A system may have no workflow, and a feature may have `steps: []`.
Names, `purpose`, `does`, steps, branch labels, `share`, a `PO in
interview` source, and the text of every assumption that is not
`resolved` reach the PO review page verbatim. Write them without ids
(`review.mjs page` refuses one).
```

- In the Part 2 paragraph, delete `; a "Left out in review" table when the PO declined something`. Replace "No ⚠ marks or "please confirm" banners: the PO decides on the review page, and the md is written after it." with:

```markdown
No ⚠ marks or "please confirm" banners: scope is decided in the
interview, and the md is written after the review page.
```

`S/references/review.md`, checklist item 1: append ` (a system, workflow or feature: raise it as an interview question instead of downgrading it).` to the item's sentence.

`S/README.md`: replace "the product owner decides the drafts on a review page (`scripts/review.mjs`, business words only, answers pasted back into chat), then" with:

```markdown
the product owner sees the scope on a read-only review page
(`scripts/review.mjs`, in the shape of their own document, business words
only), then
```

- [ ] **Step 6: Run the docs tests to see them pass**

Run: `node --test S/scripts/test/review-page.test.mjs`
Expected: PASS. If a pattern still matches, grep the named file for it and reword that line. Keep the rule, drop the old phrase.

- [ ] **Step 7: Evals**

```bash
/usr/bin/git rm -r plugins/business-analyst/evals/ba-review-decisions
/usr/bin/git rm plugins/business-analyst/evals/ba-review-page/graders/page-not-tickboxes.md
```

Create `plugins/business-analyst/evals/ba-review-page/graders/decide-in-interview.md`:

```markdown
---
type: llm
focus: trace
---

The lead's requirements.json still holds two items the BA drafted: the
workflow "Order to cash" and the feature "Invoice from packed quantities".
The review page shows decided scope only, so these must be settled with
the PO in the interview first. This sandbox has no Bash, so the agent may
not be able to run scripts.

PASS if the agent asks the PO about one of those two items as ONE question
(question tool or plain text) whose options carry no "(Recommended)" and
any assumption option starts with "Assume", or names `review.mjs page` as
the next step and says it will refuse until those two are decided.
FAIL if it tells the PO to press Copy decisions or paste anything back,
asks about several items in one question, marks an option as recommended,
offers "Don't know" as an option, or writes requirements.md first.
```

Replace `plugins/business-analyst/evals/ba-interview-first-turn/graders/one-scope-question.md` with:

```markdown
---
type: llm
weight: 1
---

The PRD names two business areas (Warehouse operations, Invoicing), each
with its own features, and draws a to-be workflow. The user named no
scope mode.

PASS if the reply asks the user exactly one question, that question
asks for the scope mode (workflow vs classic), the question text cites
evidence from this PRD (the named areas or the workflow diagram), and no
option is marked as the agent's pick.
FAIL if the reply asks two or more questions, asks something else first,
marks an option "(Recommended)" or otherwise as its pick, or gives no
evidence.
```

Leave `prompt.md`, `case.yaml`, `fixture.sh` and `graders/skill-fired.md` as they are.

- [ ] **Step 8: Run the whole BA suite**

Run: `node --test S/scripts/test/*.test.mjs`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
/usr/bin/git add -A plugins/business-analyst
/usr/bin/git commit -m "docs(business-analyst): interview settles scope; page is read-only"
```

---

### Task 5: Estimate and proposal pages cope with a system that has no workflow

Task 3 lets a system have no workflow and a feature have `steps: []`. The
estimate and proposal pages read the same `requirements.json`. A probe on
this branch, rebased on `6d8cd35`, found:

- **Workflow-based estimate page:** it throws
  `TypeError: Cannot read properties of null (reading 'missing')` at
  `estimate-template.html:337`, because `score-html.mjs` sets
  `main: null`.
- **Component-based estimate page:** renders clean.
- **Score review:** renders clean (its systems use
  `flowsOf(...).filter(Boolean)`).
- **Proposal Systems & Workflows page and its DOCX:** render clean. The
  workflow-less system gets no diagram and keeps its feature table.

Only the Workflow-based page needs a code fix. The others get regression tests so it stays that way. The Workflow-based card also changes its words: `missing` is never set anywhere, so the old "workflow suggested by us, confirmed by PO" branch is dead text.

**Versions:** no bump here. solution-architect bumps in separate release commits (`5aa8562 chore: bump solution-architect to 3.0.1`, `82daedf chore: bump plugin versions for release`). The four workflow-estimator specs merged without one, so this task leaves `plugin.json` and `marketplace.json` at 3.0.1.

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/workflow-based/assets/estimate-template.html` (line ~207 how-to text, line ~337 system card)
- Modify: `plugins/solution-architect/skills/estimate/workflow-based/scripts/test/stage.mjs` (add `noFlowsAt`)
- Test: `plugins/solution-architect/skills/estimate/workflow-based/scripts/test/pages-browser.test.mjs`, `plugins/solution-architect/skills/estimate/workflow-based/scripts/test/browser.test.mjs`, `plugins/solution-architect/skills/proposal/scripts/test/workflow-view.test.mjs`, `plugins/solution-architect/skills/proposal/scripts/test/workflow-browser.test.mjs`

**Interfaces:**
- Produces: `noFlowsAt(dir)` in the estimate `stage.mjs`. It edits `<dir>/requirements.json` in place: WF-003 and WF-004 are gone, SYS-002 has `workflows: []`, and FEAT-003 and FEAT-004 have `steps: []`. It is the same edit as the BA `noFlows()` from Task 3. The estimate fixture `requirements.json` is byte-identical to the BA `requirements-workflow-pass.json`.

- [ ] **Step 1: Add the helper**

Append to `plugins/solution-architect/skills/estimate/workflow-based/scripts/test/stage.mjs`:

```js
// SYS-002 as a PO document that lists features but draws no workflow: the
// system owns none and its features sit on no step (BA 0.4.0 allows it).
export function noFlowsAt(dir) {
  const path = join(dir, 'requirements.json');
  const req = JSON.parse(readFileSync(path, 'utf8'));
  const gone = new Set(['WF-003', 'WF-004']);
  req.workflows = req.workflows.filter((w) => !gone.has(w.id));
  req.systems[1].workflows = [];
  for (const f of req.features.slice(2, 4)) f.steps = [];
  writeFileSync(path, JSON.stringify(req));
}
```

- [ ] **Step 2: Write the failing estimate tests**

In `pages-browser.test.mjs`, add `import { staged, noFlowsAt } from './stage.mjs';` (replacing the `staged` import). Then append:

```js
test('a system with no workflow: Workflow-based page draws it, the card says so, no errors', { skip }, async () => {
  const page = await openPage(pages(null, noFlowsAt)('estimate.html'));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    const metas = JSON.parse(await page.eval(`JSON.stringify([...document.querySelectorAll('#syscards .sys .meta')].map((m) => m.textContent))`));
    assert.match(metas[0], /workflow from the PO's document/);
    assert.match(metas[1], /no workflow in the PO's document/);
    assert.doesNotMatch(await page.eval('document.body.textContent'), /suggested by us|Each system has its workflows/);
    assert.match(await text(page, 'tr[data-feat="FEAT-003"]'), /not on a workflow step/);
  } finally { await page.close(); }
});

test('a system with no workflow: Component-based page renders clean', { skip }, async () => {
  const page = await openPage(pages(null, noFlowsAt)('estimate-components.html'));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.match(await text(page, 'tr[data-cap="FEAT-003"]'), /off-step/);
  } finally { await page.close(); }
});
```

In `browser.test.mjs`, add `import { noFlowsAt } from './stage.mjs';` and append:

```js
test('a system with no workflow renders clean on the score review', { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-noflow-'));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  noFlowsAt(dir);
  writeFileSync(join(dir, 'estimation-inputs.json'), readFileSync(fx('inputs-pass.json'), 'utf8'));
  execFileSync('node', [script, '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  const page = await openPage(pathToFileURL(join(dir, 'review.html')).href);
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.match(await page.eval(`document.querySelector('tr[data-cap="FEAT-003"]').textContent`), /off-step/);
  } finally { await page.close(); }
});
```

- [ ] **Step 3: Write the proposal regression tests**

In `plugins/solution-architect/skills/proposal/scripts/test/workflow-view.test.mjs`, add `import { noFlowsAt } from '../../../estimate/workflow-based/scripts/test/stage.mjs';` and append:

```js
test('a system the PO document draws no workflow for: no flows, features still listed', () => {
  const l = lead();
  noFlowsAt(l.dir);
  const { est: e, req: r } = loadLead(l.estimation);
  const v = proposalView({ est: e, req: r, inputs: passInputs() });
  assert.deepEqual(v.systems[1].flows, []);
  assert.deepEqual(v.systems[1].features.map((f) => f.name), ['Order intake & quotation', 'Invoice from packed quantities', 'One login, role-based screens']);
});
```

In `workflow-browser.test.mjs`, give `proposalUrl` an edit hook, and import `noFlowsAt` as above:

```js
function proposalUrl(stub = DRAWING_STUB, edit = null) {
  const l = lead();
  if (edit) edit(l.dir);
  // …rest unchanged
}
```

Then append:

```js
test('a system with no workflow: one diagram fewer on the page and in the DOCX, no errors', { skip }, async () => {
  const page = await openPage(proposalUrl(DRAWING_STUB, noFlowsAt));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval('document.querySelectorAll(".mermaid-canvas svg").length'), 1);
    const files = readZip(Buffer.from(await page.eval('window.__buildDocx()'), 'base64'));
    assert.deepEqual([...files.keys()].filter((k) => k.startsWith('word/media/')), ['word/media/image1.png']);
  } finally { await page.close(); }
});
```

- [ ] **Step 4: Run them**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/pages-browser.test.mjs plugins/solution-architect/skills/estimate/workflow-based/scripts/test/browser.test.mjs plugins/solution-architect/skills/proposal/scripts/test/workflow-view.test.mjs plugins/solution-architect/skills/proposal/scripts/test/workflow-browser.test.mjs`

Expected:

- The Workflow-based test FAILS: `page.errors` holds `TypeError: Cannot read properties of null (reading 'missing')`.
- The Component-based, score-review and both proposal tests PASS already. They are regression guards, as the probe found; say so in the task report.
- If any of them fails, fix that page in this task with the same care, and name it in the report.

- [ ] **Step 5: Fix the Workflow-based page**

In `estimate-template.html`, inside `renderSystems`, replace
`${s.main.missing ? 'workflow suggested by us, confirmed by PO' : 'workflow from the PO\'s document'}` with:

```js
${s.main ? 'workflow from the PO\'s document' : 'no workflow in the PO\'s document'}
```

At line ~207, replace the how-to sentence "Each system has its workflows; each feature sits on the workflow steps it serves." with:

```html
A system has the workflows the PO's document draws; each feature sits on the steps it serves, or on none when its system has no workflow.
```

- [ ] **Step 6: Run the estimate and proposal suites**

Run: `node --test plugins/solution-architect/skills/estimate/workflow-based/scripts/test/*.test.mjs plugins/solution-architect/skills/proposal/scripts/test/*.test.mjs`
Expected: PASS. The template's per-function gates are checked by the estimate `quality-gates.test.mjs`, and the edit adds no function.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add plugins/solution-architect/skills/estimate plugins/solution-architect/skills/proposal
/usr/bin/git commit -m "fix(estimate): draw a system that has no workflow"
```

---

### Task 6: Verify the branch

**Files:** none changed unless a check fails. A failure is fixed in the task that owns the file, with a test first.

- [ ] **Step 1: Full suite**

Run: `npm test` from the worktree root.
Expected: PASS. One known flaky test may fail: `plugins/solution-architect/skills/estimate/workflow-based/scripts/test/browser.test.mjs:54`, which this branch does not touch. If it fails, re-run that file alone and record both results.

- [ ] **Step 2: Leftover scan**

Run: `/usr/bin/grep -rn "leftOut\|left_out\|review-decisions\|review_apply\|review-guard\|reviewDecisions\|Copy decisions\|No, keep them" plugins/business-analyst`
Expected: only lines under `plugins/business-analyst/evals/results/` (old run logs), nothing else.

- [ ] **Step 3: Smoke on the PO's real file**

The PO's tested package is at `~/Downloads/requirements.json`. Copy it to a scratch dir. Never write next to the original.

```bash
mkdir -p /tmp/ba-smoke && cp ~/Downloads/requirements.json /tmp/ba-smoke/r.json
node plugins/business-analyst/skills/business-analyst/scripts/review.mjs page --json /tmp/ba-smoke/r.json --out /tmp/ba-smoke/review.html
python3 plugins/business-analyst/skills/business-analyst/scripts/review.py page --json /tmp/ba-smoke/r.json --out /tmp/ba-smoke/review-py.html
cmp /tmp/ba-smoke/review.html /tmp/ba-smoke/review-py.html
```

Expected: both commands print `review page written: …` and `cmp` prints nothing. The file was made by 0.4.0 and holds `leftOut` and `review` keys, which are now ignored. If either command exits 1, report the lines verbatim; they show what the interview must settle and are not a bug in themselves.

- [ ] **Step 4: Eval**

Run in the background (about $1, a few minutes):

```bash
claude plugin eval plugins/business-analyst --case 'ba-review-*' --case 'ba-interview-first-turn' --runs 1 --ablation none --no-publish --trust-plugin --scaffold
```

Expected: `ba-review-page` and `ba-interview-first-turn` score 1.00. (If `--case` does not take two values, run the command twice, once per case.) If it doesn't, read the transcript and decide whether the docs or the grader is wrong. Fix it with a docs-test-first change, and say which.

- [ ] **Step 5: Report**

Report back:

- the commits made, sha and subject;
- the test count from `node --test S/scripts/test/*.test.mjs`;
- the eval score;
- the smoke result.

Stop there. Do not merge; the user tests the new `.skill` first.
