# BA Review Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The product owner decides the draft workflow scope on a non-technical review page, pastes the decisions back, and `requirements.json` records them (declined items move to `leftOut`); `requirements.md` becomes the engineer view written after the review.

**Architecture:** Node scripts with byte-identical Python twins (parity-tested), as `scope` and `validate` already are. `left-out.mjs` moves declined scope out of the live lists and back. `review-data.mjs` turns `requirements.json` into business-words page data; a fixed template (`assets/review-page.html`) plus a pure decisions script (`assets/review-decisions.js`) make the page; `review-apply.mjs` turns the pasted block back into JSON. `scope` renders the md with IDs and a left-out table; `validate` gains review rules and a JSON-only mode.

**Tech Stack:** Node ≥ 20 (`node:test`), Python ≥ 3.10, plain HTML/JS, headless Chrome for browser tests (via `plugins/solution-architect/skills/analyze-requirements/scripts/lib/cdp.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-07-ba-review-page-design.md` (decisions R1–R12). Mockup: `docs/mockups/ba-review-page/mockup.html` (deleted when the read-only page superseded this plan; see git history).

**How this plan was checked:** every task below was replayed on a clean export of this branch at `75891fb` (`git archive`): each "see them fail" run failed, each suite run passed, ending at 210 BA tests (baseline 119) and `npm test` green. The code blocks are the replayed files, byte for byte. If a step does not behave as written, stop and report — do not improvise.

## Global Constraints

- Paths: `S = plugins/business-analyst/skills/business-analyst`; all commands run from the repo (worktree) root.
- Node modules: ≤ 200 lines, ≤ 10 functions, ≤ 22 lines per function, ≤ 3 params (`scripts/test/quality-gates.test.mjs` checks the new ones; `checks.mjs` predates the gates and only shrinks here). Template script: ≤ 22 lines per function, ≤ 3 params.
- Python twins produce identical output: same finding strings, same page bytes, same `apply` JSON bytes and stdout.
- R3: nothing a PO sees on the page carries an ID, FR text, priority, label or score.
- Page data values are never `undefined` (use `null`), so Node and Python serialise the same bytes.
- `systems`, `features` and to-be `workflows` hold only what will be built; declined items live in `leftOut`, written only by `review apply`.
- Classic mode: no page, no `leftOut`, md exactly as today.
- Never `git stash`; `/usr/bin/git`, one command per Bash call. Conventional Commits, no AI attribution lines of any kind.
- Version 0.4.0 in `plugins/business-analyst/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.

## Review Focus

1. A paste mangled by chat (curly quotes, cut off) → `apply` refuses with one line, never a stack trace (test: `a mangled paste is refused cleanly`, Task 6).
2. A paste from an older page after the JSON changed → unknown id refused, file untouched (tests: `wrong lead, unknown id…`, `a refused paste leaves the file byte-identical`, Task 6).
3. Markup or quotes in a feature name → shown as text, cannot break the page or its data script (tests: `markup in a name shows as text`, Task 5 browser; `a name cannot close the data script tag`, Task 5).
4. "No" after an earlier "yes" (re-review) → item moves out and drops its old `review` (test: `no after an earlier yes…`, Task 6).
5. A review where nothing is answered → accepted, JSON unchanged, `0 decided, N still open` (test: `a review with nothing answered…`, Task 6).

---

### Task 1: Manual check — how claude.ai shows a script-made page (with the user)

Spec §7, plan task 1. Needs the user; start it first, the rest does not wait for it.

- [ ] **Step 1: Ask the user to try it.** Give them `docs/mockups/ba-review-page/mockup.html` and ask: in a claude.ai chat with code execution, have Claude write that file to disk and present it — does it show as a rendered artifact, or only as a download?
- [ ] **Step 2: Record the answer** in the final report. SKILL/interview wording (Task 7) already covers both outcomes ("if the file does not render by itself, create the artifact from its contents"); change it only if the user reports something else.

### Task 2: Move declined scope out and back (`left-out`)

**Files:**
- Create: `plugins/business-analyst/skills/business-analyst/scripts/lib/left-out.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/left_out.py`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/left-out.test.mjs`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs` (imports + one block at the end)

**Interfaces:**
- Produces: `kindOf(id) → "system"|"workflow"|"feature"`; `entryOf(pkg, id) → leftOut entry | null`; `moveOut(pkg, id, { note, date }) → entry` (mutates pkg); `moveBack(pkg, id)` (mutates pkg; deletes `leftOut` when empty); `restoreAll(pkg) → { view, out: Map<id, decided entry> }` (pure; view = deep copy with every decided entry moved back).
- Python twin `left_out.py`: `kind_of`, `entry_of`, `move_out(pkg, rid, note, date)`, `move_back(pkg, rid)`, `restore_all(pkg) → (view, out_dict)`.
- Entry shape (key order matters for parity): `id, kind, system?, at?, index, via?, date, frsOut, note?, outAdded?, item`. `at` = index in the owner system's list (absent for `via` children and systems); `index` = index in the top-level array; `note`/`outAdded` only on the decided entry.

- [ ] **Step 1: Write the failing tests**

Write `plugins/business-analyst/skills/business-analyst/scripts/test/left-out.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveOut, moveBack, restoreAll } from '../lib/left-out.mjs';
import { loadWorkflow } from './scope-cases.mjs';

const fresh = () => loadWorkflow().pkg;
const ON = { note: 'not now', date: '2026-10-07' };

test('a feature moves out with its FRs and its name in scope.out', () => {
  const pkg = fresh();
  moveOut(pkg, 'FEAT-004', ON);
  assert.ok(!pkg.features.some((f) => f.id === 'FEAT-004'));
  assert.ok(!pkg.systems[1].features.includes('FEAT-004'));
  assert.equal(pkg.requirements.find((r) => r.id === 'FR-004').scope, 'out');
  assert.deepEqual(pkg.scope.out, ['last-mile delivery tracking', 'Invoice from packed quantities']);
  const { item, ...entry } = pkg.leftOut[0];
  assert.deepEqual(entry, { id: 'FEAT-004', kind: 'feature', system: 'SYS-002', at: 1, index: 3, date: '2026-10-07', frsOut: ['FR-004'], note: 'not now', outAdded: true });
  assert.equal(item.name, 'Invoice from packed quantities');
});

test('a system takes its features and workflows with it', () => {
  const pkg = fresh();
  moveOut(pkg, 'SYS-002', ON);
  assert.deepEqual(pkg.systems.map((s) => s.id), ['SYS-001']);
  assert.deepEqual(pkg.features.map((f) => f.id), ['FEAT-001', 'FEAT-002']);
  assert.deepEqual(pkg.leftOut.map((e) => [e.id, e.via ?? null]), [
    ['FEAT-003', 'SYS-002'], ['FEAT-004', 'SYS-002'], ['FEAT-005', 'SYS-002'],
    ['WF-003', 'SYS-002'], ['WF-004', 'SYS-002'], ['SYS-002', null]]);
  assert.deepEqual(pkg.scope.out, ['last-mile delivery tracking', 'Orders & invoicing']);
});

for (const ids of [['FEAT-004'], ['WF-003'], ['SYS-002'], ['FEAT-004', 'SYS-001', 'WF-004']]) {
  test(`out then back restores the exact JSON: ${ids.join(', ')}`, () => {
    const pkg = fresh();
    for (const id of ids) moveOut(pkg, id, ON);
    assert.deepEqual(restoreAll(pkg).view, fresh());
    for (const id of [...ids].reverse()) moveBack(pkg, id);
    assert.deepEqual(pkg, fresh());
  });
}

test('a name already in scope.out is not added twice, and stays on the way back', () => {
  const pkg = fresh();
  pkg.scope.out.push('Invoice from packed quantities');
  moveOut(pkg, 'FEAT-004', ON);
  assert.equal(pkg.leftOut[0].outAdded, false);
  moveBack(pkg, 'FEAT-004');
  assert.deepEqual(pkg.scope.out, ['last-mile delivery tracking', 'Invoice from packed quantities']);
});
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { CASES, loadWorkflow } from './scope-cases.mjs';
~~~~

with

~~~~js
import { CASES, loadWorkflow } from './scope-cases.mjs';
import { moveOut } from '../lib/left-out.mjs';
~~~~

Append to the end of `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs`:

~~~~js

const scriptsDir = fileURLToPath(new URL('..', import.meta.url));
const PY_MOVE = `import json, sys
sys.path.insert(0, sys.argv[1])
from left_out import move_out, move_back
pkg = json.load(sys.stdin)
for rid in sys.argv[2].split(','):
    move_out(pkg, rid, 'n', '2026-10-07')
out = json.dumps(pkg, separators=(',', ':'), ensure_ascii=False)
for rid in reversed(sys.argv[2].split(',')):
    move_back(pkg, rid)
print(out)
print(json.dumps(pkg, separators=(',', ':'), ensure_ascii=False))`;

for (const ids of [['FEAT-004'], ['SYS-002'], ['FEAT-004', 'SYS-001', 'WF-004']]) {
  test(`left_out.py moves out and back like left-out.mjs: ${ids.join(', ')}`, () => {
    const pkg = loadWorkflow().pkg;
    const node = structuredClone(pkg);
    for (const id of ids) moveOut(node, id, { note: 'n', date: '2026-10-07' });
    const [out, back] = execFileSync('python3', ['-c', PY_MOVE, scriptsDir, ids.join(',')],
      { input: JSON.stringify(pkg), encoding: 'utf8' }).trim().split('\n');
    assert.equal(out, JSON.stringify(node));
    assert.equal(back, JSON.stringify(pkg));
  });
}
~~~~

- [ ] **Step 2: Run them to see them fail**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/left-out.test.mjs plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs 2>&1 | tail -8`
Expected: FAIL — `Cannot find module …/lib/left-out.mjs`.

- [ ] **Step 3: Write `left-out.mjs`**

Write `plugins/business-analyst/skills/business-analyst/scripts/lib/left-out.mjs` (whole file):

~~~~js
// Declined scope leaves the live lists (spec R12): systems, workflows and
// features hold only what will be built, so no downstream skill has to filter.
// A "no" moves an item into pkg.leftOut; a later "yes" puts it back exactly.
const LISTS = { system: 'systems', workflow: 'workflows', feature: 'features' };
const OWNED = { workflow: 'workflows', feature: 'features' };

export const kindOf = (id) => (id.startsWith('SYS-') ? 'system' : id.startsWith('FEAT-') ? 'feature' : 'workflow');
export const entryOf = (pkg, id) => (pkg.leftOut ?? []).find((e) => e.id === id) ?? null;

function frsOut(pkg, item) {
  const ids = new Set(item.requirements ?? []);
  const moved = (pkg.requirements ?? []).filter((fr) => ids.has(fr.id) && fr.scope === 'in');
  for (const fr of moved) fr.scope = 'out';
  return moved.map((fr) => fr.id);
}

// via: the left-out system this item travels with; it then stays in that
// system's own lists, so only the top-level array changes.
function pull(pkg, id, { via, date }) {
  const kind = kindOf(id);
  const list = pkg[LISTS[kind]];
  const index = list.findIndex((r) => r.id === id);
  const [item] = list.splice(index, 1);
  const owner = OWNED[kind] ? pkg.systems.find((s) => (s[OWNED[kind]] ?? []).includes(id)) : null;
  const entry = { id, kind };
  if (owner) entry.system = owner.id;
  if (owner && !via) {
    entry.at = owner[OWNED[kind]].indexOf(id);
    owner[OWNED[kind]].splice(entry.at, 1);
  }
  Object.assign(entry, { index }, via ? { via } : {}, { date, frsOut: kind === 'feature' ? frsOut(pkg, item) : [] });
  (pkg.leftOut ??= []).push(entry);
  return Object.assign(entry, { item });
}

export function moveOut(pkg, id, { note, date }) {
  if (kindOf(id) === 'system') {
    const sys = pkg.systems.find((s) => s.id === id);
    for (const f of sys.features ?? []) pull(pkg, f, { via: id, date });
    for (const w of sys.workflows ?? []) pull(pkg, w, { via: id, date });
  }
  const entry = pull(pkg, id, { date });
  const { item } = entry;
  delete entry.item;
  if (note) entry.note = note;
  entry.outAdded = !pkg.scope.out.includes(item.name);
  if (entry.outAdded) pkg.scope.out.push(item.name);
  entry.item = item;
  return entry;
}

function put(pkg, e) {
  const list = pkg[LISTS[e.kind]];
  list.splice(Math.min(e.index, list.length), 0, e.item);
  const owner = e.at === undefined ? null : pkg.systems.find((s) => s.id === e.system);
  if (owner) owner[OWNED[e.kind]].splice(Math.min(e.at, owner[OWNED[e.kind]].length), 0, e.id);
  for (const fr of pkg.requirements ?? []) if (e.frsOut.includes(fr.id)) fr.scope = 'in';
  if (e.outAdded) pkg.scope.out.splice(pkg.scope.out.indexOf(e.item.name), 1);
}

export function moveBack(pkg, id) {
  const mine = (e) => e.id === id || e.via === id;
  for (const e of pkg.leftOut.filter(mine).reverse()) put(pkg, e);
  pkg.leftOut = pkg.leftOut.filter((e) => !mine(e));
  if (!pkg.leftOut.length) delete pkg.leftOut;
}

// The page shows declined items in their old place, pre-filled "no".
export function restoreAll(pkg) {
  const view = structuredClone(pkg);
  const decided = (view.leftOut ?? []).filter((e) => !e.via);
  for (const e of [...decided].reverse()) moveBack(view, e.id);
  return { view, out: new Map(decided.map((e) => [e.id, e])) };
}
~~~~

- [ ] **Step 4: Write the Python twin**

Write `plugins/business-analyst/skills/business-analyst/scripts/left_out.py` (whole file):

~~~~python
"""Declined scope leaves the live lists; mirrors lib/left-out.mjs (parity-tested)."""
import copy

LISTS = {'system': 'systems', 'workflow': 'workflows', 'feature': 'features'}
OWNED = {'workflow': 'workflows', 'feature': 'features'}


def kind_of(rid):
    return 'system' if rid.startswith('SYS-') else 'feature' if rid.startswith('FEAT-') else 'workflow'


def entry_of(pkg, rid):
    return next((e for e in pkg.get('leftOut') or [] if e['id'] == rid), None)


def frs_out(pkg, item):
    ids = set(item.get('requirements') or [])
    moved = [fr for fr in pkg.get('requirements') or [] if fr['id'] in ids and fr.get('scope') == 'in']
    for fr in moved:
        fr['scope'] = 'out'
    return [fr['id'] for fr in moved]


def pull(pkg, rid, opts):
    via, date = opts.get('via'), opts['date']
    kind = kind_of(rid)
    lst = pkg[LISTS[kind]]
    index = next(i for i, r in enumerate(lst) if r['id'] == rid)
    item = lst.pop(index)
    owner = next((s for s in pkg['systems'] if rid in (s.get(OWNED[kind]) or [])), None) if kind in OWNED else None
    entry = {'id': rid, 'kind': kind}
    if owner:
        entry['system'] = owner['id']
    if owner and not via:
        entry['at'] = owner[OWNED[kind]].index(rid)
        owner[OWNED[kind]].pop(entry['at'])
    entry['index'] = index
    if via:
        entry['via'] = via
    entry['date'] = date
    entry['frsOut'] = frs_out(pkg, item) if kind == 'feature' else []
    pkg.setdefault('leftOut', []).append(entry)
    entry['item'] = item
    return entry


def move_out(pkg, rid, note, date):
    if kind_of(rid) == 'system':
        sys_ = next(s for s in pkg['systems'] if s['id'] == rid)
        for f in list(sys_.get('features') or []):
            pull(pkg, f, {'via': rid, 'date': date})
        for w in list(sys_.get('workflows') or []):
            pull(pkg, w, {'via': rid, 'date': date})
    entry = pull(pkg, rid, {'date': date})
    item = entry.pop('item')
    if note:
        entry['note'] = note
    entry['outAdded'] = item['name'] not in pkg['scope']['out']
    if entry['outAdded']:
        pkg['scope']['out'].append(item['name'])
    entry['item'] = item
    return entry


def put(pkg, e):
    lst = pkg[LISTS[e['kind']]]
    lst.insert(min(e['index'], len(lst)), e['item'])
    owner = next((s for s in pkg['systems'] if s['id'] == e.get('system')), None) if 'at' in e else None
    if owner:
        own = owner[OWNED[e['kind']]]
        own.insert(min(e['at'], len(own)), e['id'])
    for fr in pkg.get('requirements') or []:
        if fr['id'] in e['frsOut']:
            fr['scope'] = 'in'
    if e.get('outAdded'):
        pkg['scope']['out'].remove(e['item']['name'])


def move_back(pkg, rid):
    def mine(e):
        return e['id'] == rid or e.get('via') == rid
    for e in reversed([e for e in pkg['leftOut'] if mine(e)]):
        put(pkg, e)
    pkg['leftOut'] = [e for e in pkg['leftOut'] if not mine(e)]
    if not pkg['leftOut']:
        del pkg['leftOut']


def restore_all(pkg):
    view = copy.deepcopy(pkg)
    decided = [e for e in view.get('leftOut') or [] if not e.get('via')]
    for e in reversed(decided):
        move_back(view, e['id'])
    return view, {e['id']: e for e in decided}
~~~~

- [ ] **Step 5: Run the BA suite**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`.

- [ ] **Step 6: Commit** (one command per call)

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/left-out.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/left_out.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/left-out.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs
/usr/bin/git commit -m "feat(business-analyst): move declined scope to leftOut and back"
```

### Task 3: requirements.md becomes the engineer view

**Files:**
- Modify (full rewrite): `plugins/business-analyst/skills/business-analyst/scripts/lib/scope-render.mjs`
- Modify (full rewrite): `plugins/business-analyst/skills/business-analyst/scripts/lib/scope-md.mjs`
- Modify (full rewrite): `plugins/business-analyst/skills/business-analyst/scripts/scope_render.py`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/lib/checks.mjs` (4 edits)
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/validate.py` (4 edits)
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/review-fixture.mjs`
- Modify (full rewrite): `plugins/business-analyst/skills/business-analyst/scripts/test/scope-md.test.mjs`
- Regenerate: `plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.md`

**Interfaces:**
- Consumes: `moveOut` (Task 2).
- Produces: `review-fixture.mjs` exports `DATE = "2026-10-07"`, `withQuestion(pkg) → pkg` (adds unpaired Q-003), `decisions(list, skipped=[]) → decisions block`, `YES_WF3`, `NO_FEAT4`, `ANSWER_Q3`, `reviewed() → { pkg, md }` (the pass pair after WF-003 yes, FEAT-004 no, Q-003 answered; built with `moveOut`, not apply).
- `renderScope(pkg)` output: IDs in headings and first table column, `Requirements` column, optional `Reviewed by PO on <date>: N decided, M still open for the client.` line, optional `### Left out in review` table. `START_HERE` export is removed.
- `collectIds(pkg)` now includes `leftOut` ids; `checkMd` requires every collectIds + scopeIds id in the md.

- [ ] **Step 1: Write the failing tests**

Write `plugins/business-analyst/skills/business-analyst/scripts/test/review-fixture.mjs` (whole file):

~~~~js
// Review-state fixtures built from the workflow pass pair, so no reviewed
// JSON is committed that could drift from the pass fixture.
import { applyScope } from '../lib/scope-md.mjs';
import { moveOut } from '../lib/left-out.mjs';
import { loadWorkflow } from './scope-cases.mjs';

export const DATE = '2026-10-07';

// One open question the page shows on its own (not paired with a card).
export function withQuestion(pkg) {
  pkg.openQuestions.push({
    id: 'Q-003', question: 'How many office staff will use the system?', priority: 'P2',
    reason: 'sizes the rollout', affects: [], status: 'open', answer: null, architectureBlocker: false,
  });
  return pkg;
}

export const decisions = (list, skipped = []) => ({ reviewDecisions: 1, lead: 'sin-kowa-mini', date: DATE, decisions: list, skipped });
export const YES_WF3 = { id: 'WF-003', name: 'Order to cash', answer: 'yes' };
export const NO_FEAT4 = { id: 'FEAT-004', name: 'Invoice from packed quantities', answer: 'no', note: 'we invoice from the signed DO' };
export const ANSWER_Q3 = { id: 'Q-003', question: 'How many office staff will use the system?', answer: 'About 6' };

// The pass pair after one yes, one no and one answered question, md
// re-scoped. Built by hand from moveOut so it does not depend on apply;
// review-apply.test.mjs proves apply produces exactly this JSON.
export function reviewed() {
  const { pkg, md } = loadWorkflow();
  withQuestion(pkg);
  const [q1, q2, q3] = pkg.openQuestions;
  Object.assign(pkg.workflows[2], { label: 'confirmed', source: `confirmed by PO in review, ${DATE}`, review: { answer: 'yes', date: DATE } });
  Object.assign(q1, { status: 'answered', answer: 'confirmed in review' });
  moveOut(pkg, 'FEAT-004', { note: NO_FEAT4.note, date: DATE });
  Object.assign(q2, { status: 'answered', answer: `left out in review: ${NO_FEAT4.note}` });
  Object.assign(q3, { status: 'answered', answer: 'About 6', review: { answer: 'About 6', date: DATE } });
  const body = md.replace('| FR-004 | Raise the invoice from packed-and-audited quantities | assumed | in | Invoice from packed quantities |',
    '| FR-004 | Raise the invoice from packed-and-audited quantities | assumed | out | — |')
    .replace('Scope — out: last-mile delivery tracking.', 'Scope — out: last-mile delivery tracking; Invoice from packed quantities.')
    .replace('shipping or at the signed delivery order?', 'shipping or at the signed delivery order? Q-003 (P2) — office staff count: about 6.');
  return { pkg, md: applyScope(body, pkg) };
}
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/test/scope-md.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyScope } from '../lib/scope-md.mjs';
import { mermaid } from '../lib/scope-render.mjs';
import { checkPackage } from '../lib/checks.mjs';
import { loadWorkflow } from './scope-cases.mjs';
import { reviewed } from './review-fixture.mjs';

const script = fileURLToPath(new URL('../scope.mjs', import.meta.url));
const BLOCK = /<!-- scope:start -->[\s\S]*?<!-- scope:end -->\n*/;
const strip = (md) => md.replace(BLOCK, '');
const OLD_HERE = '> **Product owner? Start here:** [To-be scope](#to-be-scope) shows the systems, '
  + 'workflows and features we propose to build. Items marked ⚠ are our draft; tell us in chat what to change.';

test('applyScope rebuilds the fixture from a file without the section', () => {
  const { pkg, md } = loadWorkflow();
  assert.equal(applyScope(strip(md), pkg), md);
});

test('applyScope is idempotent', () => {
  const { pkg, md } = loadWorkflow();
  assert.equal(applyScope(md, pkg), md);
});

test('an old Start-here line is removed on re-run', () => {
  const { pkg, md } = loadWorkflow();
  const old = md.replace(/^(# .*)$/m, `$1\n\n${OLD_HERE}`);
  assert.equal(applyScope(old, pkg), md);
});

test('classic mode removes the section', () => {
  const { pkg, md } = loadWorkflow();
  pkg.scopeMode = 'classic';
  const out = applyScope(md, pkg);
  assert.equal(out, strip(md));
});

test('the section carries ids for engineers', () => {
  const section = loadWorkflow().md.match(BLOCK)[0];
  assert.match(section, /^### SYS-002 Orders & invoicing$/m);
  assert.match(section, /^\*\*Main workflow: WF-003 Order to cash\*\*$/m);
  assert.match(section, /^\| SYS-001 \| Warehouse operations \|/m);
});

test('no draft marks anywhere; features list their requirements', () => {
  const { md } = loadWorkflow();
  assert.doesNotMatch(md, /⚠|please confirm|Start here/);
  assert.match(md, /\| FEAT-004 \| Invoice from packed quantities \| .* \| Shipped \(in Order pipeline\); Invoice → Paid \| FR-004 \|/);
});

test('mermaid: loops back to an existing step and side exits to a new one', () => {
  const out = mermaid({ steps: ['A', 'B'], branches: [{ from: 'B', to: 'A', label: 'retry' }, { from: 'A', to: 'C' }] });
  assert.equal(out, '```mermaid\nflowchart LR\n  n0 --> n1\n  n1 -.->|retry| n0\n  n0 -.-> n2\n  n0["A"]\n  n1["B"]\n  n2["C"]\n```');
});

test('scope.mjs refuses a broken scope and leaves the md alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-scope-'));
  const { pkg, md } = loadWorkflow();
  pkg.features[1].steps = ['WF-002:Nowhere'];
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  writeFileSync(join(dir, 'r.md'), 'untouched');
  assert.throws(() => execFileSync('node', [script, '--json', join(dir, 'r.json'), '--md', join(dir, 'r.md')], { stdio: 'pipe' }));
  assert.equal(readFileSync(join(dir, 'r.md'), 'utf8'), 'untouched');
  assert.ok(md.length > 0);
});

test('a pipe inside feature text is escaped so the table holds', () => {
  const { pkg, md } = loadWorkflow();
  pkg.features[0].does = 'Moves an order | shows each stage';
  const out = applyScope(md, pkg);
  assert.match(out, /\| FEAT-001 \| Order pipeline & stage engine \| Moves an order \\\| shows each stage \|/);
});

test('a step name with a colon resolves and renders', () => {
  const { pkg, md } = loadWorkflow();
  pkg.workflows[1].steps[1] = 'Pack: scan vs order';
  pkg.workflows[1].branches = [{ from: 'Pack: scan vs order', to: 'Short-pack alert' }];
  pkg.features[0].steps[1] = 'WF-002:Pack: scan vs order';
  assert.deepEqual(checkPackage({ pkg, md: applyScope(md, pkg) }), []);
  assert.match(applyScope(md, pkg), /Order In → Pack: scan vs order → Pack Review/);
});

test('markers moved by hand stay where they are on re-run', () => {
  const { pkg, md } = loadWorkflow();
  const section = md.match(BLOCK)[0];
  const moved = md.replace(section, '').replace('## Part 2 — Process & Domain\n\n', `## Part 2 — Process & Domain\n\n${section}`);
  assert.equal(applyScope(moved, pkg), moved);
});

test('a QUICK file (no Part 2) gets the section before Part 3', () => {
  const { pkg, md } = loadWorkflow();
  const quick = strip(md).replace(/## Part 2[\s\S]*?(?=## Part 3)/, '');
  const out = applyScope(quick, pkg);
  assert.ok(out.indexOf('<!-- scope:end -->') < out.indexOf('## Part 3'));
  assert.ok(out.indexOf('## Part 1') < out.indexOf('<!-- scope:start -->'));
});

test('optional fields absent: no map column, no Replaces line', () => {
  const { pkg, md } = loadWorkflow();
  delete pkg.mapLabel;
  for (const w of pkg.workflows) delete w.replaces;
  const section = applyScope(md, pkg).match(BLOCK)[0];
  assert.match(section, /\| ID \| System \| Purpose \|\n\| --- \| --- \| --- \|\n/);
  assert.doesNotMatch(section, /Replaces today's/);
});

test('scope.mjs refuses unbalanced markers and leaves the md alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-scope-'));
  const { pkg, md } = loadWorkflow();
  const broken = md.replace('<!-- scope:end -->', '');
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  writeFileSync(join(dir, 'r.md'), broken);
  assert.throws(() => execFileSync('node', [script, '--json', join(dir, 'r.json'), '--md', join(dir, 'r.md')], { stdio: 'pipe' }));
  assert.equal(readFileSync(join(dir, 'r.md'), 'utf8'), broken);
});

test('a pipe inside a feature name passes the Feature column check', () => {
  const { pkg, md } = loadWorkflow();
  pkg.features[0].name = 'Pack | ship';
  const out = applyScope(md, pkg).replace('| in | Order pipeline & stage engine |', '| in | Pack \\| ship |');
  assert.deepEqual(checkPackage({ pkg, md: out }), []);
});

test('the reviewed md shows the left-out table and the reviewed line', () => {
  const { md } = reviewed();
  assert.match(md, /^Reviewed by PO on 2026-10-07: 3 decided, 0 still open for the client\.$/m);
  assert.match(md, /### Left out in review\n\n\| ID \| Item \| PO note \| Date \|\n\| --- \| --- \| --- \| --- \|\n\| FEAT-004 \| Invoice from packed quantities \| we invoice from the signed DO \| 2026-10-07 \|/);
});
~~~~

- [ ] **Step 2: Run them to see them fail**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/scope-md.test.mjs 2>&1 | tail -8`
Expected: FAIL — ids missing from the section, ⚠ still present, no left-out table.

- [ ] **Step 3: Rewrite the Node renderer and md sync**

Write `plugins/business-analyst/skills/business-analyst/scripts/lib/scope-render.mjs` (whole file):

~~~~js
export const START = '<!-- scope:start -->';
export const END = '<!-- scope:end -->';

const stepOf = (ref) => ref.slice(ref.indexOf(':') + 1);
export const cell = (text) => String(text).replaceAll('|', '\\|');

export function mermaid(w) {
  const ids = new Map();
  const nid = (n) => {
    if (!ids.has(n)) ids.set(n, `n${ids.size}`);
    return ids.get(n);
  };
  const steps = w.steps ?? [];
  steps.forEach(nid);
  const lines = ['flowchart LR'];
  steps.slice(1).forEach((s, i) => lines.push(`  ${nid(steps[i])} --> ${nid(s)}`));
  for (const b of w.branches ?? []) lines.push(`  ${nid(b.from)} -.->${b.label ? `|${b.label}|` : ''} ${nid(b.to)}`);
  for (const [n, id] of ids) lines.push(`  ${id}["${n.replaceAll('"', "'")}"]`);
  return ['```mermaid', ...lines, '```'].join('\n');
}

function whereCell(f, sys, flows) {
  const refs = f.steps ?? [];
  if (refs.length === 1 && refs[0] === '*') return 'every step';
  const groups = new Map();
  for (const r of refs) {
    const wid = r.slice(0, r.indexOf(':'));
    groups.set(wid, [...(groups.get(wid) ?? []), stepOf(r)]);
  }
  return [...groups]
    .map(([wid, st]) => st.join(' → ') + (sys.workflows.includes(wid) ? '' : ` (in ${flows.get(wid).name})`))
    .join('; ');
}

function workflowBlock(w, main, flows) {
  let head = `**${main ? 'Main workflow' : 'Sub-workflow'}: ${w.id} ${w.name}**`;
  if (w.sub) {
    head += ` — starts at ${stepOf(w.sub.startsAt)}, rejoins ${flows.get(w.sub.rejoins).name}`;
    if (w.sub.share) head += ` · ${w.sub.share}`;
  }
  return [head, mermaid(w)].join('\n\n');
}

function systemBlock(s, ctx) {
  const replaced = [...new Set(s.workflows.flatMap((id) => ctx.flows.get(id).replaces ?? []))];
  const names = replaced.map((id) => `"${ctx.flows.get(id).name}"`).join(', ');
  const intro = s.purpose + (replaced.length ? ` Replaces today's ${names}.` : '');
  const rows = s.features.map((id) => ctx.feats.get(id)).map((f) =>
    `| ${f.id} | ${cell(f.name)} | ${cell(f.does)} | ${cell(whereCell(f, s, ctx.flows))} | ${(f.requirements ?? []).join(', ') || '—'} |`);
  const table = ['| ID | Feature | What it does | Where in the workflow | Requirements |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
  const flowsMd = s.workflows.map((id, i) => workflowBlock(ctx.flows.get(id), i === 0, ctx.flows));
  return [`### ${s.id} ${s.name}`, intro, ...flowsMd, table].join('\n\n');
}

function systemsTable(pkg) {
  const map = pkg.mapLabel;
  const head = map ? `| ID | System | Purpose | ${cell(map)} |\n| --- | --- | --- | --- |` : '| ID | System | Purpose |\n| --- | --- | --- |';
  const rows = pkg.systems.map((s) => `| ${s.id} | ${cell(s.name)} | ${cell(s.purpose)} |${map ? ` ${cell(s.map ?? '—')} |` : ''}`);
  return [head, ...rows].join('\n');
}

// "Reviewed by PO" counts what the PO decided and what is still a draft.
function reviewedLine(pkg) {
  const items = [...(pkg.workflows ?? []).filter((w) => w.state === 'to-be'), ...pkg.systems, ...pkg.features];
  const qs = pkg.openQuestions ?? [];
  const decided = [...items, ...qs].filter((r) => r.review).map((r) => r.review.date)
    .concat((pkg.leftOut ?? []).filter((e) => !e.via).map((e) => e.date));
  if (!decided.length) return [];
  const latest = decided.filter(Boolean).sort().at(-1) ?? '—';
  const open = items.filter((r) => r.label !== 'confirmed' && !r.review).length + qs.filter((q) => q.status === 'open').length;
  return [`Reviewed by PO on ${latest}: ${decided.length} decided, ${open} still open for the client.`];
}

function leftOutTable(pkg) {
  const rows = (pkg.leftOut ?? []).map((e) =>
    `| ${e.id} | ${cell(e.item.name)} | ${cell(e.via ? `with ${e.via}` : e.note ?? '—')} | ${e.date} |`);
  return rows.length ? ['### Left out in review', ['| ID | Item | PO note | Date |', '| --- | --- | --- | --- |', ...rows].join('\n')] : [];
}

export function renderScope(pkg) {
  const ctx = {
    flows: new Map((pkg.workflows ?? []).map((w) => [w.id, w])),
    feats: new Map(pkg.features.map((f) => [f.id, f])),
  };
  const n = pkg.systems.length;
  const intro = `What we propose to build: ${n === 1 ? 'one system' : `${n} systems`}, each shown as its workflows and then the features that serve them.`;
  return [START, '### To-be scope', ...reviewedLine(pkg), intro, systemsTable(pkg),
    ...pkg.systems.map((s) => systemBlock(s, ctx)), ...leftOutTable(pkg), END].join('\n\n');
}
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/lib/scope-md.mjs` (whole file):

~~~~js
import { modeOf } from './scope-rules.mjs';
import { START, END, cell, renderScope } from './scope-render.mjs';

const BLOCK = /<!-- scope:start -->[\s\S]*?<!-- scope:end -->\n*/;
// The 0.3.x Start-here line pointed the PO at this section; the PO now has
// the review page, so re-running scope removes the line from older files.
const HERE = /\n> \*\*Product owner\? Start here:\*\*[^\n]*\n/;
const cells = (line) => line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
const count = (md, marker) => md.split(marker).length - 1;

export function checkMarkers(md) {
  const [s, e] = [count(md, START), count(md, END)];
  const ok = s === e && s <= 1 && md.indexOf(START) <= md.indexOf(END);
  return ok ? [] : ['md: scope markers unbalanced'];
}

export function applyScope(md, pkg) {
  let out = md.replace(HERE, '');
  const at = out.search(BLOCK);
  out = out.replace(BLOCK, '');
  if (modeOf(pkg) === 'classic') return out;
  const part3 = out.search(/^## Part 3/m);
  const i = at >= 0 ? at : part3 >= 0 ? part3 : out.length;
  return `${out.slice(0, i)}${renderScope(pkg)}\n\n${out.slice(i)}`;
}

function expectedFeature(pkg, frId) {
  const names = pkg.features.filter((f) => (f.requirements ?? []).includes(frId)).map((f) => f.name);
  return names.length ? names.join(', ') : '—';
}

function checkFeatureColumn(pkg, md) {
  const lines = md.split('\n');
  const header = lines.find((l) => /^\| ID \| Requirement \|/.test(l));
  if (!header || cells(header).at(-1) !== 'Feature') return ['md: FR table has no Feature column'];
  const findings = [];
  for (const line of lines.filter((l) => /^\| FR-\d{3} \|/.test(l))) {
    const c = cells(line);
    const want = cell(expectedFeature(pkg, c[0]));
    if (c.at(-1) !== want) findings.push(`md: ${c[0]} Feature column says ${c.at(-1)}, json says ${want}`);
  }
  return findings;
}

export function checkScopeMd(pkg, md) {
  const findings = checkMarkers(md);
  const fm = md.match(/^scopeMode:\s*(\S+)/m)?.[1] ?? 'classic';
  if (fm !== modeOf(pkg)) findings.push('md: scopeMode does not match json');
  const block = md.match(BLOCK)?.[0].trimEnd() ?? null;
  if (modeOf(pkg) === 'classic') return block ? [...findings, 'md: To-be scope only in workflow mode'] : findings;
  if (block !== renderScope(pkg)) findings.push('md: To-be scope is stale — run scope');
  return [...findings, ...checkFeatureColumn(pkg, md)];
}
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/lib/checks.mjs`, 4 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { modeOf, toBe, scopeIds } from './scope-rules.mjs';
~~~~

with

~~~~js
import { scopeIds } from './scope-rules.mjs';
~~~~

(2) replace

~~~~js
  for (const [name] of REGISTERS) for (const row of pkg[name] ?? []) ids.add(row.id);
  return ids;
~~~~

with

~~~~js
  for (const [name] of REGISTERS) for (const row of pkg[name] ?? []) ids.add(row.id);
  for (const e of pkg.leftOut ?? []) ids.add(e.id);
  return ids;
~~~~

(3) replace

~~~~js
const ID_TOKEN = /\b(?:G|ACT|WF|FR|BR|SC|NFR|INT|DAT|CON|ASM|Q|CONFLICT)-\d{3}\b/g;
~~~~

with

~~~~js
const ID_TOKEN = /\b(?:G|ACT|WF|FR|BR|SC|NFR|INT|DAT|CON|ASM|Q|CONFLICT|SYS|FEAT)-\d{3}\b/g;
~~~~

(4) replace

~~~~js
  const named = new Set(modeOf(pkg) === 'workflow' ? toBe(pkg).map((w) => w.id) : []);
  for (const id of collectIds(pkg)) {
    if (!named.has(id) && !mdIds.has(id)) findings.push(`md: id ${id} absent from requirements.md`);
  }
~~~~

with

~~~~js
  for (const id of [...collectIds(pkg), ...scopeIds(pkg)]) {
    if (!mdIds.has(id)) findings.push(`md: id ${id} absent from requirements.md`);
  }
~~~~

- [ ] **Step 4: Regenerate the workflow fixture md with the new renderer (never hand-edit the section)**

Run: `node plugins/business-analyst/skills/business-analyst/scripts/scope.mjs --json plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.json --md plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.md`

- [ ] **Step 5: Rewrite the Python renderer and validator to match**

Write `plugins/business-analyst/skills/business-analyst/scripts/scope_render.py` (whole file):

~~~~python
"""To-be scope rendering and md sync; mirrors lib/scope-render.mjs + lib/scope-md.mjs (parity-tested)."""
import re

from scope_checks import mode_of

START = '<!-- scope:start -->'
END = '<!-- scope:end -->'
BLOCK = re.compile(r'<!-- scope:start -->.*?<!-- scope:end -->\n*', re.S)
# The 0.3.x Start-here line is removed from older files on re-run.
HERE = re.compile(r'\n> \*\*Product owner\? Start here:\*\*[^\n]*\n')


def step_of(ref):
    return ref[ref.index(':') + 1:]


def cell(text):
    return str(text).replace('|', '\\|')


def mermaid(w):
    ids = {}

    def nid(n):
        ids.setdefault(n, f'n{len(ids)}')
        return ids[n]
    steps = w.get('steps') or []
    for s in steps:
        nid(s)
    lines = ['flowchart LR']
    lines += [f'  {nid(a)} --> {nid(b)}' for a, b in zip(steps, steps[1:])]
    for b in w.get('branches') or []:
        label = f"|{b['label']}|" if b.get('label') else ''
        lines.append(f"  {nid(b['from'])} -.->{label} {nid(b['to'])}")
    lines += [f'  {i}["{n.replace(chr(34), chr(39))}"]' for n, i in ids.items()]
    return '\n'.join(['```mermaid', *lines, '```'])


def where_cell(f, sys_, flows):
    refs = f.get('steps') or []
    if refs == ['*']:
        return 'every step'
    groups = {}
    for r in refs:
        groups.setdefault(r[:r.index(':')], []).append(step_of(r))
    return '; '.join(' → '.join(st) + ('' if wid in sys_['workflows'] else f" (in {flows[wid]['name']})")
                     for wid, st in groups.items())


def workflow_block(w, main, flows):
    head = f"**{'Main workflow' if main else 'Sub-workflow'}: {w['id']} {w['name']}**"
    if w.get('sub'):
        head += f" — starts at {step_of(w['sub']['startsAt'])}, rejoins {flows[w['sub']['rejoins']]['name']}"
        if w['sub'].get('share'):
            head += f" · {w['sub']['share']}"
    return '\n\n'.join([head, mermaid(w)])


def system_block(s, ctx):
    flows, feats = ctx
    replaced = list(dict.fromkeys(r for wid in s['workflows'] for r in flows[wid].get('replaces') or []))
    names = ', '.join(f'"{flows[r]["name"]}"' for r in replaced)
    intro = s['purpose'] + (f" Replaces today's {names}." if replaced else '')
    rows = [f"| {f['id']} | {cell(f['name'])} | {cell(f['does'])} | {cell(where_cell(f, s, flows))} | {', '.join(f.get('requirements') or []) or '—'} |"
            for f in (feats[i] for i in s['features'])]
    table = '\n'.join(['| ID | Feature | What it does | Where in the workflow | Requirements |', '| --- | --- | --- | --- | --- |', *rows])
    flows_md = [workflow_block(flows[wid], i == 0, flows) for i, wid in enumerate(s['workflows'])]
    return '\n\n'.join([f"### {s['id']} {s['name']}", intro, *flows_md, table])


def systems_table(pkg):
    label = pkg.get('mapLabel')
    head = f'| ID | System | Purpose | {cell(label)} |\n| --- | --- | --- | --- |' if label else '| ID | System | Purpose |\n| --- | --- | --- |'
    rows = [f"| {s['id']} | {cell(s['name'])} | {cell(s['purpose'])} |" + (f" {cell(s.get('map') or '—')} |" if label else '') for s in pkg['systems']]
    return '\n'.join([head, *rows])


def reviewed_line(pkg):
    items = [w for w in pkg.get('workflows') or [] if w.get('state') == 'to-be'] + pkg['systems'] + pkg['features']
    qs = pkg.get('openQuestions') or []
    decided = [r['review'].get('date') for r in items + qs if r.get('review')]
    decided += [e.get('date') for e in pkg.get('leftOut') or [] if not e.get('via')]
    if not decided:
        return []
    latest = (sorted(d for d in decided if d) or ['—'])[-1]
    still = (len([r for r in items if r.get('label') != 'confirmed' and not r.get('review')])
             + len([q for q in qs if q.get('status') == 'open']))
    return [f'Reviewed by PO on {latest}: {len(decided)} decided, {still} still open for the client.']


def left_out_table(pkg):
    rows = [f"| {e['id']} | {cell(e['item']['name'])} | {cell('with ' + e['via'] if e.get('via') else e.get('note') or '—')} | {e['date']} |"
            for e in pkg.get('leftOut') or []]
    if not rows:
        return []
    return ['### Left out in review', '\n'.join(['| ID | Item | PO note | Date |', '| --- | --- | --- | --- |', *rows])]


def render_scope(pkg):
    ctx = ({w['id']: w for w in pkg.get('workflows') or []}, {f['id']: f for f in pkg['features']})
    n = len(pkg['systems'])
    intro = (f"What we propose to build: {'one system' if n == 1 else f'{n} systems'}, "
             'each shown as its workflows and then the features that serve them.')
    return '\n\n'.join([START, '### To-be scope', *reviewed_line(pkg), intro, systems_table(pkg),
                        *(system_block(s, ctx) for s in pkg['systems']), *left_out_table(pkg), END])


def apply_scope(md, pkg):
    out = HERE.sub('', md, count=1)
    m = BLOCK.search(out)
    out = BLOCK.sub('', out, count=1)
    if mode_of(pkg) == 'classic':
        return out
    part3 = re.search(r'^## Part 3', out, re.M)
    i = m.start() if m else part3.start() if part3 else len(out)
    return f'{out[:i]}{render_scope(pkg)}\n\n{out[i:]}'


def cells(line):
    return [c.strip() for c in re.split(r'(?<!\\)\|', line)[1:-1]]


def check_markers(md):
    s, e = md.count(START), md.count(END)
    ok = s == e and s <= 1 and md.find(START) <= md.find(END)
    return [] if ok else ['md: scope markers unbalanced']


def expected_feature(pkg, fr_id):
    names = [f['name'] for f in pkg['features'] if fr_id in (f.get('requirements') or [])]
    return ', '.join(names) if names else '—'


def check_feature_column(pkg, md):
    lines = md.split('\n')
    header = next((ln for ln in lines if re.match(r'^\| ID \| Requirement \|', ln)), None)
    if not header or cells(header)[-1] != 'Feature':
        return ['md: FR table has no Feature column']
    findings = []
    for line in (ln for ln in lines if re.match(r'^\| FR-\d{3} \|', ln)):
        c = cells(line)
        want = cell(expected_feature(pkg, c[0]))
        if c[-1] != want:
            findings.append(f'md: {c[0]} Feature column says {c[-1]}, json says {want}')
    return findings


def check_scope_md(pkg, md):
    findings = check_markers(md)
    fm = re.search(r'^scopeMode:\s*(\S+)', md, re.M)
    if (fm.group(1) if fm else 'classic') != mode_of(pkg):
        findings.append('md: scopeMode does not match json')
    m = BLOCK.search(md)
    block = m.group(0).rstrip() if m else None
    if mode_of(pkg) == 'classic':
        return findings + ['md: To-be scope only in workflow mode'] if block else findings
    if block != render_scope(pkg):
        findings.append('md: To-be scope is stale — run scope')
    return findings + check_feature_column(pkg, md)
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/validate.py`, 4 replacement(s), each matching exactly once:

(1) replace

~~~~python
from scope_checks import check_scope, mode_of, scope_ids, to_be
~~~~

with

~~~~python
from scope_checks import check_scope, scope_ids
~~~~

(2) replace

~~~~python
ID_TOKEN = re.compile(r'\b(?:G|ACT|WF|FR|BR|SC|NFR|INT|DAT|CON|ASM|Q|CONFLICT)-\d{3}\b')
~~~~

with

~~~~python
ID_TOKEN = re.compile(r'\b(?:G|ACT|WF|FR|BR|SC|NFR|INT|DAT|CON|ASM|Q|CONFLICT|SYS|FEAT)-\d{3}\b')
~~~~

(3) replace

~~~~python
        for row in rows(pkg, name):
            ordered[row.get('id')] = True
    return list(ordered)
~~~~

with

~~~~python
        for row in rows(pkg, name):
            ordered[row.get('id')] = True
    for e in rows(pkg, 'leftOut'):
        ordered[e.get('id')] = True
    return list(ordered)
~~~~

(4) replace

~~~~python
    named = {w['id'] for w in to_be(pkg)} if mode_of(pkg) == 'workflow' else set()
    for rid in collect_ids(pkg):
        if rid not in named and rid not in md_ids:
~~~~

with

~~~~python
    for rid in collect_ids(pkg) + scope_ids(pkg):
        if rid not in md_ids:
~~~~

- [ ] **Step 6: Run the BA suite**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0` (parity tests compare `scope.py` bytes with the regenerated fixture).

- [ ] **Step 7: Commit** (one command per call)

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/scope-render.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/scope-md.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/checks.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/scope_render.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/validate.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/review-fixture.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/scope-md.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.md
/usr/bin/git commit -m "feat(business-analyst): engineer-view to-be scope with ids"
```

### Task 4: Validate the review record; JSON-only validate

**Files:**
- Create: `plugins/business-analyst/skills/business-analyst/scripts/lib/review-checks.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/review_checks.py`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/lib/checks.mjs` (2 edits)
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/lib/scope-rules.mjs` (3 edits)
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/validate.mjs` (1 line)
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/validate.py` (3 edits)
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/scope_checks.py` (3 edits)
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/review-cases.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/review-checks.test.mjs`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs` (imports + blocks)

**Interfaces:**
- Consumes: `reviewed()` and friends from `review-fixture.mjs` (Task 3).
- Produces: `checkReview(pkg) → string[]` (`review-checks.mjs`; Python `check_review`). `checkPackage({ pkg, md })` accepts `md == null` → JSON checks only. `validate.mjs`/`validate.py` take `--md` as optional.
- Finding strings (exact): `<id>: review answer must be yes`, `<id>: review date missing`, `<Q>: review answer is empty`, `<id>: leftOut kind must be system|workflow|feature`, `<id>: leftOut item id does not match`, `<id>: leftOut owner <SYS> unknown`, `<id>: leftOut via <SYS> is not a left-out system`, `<id>: frsOut lists unknown <FR>`, `<FR>: in scope but its feature was left out`, `duplicate id: <id>`, `<id>: uses left-out workflow <WF>`, `leftOut only in workflow mode`.

- [ ] **Step 1: Write the failing tests**

Write `plugins/business-analyst/skills/business-analyst/scripts/test/review-cases.mjs` (whole file):

~~~~js
// One broken variant of the reviewed pair per review rule (spec §5).
// Shared by review-checks.test.mjs and python-parity.test.mjs.
import { reviewed } from './review-fixture.mjs';

const out = (pkg, id) => pkg.leftOut.find((e) => e.id === id);
const pkgCase = (name, finding, edit) => ({ name, finding, edit: () => { const c = reviewed(); edit(c.pkg); return c; } });

export const REVIEW_CASES = [
  pkgCase('kept item answered no', 'WF-003: review answer must be yes', (p) => { p.workflows[2].review.answer = 'no'; }),
  pkgCase('kept item without review date', 'WF-003: review date missing', (p) => { delete p.workflows[2].review.date; }),
  pkgCase('question with empty answer', 'Q-003: review answer is empty', (p) => { p.openQuestions[2].review.answer = ' '; }),
  pkgCase('leftOut bad kind', 'FEAT-004: leftOut kind must be system|workflow|feature', (p) => { out(p, 'FEAT-004').kind = 'thing'; }),
  pkgCase('leftOut item id mismatch', 'FEAT-004: leftOut item id does not match', (p) => { out(p, 'FEAT-004').item.id = 'FEAT-009'; }),
  pkgCase('leftOut without date', 'FEAT-004: review date missing', (p) => { delete out(p, 'FEAT-004').date; }),
  pkgCase('leftOut owner unknown', 'FEAT-004: leftOut owner SYS-009 unknown', (p) => { out(p, 'FEAT-004').system = 'SYS-009'; }),
  pkgCase('leftOut via a live system', 'FEAT-004: leftOut via SYS-002 is not a left-out system', (p) => { out(p, 'FEAT-004').via = 'SYS-002'; }),
  pkgCase('left-out FR back in scope', 'FR-004: in scope but its feature was left out', (p) => { p.requirements[3].scope = 'in'; p.features[2].requirements.push('FR-004'); }),
  pkgCase('frsOut names a missing FR', 'FEAT-004: frsOut lists unknown FR-099', (p) => { out(p, 'FEAT-004').frsOut = ['FR-099']; }),
  pkgCase('id both live and left out', 'duplicate id: FEAT-004', (p) => { p.features.push(out(p, 'FEAT-004').item); p.systems[1].features.push('FEAT-004'); }),
  pkgCase('kept feature uses a left-out workflow', 'FEAT-003: uses left-out workflow WF-003', (p) => {
    const wf = p.workflows.splice(2, 1)[0];
    p.systems[1].workflows = ['WF-004'];
    p.leftOut.push({ id: 'WF-003', kind: 'workflow', system: 'SYS-002', at: 0, index: 2, date: '2026-10-07', frsOut: [], outAdded: true, item: wf });
  }),
  pkgCase('leftOut in classic mode', 'leftOut only in workflow mode', (p) => { for (const k of ['systems', 'features', 'scopeMode', 'mapLabel']) delete p[k]; }),
];
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/test/review-checks.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPackage } from '../lib/checks.mjs';
import { reviewed } from './review-fixture.mjs';
import { REVIEW_CASES } from './review-cases.mjs';
import { loadWorkflow } from './scope-cases.mjs';

const validate = fileURLToPath(new URL('../validate.mjs', import.meta.url));

test('the reviewed pair has no findings', () => {
  const { pkg, md } = reviewed();
  assert.deepEqual(checkPackage({ pkg, md }), []);
});

test('a left-out id missing from the md is reported', () => {
  const { pkg, md } = reviewed();
  const findings = checkPackage({ pkg, md: md.replace('| FEAT-004 | Invoice from packed quantities | we invoice', '| — | Invoice from packed quantities | we invoice') });
  assert.ok(findings.includes('md: id FEAT-004 absent from requirements.md'));
});

test('validate --json without --md checks the JSON only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-json-only-'));
  const { pkg } = loadWorkflow();
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  assert.match(execFileSync('node', [validate, '--json', join(dir, 'r.json')], { encoding: 'utf8' }), /requirements package valid/);
  pkg.features[0].steps = ['WF-002:Nowhere'];
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  assert.throws(() => execFileSync('node', [validate, '--json', join(dir, 'r.json')], { stdio: 'pipe' }));
});

for (const c of REVIEW_CASES) {
  test(`review rule: ${c.name}`, () => {
    const { pkg, md } = c.edit();
    const findings = checkPackage({ pkg, md });
    assert.ok(findings.includes(c.finding), `expected "${c.finding}" in:\n${findings.join('\n')}`);
  });
}
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { moveOut } from '../lib/left-out.mjs';
~~~~

with

~~~~js
import { moveOut } from '../lib/left-out.mjs';
import { REVIEW_CASES } from './review-cases.mjs';
import { DATE, decisions, reviewed, withQuestion, YES_WF3, NO_FEAT4, ANSWER_Q3 } from './review-fixture.mjs';
~~~~

Append to the end of `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs`:

~~~~js

const pyReview = fileURLToPath(new URL('../review.py', import.meta.url));
const jsReview = fileURLToPath(new URL('../review.mjs', import.meta.url));

function exec(cmd, args) {
  try {
    return { code: 0, out: execFileSync(cmd, args, { encoding: 'utf8' }), err: '' };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? '', err: e.stderr ?? '' };
  }
}

for (const c of REVIEW_CASES) {
  test(`python and node agree on review rule: ${c.name}`, () => {
    const { pkg, md } = c.edit();
    const { jsonPath, mdPath } = writePair(pkg, md);
    const n = run('node', js, jsonPath, mdPath);
    const p = run('python3', py, jsonPath, mdPath);
    assert.equal(n.code, 1);
    assert.equal(p.err.trim(), n.err.trim());
  });
}

test('validate.py --json without --md matches node', () => {
  const { jsonPath } = writePair(reviewed().pkg, '');
  assert.deepEqual(exec('python3', [py, '--json', jsonPath]), exec('node', [js, '--json', jsonPath]));
});
~~~~

- [ ] **Step 2: Run them to see them fail**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/review-checks.test.mjs 2>&1 | tail -8`
Expected: FAIL — every `review rule:` case and the JSON-only test fail (`validate.mjs` reads `args.md` unconditionally). `the reviewed pair has no findings` may already pass; it is the guard.

- [ ] **Step 3: Write `review-checks.mjs` and wire it in**

Write `plugins/business-analyst/skills/business-analyst/scripts/lib/review-checks.mjs` (whole file):

~~~~js
// Rules for the PO review record (spec §5): `review` on kept items and
// questions, and the leftOut entries that hold declined scope.
import { modeOf, toBe, scopeIds } from './scope-rules.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['system', 'workflow', 'feature'];

function checkReviews(pkg) {
  const out = [];
  for (const r of [...toBe(pkg), ...(pkg.systems ?? []), ...(pkg.features ?? [])]) {
    if (!r.review) continue;
    if (r.review.answer !== 'yes') out.push(`${r.id}: review answer must be yes`);
    if (!DATE.test(r.review.date ?? '')) out.push(`${r.id}: review date missing`);
  }
  for (const q of pkg.openQuestions ?? []) {
    if (!q.review) continue;
    if (!String(q.review.answer ?? '').trim()) out.push(`${q.id}: review answer is empty`);
    if (!DATE.test(q.review.date ?? '')) out.push(`${q.id}: review date missing`);
  }
  return out;
}

function checkEntry(e, ctx, out) {
  if (!KINDS.includes(e.kind)) out.push(`${e.id}: leftOut kind must be system|workflow|feature`);
  if (e.item?.id !== e.id) out.push(`${e.id}: leftOut item id does not match`);
  if (!DATE.test(e.date ?? '')) out.push(`${e.id}: review date missing`);
  if (e.kind !== 'system' && !ctx.owners.has(e.system)) out.push(`${e.id}: leftOut owner ${e.system} unknown`);
  if (e.via && !ctx.outSystems.has(e.via)) out.push(`${e.id}: leftOut via ${e.via} is not a left-out system`);
  for (const id of e.frsOut ?? []) {
    const fr = ctx.frs.get(id);
    if (!fr) out.push(`${e.id}: frsOut lists unknown ${id}`);
    else if (fr.scope === 'in') out.push(`${id}: in scope but its feature was left out`);
  }
}

function checkLeftOut(pkg) {
  const entries = pkg.leftOut ?? [];
  const outSystems = new Set(entries.filter((e) => e.kind === 'system').map((e) => e.id));
  const ctx = {
    owners: new Set([...(pkg.systems ?? []).map((s) => s.id), ...outSystems]),
    outSystems,
    frs: new Map((pkg.requirements ?? []).map((fr) => [fr.id, fr])),
  };
  const seen = new Set([...scopeIds(pkg), ...toBe(pkg).map((w) => w.id)]);
  const out = [];
  for (const e of entries) {
    if (seen.has(e.id)) out.push(`duplicate id: ${e.id}`);
    seen.add(e.id);
    checkEntry(e, ctx, out);
  }
  return out;
}

export function checkReview(pkg) {
  if (modeOf(pkg) === 'classic') return 'leftOut' in pkg ? ['leftOut only in workflow mode'] : [];
  return [...checkReviews(pkg), ...checkLeftOut(pkg)];
}
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/lib/checks.mjs`, 2 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { checkScopeMd } from './scope-md.mjs';
~~~~

with

~~~~js
import { checkScopeMd } from './scope-md.mjs';
import { checkReview } from './review-checks.mjs';
~~~~

(2) replace

~~~~js
  const scope = checkScope(pkg, ids);
  return [
    ...checkDuplicates(pkg),
    ...checkRefs(pkg, ids),
    ...checkLabels(pkg),
    ...checkAmbiguity(pkg),
    ...checkReadiness(pkg),
    ...checkMd(pkg, md),
    ...checkMdOrphanIds(pkg, md, ids),
    ...scope,
    ...(scope.length ? [] : checkScopeMd(pkg, md)),
  ];
~~~~

with

~~~~js
  const scope = checkScope(pkg, ids);
  // A broken scope or review record cannot be rendered, so the md compare waits for both.
  const review = checkReview(pkg);
  const json = [
    ...checkDuplicates(pkg),
    ...checkRefs(pkg, ids),
    ...checkLabels(pkg),
    ...checkAmbiguity(pkg),
    ...checkReadiness(pkg),
    ...scope,
    ...review,
  ];
  if (md == null) return json;
  return [...json, ...checkMd(pkg, md), ...checkMdOrphanIds(pkg, md, ids), ...(scope.length || review.length ? [] : checkScopeMd(pkg, md))];
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/lib/scope-rules.mjs`, 3 replacement(s), each matching exactly once:

(1) replace

~~~~js
export function checkFlows(pkg) {
  const findings = [];
  const idx = stepIndex(pkg);
~~~~

with

~~~~js
const outIds = (pkg) => new Set((pkg.leftOut ?? []).map((e) => e.id));
const flowOf = (ref) => ref.slice(0, ref.indexOf(':'));

export function checkFlows(pkg) {
  const findings = [];
  const idx = stepIndex(pkg);
  const out = outIds(pkg);
~~~~

(2) replace

~~~~js
    if (w.sub && !idx.has(w.sub.startsAt)) findings.push(`${w.id}: sub.startsAt unknown`);
    if (w.sub && !flows.includes(w.sub.rejoins)) findings.push(`${w.id}: sub.rejoins is not a to-be workflow`);
~~~~

with

~~~~js
    for (const wid of w.sub ? [flowOf(w.sub.startsAt), w.sub.rejoins] : []) {
      if (out.has(wid)) findings.push(`${w.id}: uses left-out workflow ${wid}`);
    }
    if (w.sub && !idx.has(w.sub.startsAt) && !out.has(flowOf(w.sub.startsAt))) findings.push(`${w.id}: sub.startsAt unknown`);
    if (w.sub && !flows.includes(w.sub.rejoins) && !out.has(w.sub.rejoins)) findings.push(`${w.id}: sub.rejoins is not a to-be workflow`);
~~~~

(3) replace

~~~~js
  const findings = [];
  const idx = stepIndex(pkg);
  for (const f of pkg.features) {
    const steps = f.steps ?? [];
    if (steps.length === 1 && steps[0] === '*') continue;
    if (!steps.length) findings.push(`${f.id}: needs at least one step`);
    for (const s of steps) if (!idx.has(s)) findings.push(`${f.id}: unknown step ${s}`);
  }
  return findings;
~~~~

with

~~~~js
  const findings = [];
  const idx = stepIndex(pkg);
  const out = outIds(pkg);
  for (const f of pkg.features) {
    const steps = f.steps ?? [];
    if (steps.length === 1 && steps[0] === '*') continue;
    if (!steps.length) findings.push(`${f.id}: needs at least one step`);
    for (const s of steps.filter((x) => !idx.has(x))) {
      findings.push(out.has(flowOf(s)) ? `${f.id}: uses left-out workflow ${flowOf(s)}` : `${f.id}: unknown step ${s}`);
    }
  }
  return [...new Set(findings)];
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/validate.mjs`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~js
const md = readFileSync(args.md, 'utf8');
~~~~

with

~~~~js
const md = args.md ? readFileSync(args.md, 'utf8') : null;
~~~~

- [ ] **Step 4: Python twins**

Write `plugins/business-analyst/skills/business-analyst/scripts/review_checks.py` (whole file):

~~~~python
"""PO review record rules; mirrors lib/review-checks.mjs (parity-tested)."""
import re

from scope_checks import mode_of, scope_ids, to_be

DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
KINDS = ['system', 'workflow', 'feature']


def check_reviews(pkg):
    out = []
    for r in to_be(pkg) + (pkg.get('systems') or []) + (pkg.get('features') or []):
        if not r.get('review'):
            continue
        if r['review'].get('answer') != 'yes':
            out.append(f"{r['id']}: review answer must be yes")
        if not DATE.match(r['review'].get('date') or ''):
            out.append(f"{r['id']}: review date missing")
    for q in pkg.get('openQuestions') or []:
        if not q.get('review'):
            continue
        if not str(q['review'].get('answer') or '').strip():
            out.append(f"{q['id']}: review answer is empty")
        if not DATE.match(q['review'].get('date') or ''):
            out.append(f"{q['id']}: review date missing")
    return out


def check_entry(e, ctx, out):
    if e.get('kind') not in KINDS:
        out.append(f"{e['id']}: leftOut kind must be system|workflow|feature")
    if (e.get('item') or {}).get('id') != e['id']:
        out.append(f"{e['id']}: leftOut item id does not match")
    if not DATE.match(e.get('date') or ''):
        out.append(f"{e['id']}: review date missing")
    if e.get('kind') != 'system' and e.get('system') not in ctx['owners']:
        out.append(f"{e['id']}: leftOut owner {e.get('system')} unknown")
    if e.get('via') and e['via'] not in ctx['out_systems']:
        out.append(f"{e['id']}: leftOut via {e['via']} is not a left-out system")
    for fid in e.get('frsOut') or []:
        fr = ctx['frs'].get(fid)
        if not fr:
            out.append(f"{e['id']}: frsOut lists unknown {fid}")
        elif fr.get('scope') == 'in':
            out.append(f'{fid}: in scope but its feature was left out')


def check_left_out(pkg):
    entries = pkg.get('leftOut') or []
    out_systems = {e['id'] for e in entries if e.get('kind') == 'system'}
    ctx = {
        'owners': {s['id'] for s in pkg.get('systems') or []} | out_systems,
        'out_systems': out_systems,
        'frs': {fr['id']: fr for fr in pkg.get('requirements') or []},
    }
    seen = set(scope_ids(pkg)) | {w['id'] for w in to_be(pkg)}
    out = []
    for e in entries:
        if e['id'] in seen:
            out.append(f"duplicate id: {e['id']}")
        seen.add(e['id'])
        check_entry(e, ctx, out)
    return out


def check_review(pkg):
    if mode_of(pkg) == 'classic':
        return ['leftOut only in workflow mode'] if 'leftOut' in pkg else []
    return check_reviews(pkg) + check_left_out(pkg)
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/validate.py`, 3 replacement(s), each matching exactly once:

(1) replace

~~~~python
from scope_render import check_scope_md
~~~~

with

~~~~python
from scope_render import check_scope_md
from review_checks import check_review
~~~~

(2) replace

~~~~python
    scope = check_scope(pkg, ids)
    return [
        *check_duplicates(pkg),
        *check_refs(pkg, ids),
        *check_labels(pkg),
        *check_ambiguity(pkg),
        *check_readiness(pkg),
        *check_md(pkg, md),
        *check_md_orphan_ids(None, md, ids),
        *scope,
        *([] if scope else check_scope_md(pkg, md)),
    ]
~~~~

with

~~~~python
    scope = check_scope(pkg, ids)
    review = check_review(pkg)
    json_findings = [
        *check_duplicates(pkg),
        *check_refs(pkg, ids),
        *check_labels(pkg),
        *check_ambiguity(pkg),
        *check_readiness(pkg),
        *scope,
        *review,
    ]
    if md is None:
        return json_findings
    return [*json_findings, *check_md(pkg, md), *check_md_orphan_ids(None, md, ids),
            *([] if scope or review else check_scope_md(pkg, md))]
~~~~

(3) replace

~~~~python
    with open(args['md'], encoding='utf-8') as f:
        md = f.read()
~~~~

with

~~~~python
    md = None
    if args.get('md'):
        with open(args['md'], encoding='utf-8') as f:
            md = f.read()
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/scope_checks.py`, 3 replacement(s), each matching exactly once:

(1) replace

~~~~python
def check_flows(pkg):
    findings = []
    idx = step_index(pkg)
~~~~

with

~~~~python
def out_ids(pkg):
    return {e['id'] for e in pkg.get('leftOut') or []}


def flow_of(ref):
    return ref[:ref.index(':')] if ':' in ref else ref


def check_flows(pkg):
    findings = []
    idx = step_index(pkg)
    out = out_ids(pkg)
~~~~

(2) replace

~~~~python
        sub = w.get('sub')
        if sub and sub.get('startsAt') not in idx:
            findings.append(f"{w['id']}: sub.startsAt unknown")
        if sub and sub.get('rejoins') not in flows:
            findings.append(f"{w['id']}: sub.rejoins is not a to-be workflow")
~~~~

with

~~~~python
        sub = w.get('sub')
        for wid in [flow_of(sub.get('startsAt') or ''), sub.get('rejoins')] if sub else []:
            if wid in out:
                findings.append(f"{w['id']}: uses left-out workflow {wid}")
        if sub and sub.get('startsAt') not in idx and flow_of(sub.get('startsAt') or '') not in out:
            findings.append(f"{w['id']}: sub.startsAt unknown")
        if sub and sub.get('rejoins') not in flows and sub.get('rejoins') not in out:
            findings.append(f"{w['id']}: sub.rejoins is not a to-be workflow")
~~~~

(3) replace

~~~~python
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
~~~~

with

~~~~python
    findings = []
    idx = step_index(pkg)
    out = out_ids(pkg)
    for f in pkg['features']:
        steps = f.get('steps') or []
        if steps == ['*']:
            continue
        if not steps:
            findings.append(f"{f['id']}: needs at least one step")
        findings += [f"{f['id']}: uses left-out workflow {flow_of(s)}" if flow_of(s) in out else f"{f['id']}: unknown step {s}"
                     for s in steps if s not in idx]
    return list(dict.fromkeys(findings))
~~~~

- [ ] **Step 5: Run the BA suite**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`.

- [ ] **Step 6: Commit** (one command per call)

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/review-checks.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/review_checks.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/checks.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/scope-rules.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/validate.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/validate.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/scope_checks.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/review-cases.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/review-checks.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs
/usr/bin/git commit -m "feat(business-analyst): validate review record, json-only mode"
```

### Task 5: The review page (`review page`)

**Files:**
- Create: `plugins/business-analyst/skills/business-analyst/scripts/lib/review-data.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/lib/review-page.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/assets/review-decisions.js`
- Create: `plugins/business-analyst/skills/business-analyst/assets/review-page.html`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/review.mjs` (page only; Task 6 adds apply)
- Create: `plugins/business-analyst/skills/business-analyst/scripts/review_data.py`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/review.py` (page only)
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/review-browser.test.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/quality-gates.test.mjs`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs` (one block)

**Interfaces:**
- Consumes: `restoreAll` (Task 2); `checkScope`, `collectIds`, `scopeIds`, `modeOf` (existing).
- Produces: `pageData(pkg, date) → { lead, title, date, systems: [{ id, name, purpose, flows: [{ id, name, draft, steps: [{name, draft}], branches: [{from, to, label, back, draft}], sub: {startsAt, rejoins, share} | null }], cards: [{ id, kind, system, name, what, why, answer, note }], agreed: [{name, does}] }], questions: [{ id, text, answer }] }` — every value set (null, never undefined) for byte parity.
- `fillPage(template, data, decisionsSrc) → html`; `pageHtml(pkg, date) → html` (`review-page.mjs`).
- `review-decisions.js` exports `allCards(data)`, `initialState(data) → {id: {v, note} | {text}}`, `isOff(state, card)`, `decisionBody(data, state) → { reviewDecisions: 1, lead, date, decisions, skipped }`, `decisionText(data, state) → string`, `progress(data, state) → {done, total}`.
- Template slots: `/*@DATA@*/null` and `/*@DECISIONS@*/`, each exactly once.

- [ ] **Step 1: Write the failing tests**

Write `plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageData } from '../lib/review-data.mjs';
import { fillPage } from '../lib/review-page.mjs';
import { TECH_WORDS } from '../lib/scope-rules.mjs';
import { initialState, decisionBody, decisionText, progress } from '../../assets/review-decisions.js';
import { loadWorkflow } from './scope-cases.mjs';
import { DATE, withQuestion, reviewed } from './review-fixture.mjs';

const script = fileURLToPath(new URL('../review.mjs', import.meta.url));
const KEYS = new Set(['id', 'system', 'lead', 'kind', 'date']);
const cardIds = (data) => data.systems.flatMap((s) => s.cards.map((c) => c.id));

// Every string a reader can see, i.e. everything but the keys that only feed the copied JSON.
function shown(v, key = '') {
  if (typeof v === 'string') return KEYS.has(key) ? [] : [v];
  if (Array.isArray(v)) return v.flatMap((x) => shown(x));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => shown(x, k));
  return [];
}

test('shown text has no ids and no tech words (R3)', () => {
  const text = shown(pageData(withQuestion(loadWorkflow().pkg), DATE)).join('\n');
  assert.doesNotMatch(text, /\b(?:SYS|WF|FEAT|FR|BR|Q|ASM|NFR|INT)-\d{3}\b/);
  for (const w of TECH_WORDS) assert.doesNotMatch(text, new RegExp(`\\b${w}s?\\b`, 'i'));
});

test('cards are the drafts; confirmed features fold into agreed', () => {
  const data = pageData(loadWorkflow().pkg, DATE);
  assert.deepEqual(cardIds(data), ['WF-003', 'FEAT-004']);
  assert.deepEqual(data.systems[0].agreed.map((a) => a.name), ['Order pipeline & stage engine', 'Short-pack alert']);
  assert.equal(data.systems[1].cards[1].why, 'decides the invoice trigger');
});

test('a question paired with a card is not asked twice', () => {
  const data = pageData(withQuestion(loadWorkflow().pkg), DATE);
  assert.deepEqual(data.questions.map((q) => q.id), ['Q-003']);
});

test('after a review the page pre-fills every earlier answer', () => {
  const data = pageData(reviewed().pkg, DATE);
  const byId = Object.fromEntries(data.systems.flatMap((s) => s.cards).map((c) => [c.id, [c.answer, c.note]]));
  assert.deepEqual(byId, { 'WF-003': ['yes', null], 'FEAT-004': ['no', 'we invoice from the signed DO'] });
  assert.deepEqual(data.questions, [{ id: 'Q-003', text: 'How many office staff will use the system?', answer: 'About 6' }]);
});

test('drafted workflow steps are flagged for the orange style', () => {
  const [main, sub] = pageData(loadWorkflow().pkg, DATE).systems[1].flows;
  assert.ok(main.draft && main.steps.every((s) => s.draft));
  assert.deepEqual(sub.sub, { startsAt: 'Order received', rejoins: 'Order pipeline', share: 'about 20% of orders' });
});

test('decisions: answers become the copied block; blanks are skipped', () => {
  const data = pageData(withQuestion(loadWorkflow().pkg), DATE);
  const state = initialState(data);
  assert.deepEqual(decisionBody(data, state).skipped, ['WF-003', 'FEAT-004', 'Q-003']);
  state['WF-003'].v = 'yes';
  state['FEAT-004'] = { v: 'no', note: '  later  ' };
  assert.deepEqual(decisionBody(data, state).decisions, [
    { id: 'WF-003', name: 'Order to cash', answer: 'yes' },
    { id: 'FEAT-004', name: 'Invoice from packed quantities', answer: 'no', note: 'later' }]);
  assert.deepEqual(progress(data, state), { done: 2, total: 3 });
  assert.match(decisionText(data, state), /^Here are my review decisions — please apply them\.\n\n```json\n\{\n {2}"reviewDecisions": 1,/);
});

test('cards inside a left-out system are not asked', () => {
  const { pkg } = loadWorkflow();
  pkg.systems[1].label = 'recommended';
  pkg.openQuestions[0].affects.push('SYS-002');
  const data = pageData(pkg, DATE);
  const state = initialState(data);
  state['SYS-002'].v = 'no';
  state['FEAT-004'].v = 'yes';
  assert.deepEqual(decisionBody(data, state).decisions.map((d) => d.id), ['SYS-002']);
});

test('a name cannot close the data script tag', () => {
  const html = fillPage('<script>const DATA = /*@DATA@*/null;\n/*@DECISIONS@*/</script>', { n: '</script><b>' }, 'export const x = 1;');
  assert.equal(html, '<script>const DATA = {"n":"\\u003c/script>\\u003cb>"};\nconst x = 1;</script>');
});

test('a template without its slot is refused', () => {
  assert.throws(() => fillPage('<script></script>', {}, ''), /slot/);
});

test('review page: classic mode writes nothing and exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-review-'));
  const { pkg } = loadWorkflow();
  for (const k of ['systems', 'features', 'scopeMode', 'mapLabel']) delete pkg[k];
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  const out = execFileSync('node', [script, 'page', '--json', join(dir, 'r.json'), '--out', join(dir, 'review.html')], { encoding: 'utf8' });
  assert.match(out, /classic mode: no review page/);
  assert.equal(existsSync(join(dir, 'review.html')), false);
});

test('review page: writes one self-contained file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-review-'));
  writeFileSync(join(dir, 'r.json'), JSON.stringify(loadWorkflow().pkg));
  execFileSync('node', [script, 'page', '--json', join(dir, 'r.json'), '--out', join(dir, 'review.html'), '--date', DATE]);
  const html = readFileSync(join(dir, 'review.html'), 'utf8');
  assert.match(html, /const DATA = \{"lead":"sin-kowa-mini"/);
  assert.doesNotMatch(html, /\/\*@|^export /m);
});

test('review page: refuses a broken scope', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-review-'));
  const { pkg } = loadWorkflow();
  pkg.features[1].steps = ['WF-002:Nowhere'];
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  assert.throws(() => execFileSync('node', [script, 'page', '--json', join(dir, 'r.json'), '--out', join(dir, 'review.html')], { stdio: 'pipe' }));
  assert.equal(existsSync(join(dir, 'review.html')), false);
});
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/test/review-browser.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/cdp.mjs';
import { pageHtml } from '../lib/review-page.mjs';
import { loadWorkflow } from './scope-cases.mjs';
import { DATE, withQuestion, reviewed } from './review-fixture.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };

function open(pkg) {
  const file = join(mkdtempSync(join(tmpdir(), 'ba-review-browser-')), 'review.html');
  writeFileSync(file, pageHtml(pkg, DATE));
  return openPage(pathToFileURL(file).href);
}

const click = (n, v) => `document.querySelectorAll('.item')[${n}].querySelector('[data-v=${v}]').click()`;

test('the page draws without errors and shows no ids', skip, async () => {
  const page = await open(withQuestion(loadWorkflow().pkg));
  try {
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('.item').length`), 2);
    assert.equal(await page.eval(`/\\b(?:SYS|WF|FEAT|FR|Q)-\\d{3}\\b/.test(document.body.innerText)`), false);
    assert.equal(await page.eval(`document.getElementById('count').textContent`), '0 of 3');
  } finally { page.close(); }
});

test('"review decisions" reopens with earlier answers filled in', skip, async () => {
  const page = await open(reviewed().pkg);
  try {
    assert.equal(await page.eval(`document.querySelectorAll('[aria-pressed=true]').length`), 2);
    assert.equal(await page.eval(`document.getElementById('ans-Q-003').value`), 'About 6');
    assert.equal(await page.eval(`document.getElementById('count').textContent`), '3 of 3');
  } finally { page.close(); }
});

test('with no questions the questions box is hidden', skip, async () => {
  const page = await open(loadWorkflow().pkg);
  try {
    assert.equal(await page.eval(`getComputedStyle(document.getElementById('qs-area')).display`), 'none');
  } finally { page.close(); }
});

test('markup in a name shows as text, never as html', skip, async () => {
  const pkg = loadWorkflow().pkg;
  pkg.features[3].name = 'Invoice <b>now</b> & "later"';
  const page = await open(pkg);
  try {
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelector('.item:nth-child(2) h3').textContent`), 'Invoice <b>now</b> & "later"');
    assert.equal(await page.eval(`document.querySelectorAll('.item b').length`), 0);
  } finally { page.close(); }
});
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/test/quality-gates.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEMPLATE_LIMITS, templateScripts, violations,
} from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/quality-gate.mjs';

// The review page's modules. checks.mjs predates the gates and is over them;
// it is not listed, and this work only shrinks it.
const MODULES = [
  'scripts/review.mjs', 'scripts/lib/left-out.mjs', 'scripts/lib/review-checks.mjs', 'scripts/lib/review-data.mjs',
  'scripts/lib/review-page.mjs', 'scripts/lib/scope-render.mjs', 'assets/review-decisions.js',
];
const base = new URL('../..', import.meta.url).pathname;

for (const file of MODULES) {
  test(`gates: ${file}`, () => {
    assert.deepEqual(violations(readFileSync(base + file, 'utf8')), []);
  });
}

for (const { file, js } of templateScripts(base)) {
  test(`gates: ${file.replace(base, '')}`, () => {
    assert.deepEqual(violations(js, TEMPLATE_LIMITS), []);
  });
}
~~~~

Append to the end of `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs`:

~~~~js

for (const [name, pkg] of [['draft', loadWorkflow().pkg], ['reviewed', reviewed().pkg]]) {
  test(`review.py page writes the same bytes as review.mjs: ${name}`, () => {
    const a = writePair(withQuestion(structuredClone(pkg)), '');
    const out = (dir) => join(dir, 'review.html');
    const dirOf = (p) => p.slice(0, p.lastIndexOf('/'));
    exec('node', [jsReview, 'page', '--json', a.jsonPath, '--out', out(dirOf(a.jsonPath)), '--date', DATE]);
    exec('python3', [pyReview, 'page', '--json', a.jsonPath, '--out', `${out(dirOf(a.jsonPath))}.py`, '--date', DATE]);
    assert.equal(readFileSync(`${out(dirOf(a.jsonPath))}.py`, 'utf8'), readFileSync(out(dirOf(a.jsonPath)), 'utf8'));
  });
}
~~~~

- [ ] **Step 2: Run them to see them fail**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs plugins/business-analyst/skills/business-analyst/scripts/test/quality-gates.test.mjs 2>&1 | tail -8`
Expected: FAIL — `Cannot find module …/lib/review-data.mjs` / missing files.

- [ ] **Step 3: Write the page data and the decisions script**

Write `plugins/business-analyst/skills/business-analyst/scripts/lib/review-data.mjs` (whole file):

~~~~js
// requirements.json → the data the PO review page draws (spec §2). Business
// words only: ids travel as keys for the copied decisions, never as text.
// Every value is set explicitly (null, never undefined) so the Python twin
// serialises the same bytes.
import { restoreAll } from './left-out.mjs';

const isDraft = (r) => r.label !== 'confirmed';
const pairedReason = (view, id) => (view.openQuestions ?? []).find((q) => (q.affects ?? []).includes(id))?.reason ?? null;
const title = (lead) => lead.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function stepDraft(view, w, name) {
  if (isDraft(w)) return true;
  const users = view.features.filter((f) => (f.steps ?? []).includes(`${w.id}:${name}`));
  return users.length > 0 && users.every(isDraft);
}

function flowData(view, w, flows) {
  const steps = w.steps ?? [];
  return {
    id: w.id, name: w.name, draft: isDraft(w),
    steps: steps.map((s) => ({ name: s, draft: stepDraft(view, w, s) })),
    branches: (w.branches ?? []).map((b) => ({
      from: b.from, to: b.to, label: b.label ?? null, back: steps.includes(b.to), draft: stepDraft(view, w, b.to),
    })),
    sub: w.sub ? {
      startsAt: w.sub.startsAt.slice(w.sub.startsAt.indexOf(':') + 1),
      rejoins: flows.get(w.sub.rejoins)?.name ?? null, share: w.sub.share ?? null,
    } : null,
  };
}

function card(ctx, r, kind) {
  const prior = ctx.out.get(r.id);
  const what = kind === 'feature' ? r.does : kind === 'system' ? r.purpose : r.trigger ? `Starts when ${r.trigger}.` : null;
  return {
    id: r.id, kind, system: ctx.system, name: r.name, what, why: pairedReason(ctx.view, r.id),
    answer: prior ? 'no' : r.review?.answer ?? null, note: (prior ?? r.review)?.note ?? null,
  };
}

const decide = (ctx, r) => isDraft(r) || Boolean(r.review) || ctx.out.has(r.id);

function systemData(s, ctx) {
  const c = { ...ctx, system: s.id };
  const flows = s.workflows.map((id) => ctx.flows.get(id));
  const feats = s.features.map((id) => ctx.feats.get(id));
  const cards = [
    ...(decide(c, s) ? [card(c, s, 'system')] : []),
    ...flows.filter((w) => decide(c, w)).map((w) => card(c, w, 'workflow')),
    ...feats.filter((f) => decide(c, f)).map((f) => card(c, f, 'feature')),
  ];
  const agreed = feats.filter((f) => !decide(c, f)).map((f) => ({ name: f.name, does: f.does }));
  return { id: s.id, name: s.name, purpose: s.purpose, flows: flows.map((w) => flowData(ctx.view, w, ctx.flows)), cards, agreed };
}

export function pageData(pkg, date) {
  const { view, out } = restoreAll(pkg);
  const ctx = {
    view, out,
    flows: new Map((view.workflows ?? []).map((w) => [w.id, w])),
    feats: new Map(view.features.map((f) => [f.id, f])),
  };
  const systems = view.systems.map((s) => systemData(s, ctx));
  const onCards = new Set(systems.flatMap((s) => s.cards.map((x) => x.id)));
  const questions = (view.openQuestions ?? [])
    .filter((q) => !(q.affects ?? []).some((id) => onCards.has(id)) && (q.status === 'open' || q.review))
    .map((q) => ({ id: q.id, text: q.question, answer: q.review?.answer ?? null }));
  return { lead: pkg.lead, title: title(pkg.lead), date, systems, questions };
}
~~~~

Write `plugins/business-analyst/skills/business-analyst/assets/review-decisions.js` (whole file):

~~~~js
// Page state → the decisions block the PO copies (spec §3). Pure: the review
// page inlines this file (with `export ` stripped) and the tests import it,
// so the text a PO pastes is the text `review apply` is tested on.
export const allCards = (data) => data.systems.flatMap((s) => s.cards);

export function initialState(data) {
  const state = {};
  for (const c of allCards(data)) state[c.id] = { v: c.answer, note: c.note ?? '' };
  for (const q of data.questions) state[q.id] = { text: q.answer ?? '' };
  return state;
}

// A card inside a system the PO left out is not asked: the system decides it.
export const isOff = (state, card) => card.kind !== 'system' && state[card.system]?.v === 'no';

function cardDecision(card, s) {
  const d = { id: card.id, name: card.name, answer: s.v };
  if (s.note && s.note.trim()) d.note = s.note.trim();
  return d;
}

export function decisionBody(data, state) {
  const decisions = [];
  const skipped = [];
  for (const c of allCards(data).filter((x) => !isOff(state, x))) {
    const s = state[c.id] ?? {};
    if (s.v) decisions.push(cardDecision(c, s));
    else skipped.push(c.id);
  }
  for (const q of data.questions) {
    const t = (state[q.id]?.text ?? '').trim();
    if (t) decisions.push({ id: q.id, question: q.text, answer: t });
    else skipped.push(q.id);
  }
  return { reviewDecisions: 1, lead: data.lead, date: data.date, decisions, skipped };
}

export function decisionText(data, state) {
  const json = JSON.stringify(decisionBody(data, state), null, 2);
  return `Here are my review decisions — please apply them.\n\n\`\`\`json\n${json}\n\`\`\``;
}

export function progress(data, state) {
  const { decisions, skipped } = decisionBody(data, state);
  return { done: decisions.length, total: decisions.length + skipped.length };
}
~~~~

- [ ] **Step 4: Write the template (built from the approved mockup `docs/mockups/ba-review-page/mockup.html`: mockup banner, mode toggle and sample data removed; `[hidden]` rule and a plain `.areas` grid added; cards render text with `textContent` only)**

Write `plugins/business-analyst/skills/business-analyst/assets/review-page.html` (whole file):

~~~~html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scope review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,500..800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column; each business area is a stop on the route, its workflow drawn as a line of steps, its open items stacked under it; a fixed dock at the bottom carries progress + Copy. */
:root {
  --bg: #f3f5f6;
  --paper: #ffffff;
  --ink: #17232b;
  --ink-soft: #4d5d68;
  --rule: #d5dde2;
  --harbour: #1f5f7a;
  --harbour-tint: #e3eef3;
  --signal: #b86a00;
  --signal-tint: #fdf1de;
  --yes: #2f7a4b;
  --yes-tint: #e2f2e7;
  --no: #8a3b3b;
  --no-tint: #f6e6e4;
  --f-display: "Archivo", "Arial Narrow", system-ui, sans-serif;
  --f-body: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0f171c; --paper: #16222a; --ink: #e6edf0; --ink-soft: #9fb0ba; --rule: #2b3b45;
  --harbour: #6fb4d1; --harbour-tint: #18323f; --signal: #f0a33a; --signal-tint: #33260f;
  --yes: #6cc58d; --yes-tint: #16301f; --no: #e08f8a; --no-tint: #3a1d1c; color-scheme: dark;
} }
:root[data-theme="dark"] {
  --bg: #0f171c; --paper: #16222a; --ink: #e6edf0; --ink-soft: #9fb0ba; --rule: #2b3b45;
  --harbour: #6fb4d1; --harbour-tint: #18323f; --signal: #f0a33a; --signal-tint: #33260f;
  --yes: #6cc58d; --yes-tint: #16301f; --no: #e08f8a; --no-tint: #3a1d1c; color-scheme: dark;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { background: var(--bg); color: var(--ink); font: 17px/1.55 var(--f-body); padding-inline: 16px; padding-block: 0 140px; }
.wrap { max-width: 760px; margin: 0 auto; display: grid; gap: 28px; }
h1, h2, h3 { font-family: var(--f-display); text-wrap: balance; margin: 0; }
button { font: inherit; cursor: pointer; }
:focus-visible { outline: 3px solid var(--harbour); outline-offset: 2px; }


header.top { display: grid; gap: 10px; padding-top: 8px; }
.eyebrow { font-family: var(--f-display); font-stretch: 80%; font-weight: 700; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: var(--harbour); }
header.top h1 { font-size: clamp(30px, 6vw, 42px); font-weight: 800; font-stretch: 85%; line-height: 1.08; }
.lede { margin: 0; max-width: 62ch; color: var(--ink-soft); }
.legend { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 15px; color: var(--ink-soft); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }

.areas { display: grid; gap: 28px; }
.area { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; padding: 22px clamp(16px, 4vw, 28px); display: grid; gap: 18px; }
.area h2 { font-size: 26px; font-weight: 750; font-stretch: 88%; }
.area .purpose { margin: 4px 0 0; color: var(--ink-soft); }
.label { font-family: var(--f-display); font-stretch: 80%; font-weight: 700; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); }

.flow { overflow-x: auto; padding-bottom: 4px; display: grid; gap: 10px; }
.line { display: flex; align-items: center; gap: 0; min-width: max-content; }
.step { border: 1.5px solid var(--harbour); background: var(--harbour-tint); color: var(--ink); border-radius: 999px; padding: 6px 14px; font-size: 15px; white-space: nowrap; }
.step.draft { border-style: dashed; border-color: var(--signal); background: var(--signal-tint); }
.arrow { width: 26px; height: 2px; background: var(--harbour); position: relative; flex: none; }
.arrow::after { content: ""; position: absolute; right: -1px; top: -4px; border: 5px solid transparent; border-left: 7px solid var(--harbour); border-right: 0; }
.arrow.draft { background: var(--signal); } .arrow.draft::after { border-left-color: var(--signal); }
.branch { display: flex; align-items: center; gap: 8px; min-width: max-content; padding-left: 18px; font-size: 14px; color: var(--ink-soft); }
.branch .hook { font-family: var(--f-mono); color: var(--signal); }
.branch.ok .hook { color: var(--harbour); }

.items { display: grid; gap: 12px; }
.item { border: 1px solid var(--rule); border-radius: 12px; padding: 16px; display: grid; gap: 10px; background: var(--paper); }
.item.off { opacity: .55; }
.item[data-state="open"] { border-color: var(--signal); box-shadow: 0 0 0 3px var(--signal-tint); }
.item-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.item h3 { font-size: 20px; font-weight: 700; font-stretch: 92%; }
.kind { font-size: 14px; color: var(--ink-soft); margin-top: 2px; }
.chip { flex: none; font-size: 13px; font-weight: 700; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
.chip.open { background: var(--signal-tint); color: var(--signal); }
.chip.yes { background: var(--yes-tint); color: var(--yes); }
.chip.no { background: var(--no-tint); color: var(--no); }
.item p { margin: 0; max-width: 62ch; }
.why { color: var(--ink-soft); font-size: 15.5px; }
.why strong { color: var(--ink); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.choice { border: 1.5px solid var(--rule); background: transparent; color: var(--ink); border-radius: 10px; padding: 9px 16px; min-height: 44px; font-weight: 700; }
.choice[data-v="yes"][aria-pressed="true"] { background: var(--yes); border-color: var(--yes); color: var(--paper); }
.choice[data-v="no"][aria-pressed="true"] { background: var(--no); border-color: var(--no); color: var(--paper); }
.linkish { border: 0; background: none; color: var(--harbour); text-decoration: underline; text-underline-offset: 3px; padding: 8px 4px; min-height: 44px; }
textarea { width: 100%; font: 16px/1.45 var(--f-body); color: var(--ink); background: var(--bg); border: 1.5px solid var(--rule); border-radius: 10px; padding: 10px 12px; resize: vertical; min-height: 64px; }
textarea:focus { border-color: var(--harbour); outline: none; }
.agreed summary { cursor: pointer; color: var(--ink-soft); font-size: 15px; }
.agreed ul { margin: 8px 0 0; padding-left: 20px; color: var(--ink-soft); font-size: 15.5px; }

.qs { display: grid; gap: 16px; }
.q { display: grid; gap: 8px; }
.q label { font-weight: 700; }
.q .hint { color: var(--ink-soft); font-size: 15px; margin: 0; }

.dock { position: fixed; left: 0; right: 0; bottom: 0; background: var(--paper); border-top: 1px solid var(--rule); padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); }
.dock-in { max-width: 760px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; }
.progress { display: grid; gap: 6px; min-width: 0; flex: 1 1 220px; }
.progress span { font-size: 15px; } .progress b { font-variant-numeric: tabular-nums; }
.meter { height: 6px; background: var(--rule); border-radius: 99px; overflow: hidden; }
.meter i { display: block; height: 100%; background: var(--harbour); width: 0; transition: width .25s; }
.copy { border: 0; background: var(--harbour); color: var(--paper); border-radius: 10px; padding: 12px 22px; min-height: 48px; font-family: var(--f-display); font-weight: 750; font-size: 17px; }
.toast { flex-basis: 100%; font-size: 15px; color: var(--yes); margin: 0; }
.fallback { flex-basis: 100%; font: 13px/1.5 var(--f-mono); min-height: 140px; }
.preview { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; padding: 18px; display: grid; gap: 8px; }
.preview summary { cursor: pointer; }
.preview pre { margin: 0; font: 13px/1.55 var(--f-mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink-soft); }
@media (prefers-reduced-motion: reduce) { .meter i { transition: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="eyebrow" id="eyebrow"></div>
    <h1>A few things need your yes or no</h1>
    <p class="lede">We drew up how each part of the new system will work. Most of it came straight from the client. The items in <strong>orange</strong> are our suggestions or guesses, so they need your decision. If you're not sure, skip it and it stays open for the client.</p>
    <div class="legend">
      <span><span class="step" style="padding:2px 10px">Agreed step</span></span>
      <span><span class="step draft" style="padding:2px 10px">Needs your decision</span></span>
    </div>
  </header>

  <main id="areas" class="areas"></main>

  <section class="area" id="qs-area" aria-labelledby="qs-title">
    <div>
      <h2 id="qs-title">Questions for you</h2>
      <p class="purpose">The client hasn't answered these yet. Answer the ones you know and leave the rest blank.</p>
    </div>
    <div id="qs" class="qs"></div>
  </section>

  <details class="preview">
    <summary class="label">What “Copy decisions” puts on your clipboard</summary>
    <pre id="pv"></pre>
  </details>
</div>

<div class="dock">
  <div class="dock-in">
    <div class="progress">
      <span><b id="count">0 of 0</b> answered</span>
      <div class="meter" aria-hidden="true"><i id="bar"></i></div>
    </div>
    <button class="copy" id="copy">Copy decisions</button>
    <p class="toast" id="toast" role="status" hidden></p>
    <textarea class="fallback" id="fallback" hidden readonly aria-label="Decisions to copy"></textarea>
  </div>
</div>

<script>
const DATA = /*@DATA@*/null;
/*@DECISIONS@*/
const KIND = { system: "Area we suggest", workflow: "Workflow we drew", feature: "Feature we suggest" };
let state = initialState(DATA);
const cards = [];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function chain(row, steps) {
  steps.forEach((s, i) => {
    if (i) row.append(el("span", "arrow" + (s.draft ? " draft" : "")));
    row.append(el("span", "step" + (s.draft ? " draft" : ""), s.name));
  });
  return row;
}
function drawBranch(b) {
  const row = el("div", "branch" + (b.draft ? "" : " ok"));
  row.append(el("span", "hook", "↳"), el("span", "", "from “" + b.from + "”" + (b.label ? " (" + b.label + ")" : "") + ":"));
  if (b.back) row.append(el("span", "", "back to “" + b.to + "”"));
  else row.append(el("span", "step" + (b.draft ? " draft" : ""), b.to));
  return row;
}
function drawFlow(f) {
  const box = el("div", "flow");
  if (f.sub) box.append(el("div", "kind", f.name + ": starts at “" + f.sub.startsAt + "”, rejoins “" + f.sub.rejoins + "”" + (f.sub.share ? " · " + f.sub.share : "")));
  else box.append(el("div", "kind", f.name));
  box.append(chain(el("div", "line"), f.steps));
  f.branches.forEach((b) => box.append(drawBranch(b)));
  return box;
}
function paint(c) {
  const s = state[c.it.id] || {};
  const off = isOff(state, c.it);
  c.card.classList.toggle("off", off);
  [c.yes, c.no].forEach((b) => { b.setAttribute("aria-pressed", String(s.v === b.dataset.v)); b.disabled = off; });
  c.chip.className = "chip " + (off ? "no" : s.v || "open");
  c.chip.textContent = off ? "Left out with the area" : s.v === "yes" ? "Included" : s.v === "no" ? "Left out" : "Needs your decision";
  c.card.dataset.state = s.v || off ? "done" : "open";
  if (s.note) c.note.hidden = false;
  c.noteBtn.textContent = c.note.hidden ? "Add a note" : "Hide note";
}
function wire(c) {
  [c.yes, c.no].forEach((b) => b.onclick = () => {
    const s = state[c.it.id] || (state[c.it.id] = { v: null, note: "" });
    s.v = s.v === b.dataset.v ? null : b.dataset.v;
    refresh();
  });
  c.noteBtn.onclick = () => { c.note.hidden = !c.note.hidden; paint(c); if (!c.note.hidden) c.note.focus(); };
  c.note.oninput = () => { (state[c.it.id] || (state[c.it.id] = { v: null })).note = c.note.value; refresh(); };
}
function drawItem(it) {
  const c = { it, card: el("article", "item"), chip: el("span", "chip"), note: el("textarea") };
  const head = el("div", "item-head"), titles = el("div"), acts = el("div", "actions");
  titles.append(el("h3", "", it.name), el("div", "kind", KIND[it.kind]));
  head.append(titles, c.chip);
  c.yes = el("button", "choice", "Yes, include it"); c.yes.dataset.v = "yes";
  c.no = el("button", "choice", "No, leave it out"); c.no.dataset.v = "no";
  c.noteBtn = el("button", "linkish", "Add a note");
  c.note.placeholder = "e.g. “Yes, but only for office staff”"; c.note.hidden = true; c.note.value = (state[it.id] || {}).note || "";
  acts.append(c.yes, c.no, c.noteBtn);
  c.card.append(head);
  if (it.what) c.card.append(el("p", "", it.what));
  if (it.why) c.card.append(el("p", "why", "Why we ask: " + it.why));
  c.card.append(acts, c.note);
  wire(c); cards.push(c);
  return c.card;
}
function drawAgreed(list) {
  const det = el("details", "agreed"), ul = el("ul");
  det.append(el("summary", "", "Already agreed with the client (" + list.length + ")"), ul);
  list.forEach((a) => ul.append(el("li", "", a.name + " — " + a.does)));
  return det;
}
function drawArea(area) {
  const sec = el("section", "area"), head = el("div");
  head.append(el("h2", "", area.name), el("p", "purpose", area.purpose));
  sec.append(head, el("div", "label", "How it works"));
  area.flows.forEach((f) => sec.append(drawFlow(f)));
  if (area.cards.length) {
    const list = el("div", "items");
    area.cards.forEach((it) => list.append(drawItem(it)));
    sec.append(el("div", "label", "Needs your decision"), list);
  }
  if (area.agreed.length) sec.append(drawAgreed(area.agreed));
  return sec;
}
function drawQuestions() {
  const box = document.getElementById("qs");
  document.getElementById("qs-area").hidden = !DATA.questions.length;
  DATA.questions.forEach((q) => {
    const wrap = el("div", "q"), lab = el("label", "", q.text), ta = el("textarea");
    ta.id = "ans-" + q.id; lab.htmlFor = ta.id; ta.placeholder = "Your answer";
    ta.value = state[q.id].text;
    ta.oninput = () => { state[q.id] = { text: ta.value }; refresh(); };
    wrap.append(lab, ta); box.append(wrap);
  });
}
function refresh() {
  cards.forEach(paint);
  const p = progress(DATA, state);
  document.getElementById("count").textContent = p.done + " of " + p.total;
  document.getElementById("bar").style.width = (p.total ? 100 * p.done / p.total : 100) + "%";
  document.getElementById("pv").textContent = decisionText(DATA, state);
}
function copyDecisions() {
  const text = decisionText(DATA, state), toast = document.getElementById("toast"), fb = document.getElementById("fallback");
  const ok = () => { toast.textContent = "Copied. Now paste it into the chat and send."; toast.hidden = false; fb.hidden = true; };
  const fail = () => {
    fb.value = text; fb.hidden = false; fb.select();
    toast.textContent = "Couldn't copy automatically. The text below is selected: press Ctrl+C (⌘C on Mac), then paste it into the chat.";
    toast.hidden = false;
  };
  try { navigator.clipboard.writeText(text).then(ok, fail); } catch (e) { fail(); }
}
document.title = DATA.title + " — scope review";
document.getElementById("eyebrow").textContent = DATA.title + " · scope review";
DATA.systems.forEach((a) => document.getElementById("areas").append(drawArea(a)));
drawQuestions();
document.getElementById("copy").onclick = copyDecisions;
refresh();
</script>
</body>
</html>
~~~~

- [ ] **Step 5: Write the fill and the CLI (page only)**

Write `plugins/business-analyst/skills/business-analyst/scripts/lib/review-page.mjs` (whole file):

~~~~js
// Fills the fixed review page template (spec R9): page data and the
// decisions script go into two slots. A slot missing or doubled throws, so a
// template edit can never ship a page without its data.
import { readFileSync } from 'node:fs';
import { pageData } from './review-data.mjs';

const asset = (name) => readFileSync(new URL(`../../assets/${name}`, import.meta.url), 'utf8');

function fill(template, slot, value) {
  const parts = template.split(slot);
  if (parts.length !== 2) throw new Error(`template slot ${slot} must appear once`);
  return parts.join(value);
}

// `<` is escaped so no name can close the <script> tag the data sits in.
export function fillPage(template, data, decisionsSrc) {
  const page = fill(template, '/*@DECISIONS@*/', decisionsSrc.replace(/^export /gm, ''));
  return fill(page, '/*@DATA@*/null', JSON.stringify(data).replaceAll('<', '\\u003c'));
}

export function pageHtml(pkg, date) {
  return fillPage(asset('review-page.html'), pageData(pkg, date), asset('review-decisions.js'));
}
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/review.mjs` (whole file):

~~~~js
// The PO review page (spec §2–§3):
//   node review.mjs page  --json requirements.json --out review.html [--date YYYY-MM-DD]
//   node review.mjs apply --json requirements.json --decisions decisions.json
import { readFileSync, writeFileSync } from 'node:fs';
import { collectIds } from './lib/checks.mjs';
import { modeOf, scopeIds } from './lib/scope-rules.mjs';
import { checkScope } from './lib/scope-checks.mjs';
import { pageHtml } from './lib/review-page.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const pad = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function fail(findings) {
  console.error(findings.join('\n'));
  process.exit(1);
}

function page(pkg, args) {
  if (modeOf(pkg) === 'classic') return console.log('classic mode: no review page');
  const findings = checkScope(pkg, new Set([...collectIds(pkg), ...scopeIds(pkg)]));
  if (findings.length) fail(findings);
  writeFileSync(args.out, pageHtml(pkg, args.date ?? today()));
  console.log(`review page written: ${args.out}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (cmd !== 'page') fail(['usage: review.mjs page|apply --json <requirements.json> …']);
page(JSON.parse(readFileSync(args.json, 'utf8')), args);
~~~~

- [ ] **Step 6: Python twins**

Write `plugins/business-analyst/skills/business-analyst/scripts/review_data.py` (whole file):

~~~~python
"""Review page data and template fill; mirrors lib/review-data.mjs +
lib/review-page.mjs. Byte-identical page, kept in lockstep by
scripts/test/python-parity.test.mjs."""
import json
import os
import re

from left_out import restore_all

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')


def is_draft(r):
    return r.get('label') != 'confirmed'


def paired_reason(view, rid):
    q = next((q for q in view.get('openQuestions') or [] if rid in (q.get('affects') or [])), None)
    return q.get('reason') if q and q.get('reason') is not None else None


def title(lead):
    return ' '.join(w[:1].upper() + w[1:] for w in lead.split('-'))


def step_draft(view, w, name):
    if is_draft(w):
        return True
    users = [f for f in view['features'] if f"{w['id']}:{name}" in (f.get('steps') or [])]
    return len(users) > 0 and all(is_draft(f) for f in users)


def flow_data(view, w, flows):
    steps = w.get('steps') or []
    sub = w.get('sub')
    return {
        'id': w['id'], 'name': w['name'], 'draft': is_draft(w),
        'steps': [{'name': s, 'draft': step_draft(view, w, s)} for s in steps],
        'branches': [{'from': b['from'], 'to': b['to'], 'label': b.get('label'), 'back': b['to'] in steps,
                      'draft': step_draft(view, w, b['to'])} for b in w.get('branches') or []],
        'sub': {
            'startsAt': sub['startsAt'][sub['startsAt'].index(':') + 1:],
            'rejoins': (flows.get(sub['rejoins']) or {}).get('name'), 'share': sub.get('share'),
        } if sub else None,
    }


def card(ctx, r, kind):
    prior = ctx['out'].get(r['id'])
    trigger = r.get('trigger')
    what = r.get('does') if kind == 'feature' else r.get('purpose') if kind == 'system' else f'Starts when {trigger}.' if trigger else None
    review = r.get('review') or {}
    return {
        'id': r['id'], 'kind': kind, 'system': ctx['system'], 'name': r['name'], 'what': what,
        'why': paired_reason(ctx['view'], r['id']),
        'answer': 'no' if prior else review.get('answer'), 'note': (prior or review).get('note'),
    }


def decide(ctx, r):
    return is_draft(r) or bool(r.get('review')) or r['id'] in ctx['out']


def system_data(s, ctx):
    c = {**ctx, 'system': s['id']}
    flows = [ctx['flows'][i] for i in s['workflows']]
    feats = [ctx['feats'][i] for i in s['features']]
    cards = ([card(c, s, 'system')] if decide(c, s) else []) \
        + [card(c, w, 'workflow') for w in flows if decide(c, w)] \
        + [card(c, f, 'feature') for f in feats if decide(c, f)]
    agreed = [{'name': f['name'], 'does': f['does']} for f in feats if not decide(c, f)]
    return {'id': s['id'], 'name': s['name'], 'purpose': s['purpose'],
            'flows': [flow_data(ctx['view'], w, ctx['flows']) for w in flows], 'cards': cards, 'agreed': agreed}


def page_data(pkg, date):
    view, out = restore_all(pkg)
    ctx = {'view': view, 'out': out,
           'flows': {w['id']: w for w in view.get('workflows') or []},
           'feats': {f['id']: f for f in view['features']}}
    systems = [system_data(s, ctx) for s in view['systems']]
    on_cards = {c['id'] for s in systems for c in s['cards']}
    questions = [{'id': q['id'], 'text': q['question'], 'answer': (q.get('review') or {}).get('answer')}
                 for q in view.get('openQuestions') or []
                 if not any(a in on_cards for a in q.get('affects') or [])
                 and (q.get('status') == 'open' or q.get('review'))]
    return {'lead': pkg['lead'], 'title': title(pkg['lead']), 'date': date, 'systems': systems, 'questions': questions}


def asset(name):
    with open(os.path.join(ASSETS, name), encoding='utf-8') as f:
        return f.read()


def fill(template, slot, value):
    parts = template.split(slot)
    if len(parts) != 2:
        raise ValueError(f'template slot {slot} must appear once')
    return value.join(parts)


def fill_page(template, data, decisions_src):
    page = fill(template, '/*@DECISIONS@*/', re.sub(r'^export ', '', decisions_src, flags=re.M))
    blob = json.dumps(data, separators=(',', ':'), ensure_ascii=False).replace('<', '\\u003c')
    return fill(page, '/*@DATA@*/null', blob)


def page_html(pkg, date):
    return fill_page(asset('review-page.html'), page_data(pkg, date), asset('review-decisions.js'))
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/review.py` (whole file):

~~~~python
#!/usr/bin/env python3
"""Python port of review.mjs: the PO review page and applying its decisions.
Same flags, same bytes, same exit codes; kept in lockstep by
scripts/test/python-parity.test.mjs."""
import datetime
import json
import sys

from review_data import page_html
from scope_checks import check_scope, mode_of, scope_ids
from validate import collect_ids


def parse_args(argv):
    args, i = {}, 0
    while i < len(argv):
        if argv[i].startswith('--'):
            args[argv[i][2:]] = argv[i + 1]
            i += 1
        i += 1
    return args


def fail(findings):
    print('\n'.join(findings), file=sys.stderr)
    sys.exit(1)


def page(pkg, args):
    if mode_of(pkg) == 'classic':
        print('classic mode: no review page')
        return
    findings = check_scope(pkg, set(collect_ids(pkg)) | set(scope_ids(pkg)))
    if findings:
        fail(findings)
    with open(args['out'], 'w', encoding='utf-8', newline='') as f:
        f.write(page_html(pkg, args.get('date') or datetime.date.today().isoformat()))
    print(f"review page written: {args['out']}")


def main(argv):
    cmd, args = (argv[0] if argv else None), parse_args(argv[1:])
    if cmd != 'page':
        fail(['usage: review.mjs page|apply --json <requirements.json> …'])
    with open(args['json'], encoding='utf-8') as f:
        pkg = json.load(f)
    page(pkg, args)


if __name__ == '__main__':
    main(sys.argv[1:])
~~~~

- [ ] **Step 7: Run the BA suite**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`. Browser tests skip only if no Chrome is on PATH — say so if they did.

- [ ] **Step 8: Commit** (one command per call)

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/review-data.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/review-page.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/assets
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/review.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/review_data.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/review.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/review-browser.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/quality-gates.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs
/usr/bin/git commit -m "feat(business-analyst): PO review page"
```

### Task 6: Apply the pasted decisions (`review apply`)

**Files:**
- Create: `plugins/business-analyst/skills/business-analyst/scripts/lib/review-apply.mjs`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/review_apply.py`
- Modify (full rewrite): `plugins/business-analyst/skills/business-analyst/scripts/review.mjs`
- Modify (full rewrite): `plugins/business-analyst/skills/business-analyst/scripts/review.py`
- Create: `plugins/business-analyst/skills/business-analyst/scripts/test/review-apply.test.mjs`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/test/review-browser.test.mjs`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/test/quality-gates.test.mjs`
- Modify: `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs` (one block)

**Interfaces:**
- Consumes: `pageData` (Task 5), `moveOut`/`moveBack`/`entryOf`/`kindOf` (Task 2), `checkPackage` with `md: null` (Task 4).
- Produces: `parseDecisions(text) → block | null` (takes the first ```json fence, else the whole text; null on bad JSON); `checkDecisions(pkg, block) → string[]`; `applyDecisions(pkg, block) → { pkg, lines }` (pure). Python: `parse_decisions`, `check_decisions`, `apply_decisions → (pkg, lines)`.
- CLI: `review.mjs apply --json r.json --decisions <file>` rewrites r.json as `JSON.stringify(pkg, null, 2) + "\n"` and prints `lines`; any finding → exit 1, file untouched.

- [ ] **Step 1: Write the failing tests**

Write `plugins/business-analyst/skills/business-analyst/scripts/test/review-apply.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDecisions, checkDecisions, applyDecisions } from '../lib/review-apply.mjs';
import { pageData } from '../lib/review-data.mjs';
import { applyScope } from '../lib/scope-md.mjs';
import { checkPackage } from '../lib/checks.mjs';
import { initialState, decisionText } from '../../assets/review-decisions.js';
import { loadWorkflow } from './scope-cases.mjs';
import { DATE, decisions, reviewed, withQuestion, YES_WF3, NO_FEAT4, ANSWER_Q3 } from './review-fixture.mjs';

const script = fileURLToPath(new URL('../review.mjs', import.meta.url));
const pkg0 = () => withQuestion(loadWorkflow().pkg);
const q = (pkg, id) => pkg.openQuestions.find((x) => x.id === id);

test('apply produces exactly the reviewed fixture', () => {
  assert.deepEqual(applyDecisions(pkg0(), decisions([YES_WF3, NO_FEAT4, ANSWER_Q3])).pkg, reviewed().pkg);
});

test('yes confirms the item and answers its paired question', () => {
  const { pkg, lines } = applyDecisions(pkg0(), decisions([YES_WF3]));
  const wf = pkg.workflows.find((w) => w.id === 'WF-003');
  assert.equal(wf.label, 'confirmed');
  assert.equal(wf.source, 'confirmed by PO in review, 2026-10-07');
  assert.deepEqual(wf.review, { answer: 'yes', date: DATE });
  assert.deepEqual([q(pkg, 'Q-001').status, q(pkg, 'Q-001').answer], ['answered', 'confirmed in review']);
  assert.deepEqual(lines, ['1 decided, 0 still open']);
});

test('no moves the item out and records the note', () => {
  const { pkg, lines } = applyDecisions(pkg0(), decisions([NO_FEAT4], ['WF-003']));
  assert.deepEqual(pkg.leftOut.map((e) => [e.id, e.note]), [['FEAT-004', 'we invoice from the signed DO']]);
  assert.equal(q(pkg, 'Q-002').answer, 'left out in review: we invoice from the signed DO');
  assert.deepEqual(lines, ['FEAT-004 note: "we invoice from the signed DO"', '1 decided, 1 still open']);
});

test('a question answer is recorded and reported', () => {
  const { pkg, lines } = applyDecisions(pkg0(), decisions([ANSWER_Q3]));
  assert.deepEqual(q(pkg, 'Q-003').review, { answer: 'About 6', date: DATE });
  assert.equal(q(pkg, 'Q-003').status, 'answered');
  assert.equal(lines[0], 'Q-003 answered: "About 6" — update what depends on it');
});

test('no on a workflow says its features need a new place', () => {
  const { lines } = applyDecisions(pkg0(), decisions([{ id: 'WF-003', name: 'Order to cash', answer: 'no' }]));
  assert.equal(lines[0], 'WF-003 left out — features that used its steps need a new place');
});

test('yes after no puts the lists back as they were', () => {
  const before = pkg0();
  const out = applyDecisions(before, decisions([NO_FEAT4])).pkg;
  const back = applyDecisions(out, decisions([{ ...NO_FEAT4, answer: 'yes', note: undefined }])).pkg;
  for (const k of ['systems', 'workflows', 'requirements', 'scope']) assert.deepEqual(back[k], before[k]);
  assert.deepEqual(back.features.map((f) => f.id), before.features.map((f) => f.id));
  assert.equal('leftOut' in back, false);
});

test('a second no only updates the note', () => {
  const once = applyDecisions(pkg0(), decisions([NO_FEAT4])).pkg;
  const twice = applyDecisions(once, decisions([{ ...NO_FEAT4, note: 'phase 2' }])).pkg;
  assert.equal(twice.leftOut.length, 1);
  assert.equal(twice.leftOut[0].note, 'phase 2');
  assert.equal(Object.keys(twice.leftOut[0]).at(-1), 'item');
});

test('wrong lead, unknown id, bad answer and a bad date are all reported', () => {
  const dec = { ...decisions([{ id: 'FEAT-001', answer: 'yes' }, { id: 'WF-003', answer: 'maybe' }, { id: 'Q-003', answer: ' ' }]), lead: 'other', date: '7/10' };
  assert.deepEqual(checkDecisions(pkg0(), dec), [
    'decisions: lead other is not sin-kowa-mini', 'decisions: date must be YYYY-MM-DD',
    'FEAT-001: not on the review page', 'WF-003: answer must be yes or no', 'Q-003: answer is empty']);
  assert.deepEqual(checkDecisions(pkg0(), { hello: 1 }), ['decisions: not a review decisions block']);
});

test('a decision inside a left-out system is refused', () => {
  const pkg = pkg0();
  pkg.systems[1].label = 'recommended';
  pkg.openQuestions[0].affects.push('SYS-002');
  const dec = decisions([{ id: 'SYS-002', answer: 'no' }, { id: 'FEAT-004', answer: 'yes' }]);
  assert.deepEqual(checkDecisions(pkg, dec), ['FEAT-004: its system SYS-002 is left out']);
});

test('the pasted text is read with or without its sentence', () => {
  const block = decisions([YES_WF3]);
  assert.deepEqual(parseDecisions(`Here are my review decisions — please apply them.\n\n\`\`\`json\n${JSON.stringify(block)}\n\`\`\``), block);
  assert.deepEqual(parseDecisions(JSON.stringify(block)), block);
});

test('round trip: page state → copied text → apply → validate → scope', () => {
  const pkg = pkg0();
  const data = pageData(pkg, DATE);
  const state = initialState(data);
  state['WF-003'].v = 'yes';
  Object.assign(state['FEAT-004'], { v: 'no', note: 'we invoice from the signed DO' });
  state['Q-003'].text = 'About 6';
  const dec = parseDecisions(decisionText(data, state));
  assert.deepEqual(checkDecisions(pkg, dec), []);
  const next = applyDecisions(pkg, dec).pkg;
  assert.deepEqual(checkPackage({ pkg: next, md: null }), []);
  assert.match(applyScope(loadWorkflow().md, next), /\| FEAT-004 \| Invoice from packed quantities \| we invoice from the signed DO \| 2026-10-07 \|/);
});

test('review apply: a refused paste leaves the file byte-identical', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-apply-'));
  const json = join(dir, 'r.json');
  const raw = JSON.stringify(pkg0());
  writeFileSync(json, raw);
  writeFileSync(join(dir, 'd.json'), JSON.stringify({ ...decisions([YES_WF3]), lead: 'other' }));
  assert.throws(() => execFileSync('node', [script, 'apply', '--json', json, '--decisions', join(dir, 'd.json')], { stdio: 'pipe' }));
  assert.equal(readFileSync(json, 'utf8'), raw);
});

test('review apply: writes 2-space JSON and prints the notes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-apply-'));
  const json = join(dir, 'r.json');
  writeFileSync(json, JSON.stringify(pkg0()));
  writeFileSync(join(dir, 'd.json'), JSON.stringify(decisions([NO_FEAT4])));
  const out = execFileSync('node', [script, 'apply', '--json', json, '--decisions', join(dir, 'd.json')], { encoding: 'utf8' });
  assert.equal(out, 'FEAT-004 note: "we invoice from the signed DO"\n1 decided, 0 still open\n');
  assert.match(readFileSync(json, 'utf8'), /^\{\n {2}"schemaVersion": "1\.0",\n[\s\S]*\}\n$/);
});

test('a mangled paste is refused cleanly', () => {
  const curly = '```json\n{ “reviewDecisions”: 1 }\n```';
  assert.equal(parseDecisions(curly), null);
  assert.deepEqual(checkDecisions(pkg0(), parseDecisions(curly)), ['decisions: not a review decisions block']);
});

test('no after an earlier yes moves the item out and drops its review', () => {
  const yes = applyDecisions(pkg0(), decisions([{ ...NO_FEAT4, answer: 'yes' }])).pkg;
  const no = applyDecisions(yes, decisions([NO_FEAT4])).pkg;
  const entry = no.leftOut.find((e) => e.id === 'FEAT-004');
  assert.equal('review' in entry.item, false);
  assert.equal(no.requirements.find((r) => r.id === 'FR-004').scope, 'out');
});

test('a review with nothing answered changes nothing but is accepted', () => {
  const dec = decisions([], ['WF-003', 'FEAT-004']);
  assert.deepEqual(checkDecisions(pkg0(), dec), []);
  const { pkg, lines } = applyDecisions(pkg0(), dec);
  assert.deepEqual(pkg, pkg0());
  assert.deepEqual(lines, ['0 decided, 2 still open']);
});
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/test/review-browser.test.mjs`, 2 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { pageHtml } from '../lib/review-page.mjs';
~~~~

with

~~~~js
import { pageHtml } from '../lib/review-page.mjs';
import { parseDecisions, checkDecisions } from '../lib/review-apply.mjs';
~~~~

(2) replace

~~~~js
test('"review decisions" reopens
~~~~

with

~~~~js
test('clicking answers produces a block apply accepts', skip, async () => {
  const pkg = withQuestion(loadWorkflow().pkg);
  const page = await open(pkg);
  try {
    await page.eval(click(0, 'yes'));
    await page.eval(click(1, 'no'));
    await page.eval(`(() => { const t = document.getElementById('ans-Q-003'); t.value = 'About 6'; t.dispatchEvent(new Event('input')); })()`);
    assert.equal(await page.eval(`document.getElementById('count').textContent`), '3 of 3');
    const dec = parseDecisions(await page.eval(`document.getElementById('pv').textContent`));
    assert.deepEqual(dec.decisions.map((d) => [d.id, d.answer]), [['WF-003', 'yes'], ['FEAT-004', 'no'], ['Q-003', 'About 6']]);
    assert.deepEqual(checkDecisions(pkg, dec), []);
  } finally { page.close(); }
});

test('"review decisions" reopens
~~~~

In `plugins/business-analyst/skills/business-analyst/scripts/test/quality-gates.test.mjs`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~js
'scripts/lib/review-page.mjs', 'scripts/lib/scope-render.mjs'
~~~~

with

~~~~js
'scripts/lib/review-page.mjs', 'scripts/lib/review-apply.mjs', 'scripts/lib/scope-render.mjs'
~~~~

Append to the end of `plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs`:

~~~~js

const APPLY_CASES = [
  ['yes, no and an answer', () => [withQuestion(loadWorkflow().pkg), decisions([YES_WF3, NO_FEAT4, ANSWER_Q3])]],
  ['no on a workflow', () => [loadWorkflow().pkg, decisions([{ id: 'WF-003', answer: 'no' }])]],
  ['no on a whole system', () => {
    const pkg = loadWorkflow().pkg;
    pkg.systems[1].label = 'recommended';
    pkg.openQuestions[0].affects.push('SYS-002');
    return [pkg, decisions([{ id: 'SYS-002', answer: 'no', note: 'phase 2' }])];
  }],
  ['yes after no', () => [reviewed().pkg, decisions([{ ...NO_FEAT4, answer: 'yes' }])]],
  ['a refused paste', () => [loadWorkflow().pkg, { ...decisions([YES_WF3]), lead: 'other' }]],
];

for (const [name, make] of APPLY_CASES) {
  test(`review.py apply matches review.mjs: ${name}`, () => {
    const [pkg, dec] = make();
    const a = writePair(pkg, '');
    const b = writePair(pkg, '');
    for (const p of [a, b]) writeFileSync(`${p.jsonPath}.dec`, JSON.stringify(dec));
    const n = exec('node', [jsReview, 'apply', '--json', a.jsonPath, '--decisions', `${a.jsonPath}.dec`]);
    const p = exec('python3', [pyReview, 'apply', '--json', b.jsonPath, '--decisions', `${b.jsonPath}.dec`]);
    assert.deepEqual(p, n);
    assert.equal(readFileSync(b.jsonPath, 'utf8'), readFileSync(a.jsonPath, 'utf8'));
  });
}
~~~~

- [ ] **Step 2: Run them to see them fail**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/review-apply.test.mjs 2>&1 | tail -8`
Expected: FAIL — `Cannot find module …/lib/review-apply.mjs`.

- [ ] **Step 3: Write `review-apply.mjs` and the full CLI**

Write `plugins/business-analyst/skills/business-analyst/scripts/lib/review-apply.mjs` (whole file):

~~~~js
// The PO's pasted decisions → requirements.json (spec §3). Checks everything
// first; on any finding the caller writes nothing.
import { pageData } from './review-data.mjs';
import { moveOut, moveBack, entryOf, kindOf } from './left-out.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RANK = { system: 0, workflow: 1, feature: 2 };
const rank = (id) => (id.startsWith('Q-') ? 3 : RANK[kindOf(id)]);

// Chat can mangle a paste (curly quotes, a cut-off block): null, not a crash.
export function parseDecisions(text) {
  const fenced = text.match(/```json\s*\n([\s\S]*?)\n```/);
  try {
    return JSON.parse(fenced ? fenced[1] : text);
  } catch {
    return null;
  }
}

// After this batch, is the system left out? (its own answer wins over today's state)
function systemOut(pkg, byId, sys) {
  const d = byId.get(sys);
  return d ? d.answer === 'no' : Boolean(entryOf(pkg, sys));
}

function checkOne(d, ctx, out) {
  const card = ctx.cards.get(d.id);
  if (!card && !ctx.questions.has(d.id)) return out.push(`${d.id}: not on the review page`);
  if (card && !['yes', 'no'].includes(d.answer)) out.push(`${d.id}: answer must be yes or no`);
  if (!card && !String(d.answer ?? '').trim()) out.push(`${d.id}: answer is empty`);
  if (card && card.kind !== 'system' && systemOut(ctx.pkg, ctx.byId, card.system)) {
    out.push(`${d.id}: its system ${card.system} is left out`);
  }
}

export function checkDecisions(pkg, dec) {
  if (dec?.reviewDecisions !== 1) return ['decisions: not a review decisions block'];
  const out = [];
  if (dec.lead !== pkg.lead) out.push(`decisions: lead ${dec.lead} is not ${pkg.lead}`);
  if (!DATE.test(dec.date ?? '')) out.push('decisions: date must be YYYY-MM-DD');
  const data = pageData(pkg, dec.date);
  const ctx = {
    pkg, byId: new Map((dec.decisions ?? []).map((d) => [d.id, d])),
    cards: new Map(data.systems.flatMap((s) => s.cards).map((c) => [c.id, c])),
    questions: new Set(data.questions.map((q) => q.id)),
  };
  for (const d of dec.decisions ?? []) checkOne(d, ctx, out);
  return out;
}

const live = (pkg, id) => [...(pkg.systems ?? []), ...(pkg.workflows ?? []), ...(pkg.features ?? [])].find((r) => r.id === id);

function answerPaired(pkg, id, answer) {
  for (const q of pkg.openQuestions ?? []) {
    if ((q.affects ?? []).includes(id)) Object.assign(q, { status: 'answered', answer });
  }
}

// A second "no" only refreshes the note and date; item stays the last key.
function renote(e, note, date) {
  const { item } = e;
  delete e.item;
  delete e.note;
  e.date = date;
  if (note) e.note = note;
  e.item = item;
}

function decide(pkg, d, date) {
  const note = d.note ? { note: d.note } : {};
  if (d.answer === 'yes') {
    if (entryOf(pkg, d.id)) moveBack(pkg, d.id);
    const r = live(pkg, d.id);
    Object.assign(r, { label: 'confirmed', source: `confirmed by PO in review, ${date}`, review: { answer: 'yes', ...note, date } });
    return answerPaired(pkg, d.id, 'confirmed in review');
  }
  const prior = entryOf(pkg, d.id);
  if (prior) renote(prior, d.note, date);
  else {
    delete live(pkg, d.id).review;
    moveOut(pkg, d.id, { note: d.note, date });
  }
  answerPaired(pkg, d.id, `left out in review: ${d.note ?? 'no note'}`);
}

function answerQuestion(pkg, d, date) {
  const q = pkg.openQuestions.find((x) => x.id === d.id);
  Object.assign(q, { status: 'answered', answer: d.answer, review: { answer: d.answer, date } });
}

function report(d) {
  if (d.id.startsWith('Q-')) return [`${d.id} answered: "${d.answer}" — update what depends on it`];
  const lines = d.note ? [`${d.id} note: "${d.note}"`] : [];
  if (d.answer === 'no' && kindOf(d.id) === 'workflow') lines.push(`${d.id} left out — features that used its steps need a new place`);
  return lines;
}

export function applyDecisions(pkg, dec) {
  const next = structuredClone(pkg);
  const ordered = [...dec.decisions].sort((a, b) => rank(a.id) - rank(b.id));
  for (const d of ordered) (d.id.startsWith('Q-') ? answerQuestion : decide)(next, d, dec.date);
  const lines = [...dec.decisions.flatMap(report), `${dec.decisions.length} decided, ${dec.skipped.length} still open`];
  return { pkg: next, lines };
}
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/review.mjs` (whole file):

~~~~js
// The PO review page (spec §2–§3):
//   node review.mjs page  --json requirements.json --out review.html [--date YYYY-MM-DD]
//   node review.mjs apply --json requirements.json --decisions decisions.json
import { readFileSync, writeFileSync } from 'node:fs';
import { collectIds } from './lib/checks.mjs';
import { modeOf, scopeIds } from './lib/scope-rules.mjs';
import { checkScope } from './lib/scope-checks.mjs';
import { pageHtml } from './lib/review-page.mjs';
import { parseDecisions, checkDecisions, applyDecisions } from './lib/review-apply.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const pad = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function fail(findings) {
  console.error(findings.join('\n'));
  process.exit(1);
}

function page(pkg, args) {
  if (modeOf(pkg) === 'classic') return console.log('classic mode: no review page');
  const findings = checkScope(pkg, new Set([...collectIds(pkg), ...scopeIds(pkg)]));
  if (findings.length) fail(findings);
  writeFileSync(args.out, pageHtml(pkg, args.date ?? today()));
  console.log(`review page written: ${args.out}`);
}

function apply(pkg, args) {
  const dec = parseDecisions(readFileSync(args.decisions, 'utf8'));
  const findings = checkDecisions(pkg, dec);
  if (findings.length) fail(findings);
  const { pkg: next, lines } = applyDecisions(pkg, dec);
  writeFileSync(args.json, `${JSON.stringify(next, null, 2)}\n`);
  console.log(lines.join('\n'));
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (!['page', 'apply'].includes(cmd)) fail(['usage: review.mjs page|apply --json <requirements.json> …']);
(cmd === 'page' ? page : apply)(JSON.parse(readFileSync(args.json, 'utf8')), args);
~~~~

- [ ] **Step 4: Python twins**

Write `plugins/business-analyst/skills/business-analyst/scripts/review_apply.py` (whole file):

~~~~python
"""Pasted review decisions -> requirements.json; mirrors lib/review-apply.mjs (parity-tested)."""
import copy
import json
import re

from left_out import entry_of, kind_of, move_back, move_out
from review_data import page_data

DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
RANK = {'system': 0, 'workflow': 1, 'feature': 2}


def rank(rid):
    return 3 if rid.startswith('Q-') else RANK[kind_of(rid)]


def parse_decisions(text):
    fenced = re.search(r'```json\s*\n([\s\S]*?)\n```', text)
    try:
        return json.loads(fenced.group(1) if fenced else text)
    except ValueError:
        return None


def system_out(pkg, by_id, sys_):
    d = by_id.get(sys_)
    return d.get('answer') == 'no' if d else bool(entry_of(pkg, sys_))


def check_one(d, ctx, out):
    c = ctx['cards'].get(d['id'])
    if not c and d['id'] not in ctx['questions']:
        out.append(f"{d['id']}: not on the review page")
        return
    if c and d.get('answer') not in ('yes', 'no'):
        out.append(f"{d['id']}: answer must be yes or no")
    if not c and not str(d.get('answer') or '').strip():
        out.append(f"{d['id']}: answer is empty")
    if c and c['kind'] != 'system' and system_out(ctx['pkg'], ctx['by_id'], c['system']):
        out.append(f"{d['id']}: its system {c['system']} is left out")


def check_decisions(pkg, dec):
    if not isinstance(dec, dict) or dec.get('reviewDecisions') != 1:
        return ['decisions: not a review decisions block']
    out = []
    if dec.get('lead') != pkg.get('lead'):
        out.append(f"decisions: lead {dec.get('lead')} is not {pkg.get('lead')}")
    if not DATE.match(dec.get('date') or ''):
        out.append('decisions: date must be YYYY-MM-DD')
    data = page_data(pkg, dec.get('date'))
    ctx = {'pkg': pkg, 'by_id': {d['id']: d for d in dec.get('decisions') or []},
           'cards': {c['id']: c for s in data['systems'] for c in s['cards']},
           'questions': {q['id'] for q in data['questions']}}
    for d in dec.get('decisions') or []:
        check_one(d, ctx, out)
    return out


def live(pkg, rid):
    return next(r for r in (pkg.get('systems') or []) + (pkg.get('workflows') or []) + (pkg.get('features') or []) if r['id'] == rid)


def answer_paired(pkg, rid, answer):
    for q in pkg.get('openQuestions') or []:
        if rid in (q.get('affects') or []):
            q['status'] = 'answered'
            q['answer'] = answer


def renote(e, note, date):
    item = e.pop('item')
    e.pop('note', None)
    e['date'] = date
    if note:
        e['note'] = note
    e['item'] = item


def decide(pkg, d, date):
    note = d.get('note')
    if d['answer'] == 'yes':
        if entry_of(pkg, d['id']):
            move_back(pkg, d['id'])
        r = live(pkg, d['id'])
        r['label'] = 'confirmed'
        r['source'] = f'confirmed by PO in review, {date}'
        r['review'] = {'answer': 'yes', **({'note': note} if note else {}), 'date': date}
        answer_paired(pkg, d['id'], 'confirmed in review')
        return
    prior = entry_of(pkg, d['id'])
    if prior:
        renote(prior, note, date)
    else:
        live(pkg, d['id']).pop('review', None)
        move_out(pkg, d['id'], note, date)
    answer_paired(pkg, d['id'], f"left out in review: {note or 'no note'}")


def answer_question(pkg, d, date):
    q = next(x for x in pkg['openQuestions'] if x['id'] == d['id'])
    q['status'] = 'answered'
    q['answer'] = d['answer']
    q['review'] = {'answer': d['answer'], 'date': date}


def report(d):
    if d['id'].startswith('Q-'):
        return [f"{d['id']} answered: \"{d['answer']}\" — update what depends on it"]
    lines = [f"{d['id']} note: \"{d['note']}\""] if d.get('note') else []
    if d['answer'] == 'no' and kind_of(d['id']) == 'workflow':
        lines.append(f"{d['id']} left out — features that used its steps need a new place")
    return lines


def apply_decisions(pkg, dec):
    nxt = copy.deepcopy(pkg)
    for d in sorted(dec['decisions'], key=lambda x: rank(x['id'])):
        (answer_question if d['id'].startswith('Q-') else decide)(nxt, d, dec['date'])
    lines = [line for d in dec['decisions'] for line in report(d)]
    lines.append(f"{len(dec['decisions'])} decided, {len(dec['skipped'])} still open")
    return nxt, lines
~~~~

Write `plugins/business-analyst/skills/business-analyst/scripts/review.py` (whole file):

~~~~python
#!/usr/bin/env python3
"""Python port of review.mjs: the PO review page and applying its decisions.
Same flags, same bytes, same exit codes; kept in lockstep by
scripts/test/python-parity.test.mjs."""
import datetime
import json
import sys

from review_apply import apply_decisions, check_decisions, parse_decisions
from review_data import page_html
from scope_checks import check_scope, mode_of, scope_ids
from validate import collect_ids


def parse_args(argv):
    args, i = {}, 0
    while i < len(argv):
        if argv[i].startswith('--'):
            args[argv[i][2:]] = argv[i + 1]
            i += 1
        i += 1
    return args


def fail(findings):
    print('\n'.join(findings), file=sys.stderr)
    sys.exit(1)


def page(pkg, args):
    if mode_of(pkg) == 'classic':
        print('classic mode: no review page')
        return
    findings = check_scope(pkg, set(collect_ids(pkg)) | set(scope_ids(pkg)))
    if findings:
        fail(findings)
    with open(args['out'], 'w', encoding='utf-8', newline='') as f:
        f.write(page_html(pkg, args.get('date') or datetime.date.today().isoformat()))
    print(f"review page written: {args['out']}")


def apply(pkg, args):
    with open(args['decisions'], encoding='utf-8') as f:
        dec = parse_decisions(f.read())
    findings = check_decisions(pkg, dec)
    if findings:
        fail(findings)
    nxt, lines = apply_decisions(pkg, dec)
    with open(args['json'], 'w', encoding='utf-8', newline='') as f:
        f.write(json.dumps(nxt, indent=2, ensure_ascii=False) + '\n')
    print('\n'.join(lines))


def main(argv):
    cmd, args = (argv[0] if argv else None), parse_args(argv[1:])
    if cmd not in ('page', 'apply'):
        fail(['usage: review.mjs page|apply --json <requirements.json> …'])
    with open(args['json'], encoding='utf-8') as f:
        pkg = json.load(f)
    (page if cmd == 'page' else apply)(pkg, args)


if __name__ == '__main__':
    main(sys.argv[1:])
~~~~

- [ ] **Step 5: Run the BA suite**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`.

- [ ] **Step 6: Commit** (one command per call)

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/lib/review-apply.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/review_apply.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/review.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/review.py
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/review-apply.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/review-browser.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/quality-gates.test.mjs
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts/test/python-parity.test.mjs
/usr/bin/git commit -m "feat(business-analyst): apply pasted review decisions"
```

### Task 7: Flow docs, version 0.4.0, evals

**Files:**
- Modify: `plugins/business-analyst/skills/business-analyst/SKILL.md`
- Modify: `plugins/business-analyst/skills/business-analyst/references/interview.md` (§8 rewritten)
- Modify: `plugins/business-analyst/skills/business-analyst/references/writing.md`
- Modify: `plugins/business-analyst/skills/business-analyst/references/review.md`
- Modify: `plugins/business-analyst/skills/business-analyst/README.md`
- Modify: `plugins/business-analyst/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Create: `plugins/business-analyst/evals/ba-review-page/*`, `plugins/business-analyst/evals/ba-review-decisions/*`

**Interfaces:**
- Consumes: the `review page` / `review apply` commands (Tasks 5–6), JSON-only validate (Task 4).

- [ ] **Step 1: Docs: flow steps 7–11, the "review decisions" trigger, §8 rewritten, writing/review/README**

In `plugins/business-analyst/skills/business-analyst/SKILL.md`, 2 replacement(s), each matching exactly once:

(1) replace

~~~~markdown
   involves AI or agents → also work through `references/ai-extension.md`.
7. **Write**: requirements.md + requirements.json per
   `references/writing.md`. Workflow mode: then run
   `node scripts/scope.mjs --json <dir>/requirements.json --md <dir>/requirements.md`
   (no Node → `python3 scripts/scope.py`, same flags). It writes the To-be
   scope section; never edit that section by hand.
8. **Validate**: `node scripts/validate.mjs --json <dir>/requirements.json
   --md <dir>/requirements.md` — fix findings, re-run until clean. No Node
   in the environment (e.g. the claude.ai sandbox) → run
   `python3 scripts/validate.py` with the same flags; identical checks.
9. **Fresh-eyes review**: dispatch a subagent per `references/review.md`;
~~~~

with

~~~~markdown
   involves AI or agents → also work through `references/ai-extension.md`.
7. **Write**: requirements.json per `references/writing.md`. Classic
   mode: requirements.md too. Workflow mode: requirements.md waits for
   step 11, after the PO review.
8. **Validate**: `node scripts/validate.mjs --json <dir>/requirements.json`
   plus `--md <dir>/requirements.md` once the md exists — fix findings,
   re-run until clean. No Node in the environment (e.g. the claude.ai
   sandbox) → run `python3 scripts/validate.py` with the same flags;
   identical checks. The same holds for `scope` and `review` below.
9. **Fresh-eyes review**: dispatch a subagent per `references/review.md`;
~~~~

(2) replace

~~~~markdown
   (e.g. claude.ai) → run the checklist yourself and say so in Part 5.
10. **Human review**: workflow mode → first confirm the ⚠ drafts with the
    user (`references/interview.md` §8), then re-run `scope` and validate.
    Show Part 5 (readiness report); the human confirms the status. Only
    they can promote it to `READY_FOR_ARCHITECTURE`.
~~~~

with

~~~~markdown
   (e.g. claude.ai) → run the checklist yourself and say so in Part 5.
10. **PO review** (workflow mode): the review page,
    `references/interview.md` §8. Classic mode: go to step 11.
11. **Finish**: workflow mode → write requirements.md, run
    `node scripts/scope.mjs --json <dir>/requirements.json --md <dir>/requirements.md`
    (it writes the To-be scope section; never edit that section by hand),
    then validate with `--md`. Show Part 5 (readiness report); the human
    confirms the status. Only they can promote it to
    `READY_FOR_ARCHITECTURE`. Workflow mode: end with one line — say
    **review decisions** any time to change the PO's answers.

## Review decisions

The user says "review decisions" (any session) and the lead has a
workflow-mode `requirements.json` → re-run step 10 (the page opens with
the earlier answers filled in), then step 11. Nothing else is asked.
~~~~

In `plugins/business-analyst/skills/business-analyst/references/interview.md`, 4 replacement(s), each matching exactly once:

(1) replace

~~~~markdown

## §8 Confirm drafts (workflow mode)
~~~~

with

~~~~markdown

## §8 PO review page (workflow mode)
~~~~

(2) replace

~~~~markdown

After the fresh-eyes review, collect the ⚠ items: to-be workflows,
systems and features whose label is not `confirmed`. The user (PO or BA)
may confirm them for the client.
~~~~

with

~~~~markdown

After the fresh-eyes review the PO decides the drafts on a page: to-be
workflows, systems and features whose label is not `confirmed`, and the
open questions no draft answers. The page is business words only; never
put ids, FR text or scores in front of the PO.
~~~~

(3) replace

~~~~markdown

Ask through the question tool as tick boxes, grouped by system, at most 4
items per question, workflows before features. Each option is the item's
name plus one line saying why it is a draft (what it adds beyond the
input, or the assumed answer it rests on). No question tool → list one
group per turn in plain text.
~~~~

with

~~~~markdown

1. `node scripts/review.mjs page --json <dir>/requirements.json --out <dir>/review.html`.
2. Show it. claude.ai: as an artifact in this chat (if the file does not
   render by itself, create the artifact from its contents). Claude Code:
   give the path; it opens in any browser. Say in one line: answer what
   you can, skip the rest, then press **Copy decisions** and paste here.
3. Wait for the paste. Save it as is to `<dir>/review-decisions.txt`, then
   `node scripts/review.mjs apply --json <dir>/requirements.json --decisions <dir>/review-decisions.txt`.
   Exit 1 → show its lines and ask the user to copy again; never edit the
   JSON to make a paste fit.
4. Act on every printed line: a note → change that item as it says (one
   question if it is unclear); an answered question → update what depends
   on it (requirements, rules, readiness, status). Then say in two to four
   lines what you changed.
5. Validate. `uses left-out workflow` → ask one question: drop those
   features, or move them to other steps.
~~~~

(4) replace

~~~~markdown

- **Ticked** → label `confirmed`, source `confirmed by PO/BA in review,
  <date>`; its paired open question → `answered`, answer `confirmed in
  review`.
- **Unticked** → unchanged: ⚠ and the open question stay for the client.
- **Free text** ("Other") → apply the change, then ask that item again.

Never tick on the user's behalf. Then re-run `scope` and validate.
~~~~

with

~~~~markdown

"No" moves the item into `leftOut` (apply does it; never by hand).
Skipped items stay open for the client. Never answer for the user. The
user says skip or later → go to step 11 with every draft still open.
~~~~

In `plugins/business-analyst/skills/business-analyst/references/writing.md`, 2 replacement(s), each matching exactly once:

(1) replace

~~~~markdown
`mapLabel`, `systems`, `features`, and `label`/`source`/`steps`/`branches`
(`replaces`, `sub` optional) on to-be workflows.
~~~~

with

~~~~markdown
`mapLabel`, `systems`, `features`, and `label`/`source`/`steps`/`branches`
(`replaces`, `sub` optional) on to-be workflows. The PO review adds
`review` on decided items and questions, and `leftOut` for what the PO
declined; only `scripts/review.mjs apply` writes them. `systems`,
`features` and to-be workflows hold only what will be built — downstream
skills read them as is.
~~~~

(2) replace

~~~~markdown
  scope section written by `scripts/scope.mjs` replaces it (systems table,
  then per system its workflows as mermaid and a feature table; no ids;
  ⚠ on drafted items). Frontmatter gains `scopeMode: workflow`.
- **Part 3 — Requirements**: scope (out / future / unconfirmed — in-scope
~~~~

with

~~~~markdown
  scope section written by `scripts/scope.mjs` replaces it (systems table,
  then per system its workflows as mermaid and a feature table with ids
  and a Requirements column; a "Left out in review" table when the PO
  declined something). No ⚠ marks or "please confirm" banners: the PO
  decides on the review page, and the md is written after it. Frontmatter
  gains `scopeMode: workflow`.
- **Part 3 — Requirements**: scope (out / future / unconfirmed — in-scope
~~~~

In `plugins/business-analyst/skills/business-analyst/references/review.md`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~markdown
After validate.mjs passes, dispatch ONE subagent with fresh eyes over both
artifacts. Give it the two file paths and this checklist verbatim. Apply
its findings, re-run validate.mjs, and stop after one cycle — do not loop.
~~~~

with

~~~~markdown
After validate.mjs passes, dispatch ONE subagent with fresh eyes over both
artifacts (workflow mode: over requirements.json only — the md is written
after the PO review; read "Parts 1–4" as the JSON's context, workflows,
rules and requirements). Give it the two file paths and this checklist verbatim. Apply
its findings, re-run validate.mjs, and stop after one cycle — do not loop.
~~~~

In `plugins/business-analyst/skills/business-analyst/README.md`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~markdown
systems → to-be workflows → features for a proposal organised by system;
`scripts/scope.mjs` writes a To-be scope section (mermaid workflows and
feature tables, no ids) that the product owner reads, and estimate prices
those features.
~~~~

with

~~~~markdown
systems → to-be workflows → features for a proposal organised by system;
the product owner decides the drafts on a review page
(`scripts/review.mjs`, business words only, answers pasted back into
chat), then `scripts/scope.mjs` writes a To-be scope section (mermaid
workflows and feature tables with ids) for engineers, and estimate prices
those features.
~~~~

- [ ] **Step 2: Version 0.4.0 in both places**

In `plugins/business-analyst/.claude-plugin/plugin.json`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~json
"version": "0.3.7"
~~~~

with

~~~~json
"version": "0.4.0"
~~~~

In `.claude-plugin/marketplace.json`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~json
      "source": "./plugins/business-analyst",
      "description": "Business-analysis toolkit: interview-driven requirements discovery that turns raw client input into a validated, traceable requirements package ready for solution architecture.",
      "version": "0.3.7",
~~~~

with

~~~~json
      "source": "./plugins/business-analyst",
      "description": "Business-analysis toolkit: interview-driven requirements discovery that turns raw client input into a validated, traceable requirements package ready for solution architecture.",
      "version": "0.4.0",
~~~~

- [ ] **Step 3: Two plugin-level evals (the sandbox has no Bash, so graders check intent, not files)**

Write `plugins/business-analyst/evals/ba-review-page/case.yaml` (whole file):

~~~~yaml
schema_version: "1.1"
name: ba-review-page
context:
  scaffold_script: fixture.sh
~~~~

Write `plugins/business-analyst/evals/ba-review-page/fixture.sh` (whole file):

~~~~bash
#!/usr/bin/env bash
# Seeds the empty workspace as the sin-kowa-mini lead at the PO review step:
# requirements.json written, validated and fresh-eyes reviewed; no md yet.
set -euo pipefail
src="$(cd "$(dirname "$0")/../../skills/business-analyst/scripts/test/fixtures" && pwd)"
cp "$src/requirements-workflow-pass.json" requirements.json
~~~~

Write `plugins/business-analyst/evals/ba-review-page/prompt.md` (whole file):

~~~~markdown
---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion, TodoWrite]
---

Use the business-analyst skill. The sin-kowa-mini lead is in this folder:
requirements.json is written in workflow mode, validated and fresh-eyes
reviewed. Carry on from there — the PO is here with me now.
~~~~

Write `plugins/business-analyst/evals/ba-review-page/graders/skill-fired.md` (whole file):

~~~~markdown
---
type: tool_used
tool: Skill
min: 1
---

The skill must actually be invoked, not merely described.
~~~~

Write `plugins/business-analyst/evals/ba-review-page/graders/page-not-tickboxes.md` (whole file):

~~~~markdown
---
type: llm
focus: trace
---

The next step is the PO review page. This sandbox has no Bash, so the
agent may not be able to run scripts.

PASS if the agent runs `scripts/review.mjs page` (or `review.py page`), or
says it needs to run that command to build the review page and stops there
because it cannot run scripts.
FAIL if it asks the PO to confirm the draft items (Order to cash, Invoice
from packed quantities) as AskUserQuestion options or tick boxes, or lists
them in chat for a yes/no, or writes requirements.md before any review.
~~~~

Write `plugins/business-analyst/evals/ba-review-decisions/case.yaml` (whole file):

~~~~yaml
schema_version: "1.1"
name: ba-review-decisions
context:
  scaffold_script: fixture.sh
~~~~

Write `plugins/business-analyst/evals/ba-review-decisions/fixture.sh` (whole file):

~~~~bash
#!/usr/bin/env bash
# Seeds the empty workspace as a finished sin-kowa-mini workflow lead.
set -euo pipefail
src="$(cd "$(dirname "$0")/../../skills/business-analyst/scripts/test/fixtures" && pwd)"
cp "$src/requirements-workflow-pass.json" requirements.json
cp "$src/requirements-workflow-pass.md" requirements.md
~~~~

Write `plugins/business-analyst/evals/ba-review-decisions/prompt.md` (whole file):

~~~~markdown
---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion, TodoWrite]
---

/business-analyst review decisions
~~~~

Write `plugins/business-analyst/evals/ba-review-decisions/graders/skill-fired.md` (whole file):

~~~~markdown
---
type: tool_used
tool: Skill
min: 1
---

The skill must actually be invoked, not merely described.
~~~~

Write `plugins/business-analyst/evals/ba-review-decisions/graders/back-to-page.md` (whole file):

~~~~markdown
---
type: llm
focus: trace
---

"review decisions" reopens the PO review page for this lead. This sandbox
has no Bash, so the agent may not be able to run scripts.

PASS if the agent goes to the review page: runs `scripts/review.mjs page`
(or `review.py page`), or says it needs that command and stops because it
cannot run scripts.
FAIL if it restarts the interview, asks discovery or setup questions
(depth, scope mode), or asks the draft items as chat questions.
~~~~

Run: `chmod +x plugins/business-analyst/evals/ba-review-page/fixture.sh plugins/business-analyst/evals/ba-review-decisions/fixture.sh`

- [ ] **Step 4: Check the docs carry no leftovers of the tick-box flow**

Run: `! grep -rn 'tick box\|⚠ drafts\|Start here' plugins/business-analyst/skills/business-analyst/SKILL.md plugins/business-analyst/skills/business-analyst/references plugins/business-analyst/skills/business-analyst/README.md`
Expected: no output, exit 0.

- [ ] **Step 5: Full repo suite**

Run: `npm test 2>&1 | tail -8`
Expected: `ℹ fail 0`.

- [ ] **Step 6: Commit** (one command per call)

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/SKILL.md
/usr/bin/git add plugins/business-analyst/skills/business-analyst/references
/usr/bin/git add plugins/business-analyst/skills/business-analyst/README.md
/usr/bin/git add plugins/business-analyst/.claude-plugin/plugin.json
/usr/bin/git add .claude-plugin/marketplace.json
/usr/bin/git add plugins/business-analyst/evals
/usr/bin/git commit -m "docs(business-analyst): review page flow, evals, 0.4.0"
```

### Task 8: Verify, evals, review, report — then wait

- [ ] **Step 1: Full suite** — `npm test 2>&1 | tail -8` → `ℹ fail 0`. Say if browser tests skipped (no Chrome).
- [ ] **Step 2: Evals (two cases, about $0.10 each)** — `claude plugin eval plugins/business-analyst --case 'ba-review-*' --runs 1 --ablation none --no-publish --trust-plugin` (check `claude plugin eval --help` for the plugin path argument). Expected: both pass on the "names the command and stops" branch, because the sandbox has no Bash.
- [ ] **Step 3: Try it by hand** — `node plugins/business-analyst/skills/business-analyst/scripts/review.mjs page --json plugins/business-analyst/skills/business-analyst/scripts/test/fixtures/requirements-workflow-pass.json --out /tmp/review.html --date 2026-10-07`, open it in a browser, answer, press Copy decisions, save the clipboard to `/tmp/d.txt`, then on a copy of the fixture: `node plugins/business-analyst/skills/business-analyst/scripts/review.mjs apply --json /tmp/r.json --decisions /tmp/d.txt` and `node plugins/business-analyst/skills/business-analyst/scripts/validate.mjs --json /tmp/r.json`.
- [ ] **Step 4: Whole-branch review** (`superpowers:requesting-code-review`); fix findings in the worktree.
- [ ] **Step 5: Report and stop.** Commits, test counts (BA 119 → 210, repo total), eval scores, Task 1 answer, every divergence from this plan. Give the user the Step 3 commands. **Do not merge**: the user tests on claude.ai first and says when; then squash-merge into `feat/workflow-based-estimator` as `feat(business-analyst): PO review page, 0.4.0`.
