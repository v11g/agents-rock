# Proposal Workflow Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For a workflow-mode estimate, the proposal skill builds the Systems & Workflows proposal page (`dist/proposal.html`) straight from the BA package and the estimate, the agent writes only its sentences (`proposal-inputs.json`), and the page offers Download PDF and Download DOCX.

**Architecture:** Node renders the whole page body from one page-data object (`workflow-view.mjs`); the page script only draws the mermaid diagrams and builds the downloads. The DOCX is written in the browser by three pure ESM modules (`docx-xml`, `docx-body`, `docx-package`) plus the estimate's zip writer, moved to `estimate/shared/lib/zip.mjs` and inlined with `withZip()`; Node tests import the same modules. `validate.mjs` and `render.mjs` pick the workflow route from `estimation.inputs.scopeMode`; classic is untouched.

**Tech Stack:** Node ≥ 20 (`node:test`), plain HTML/JS, mermaid (the lead's existing bundle), headless Chrome via `analyze-requirements/scripts/lib/cdp.mjs`, LibreOffice (`soffice`, optional, for one round-trip test).

**Spec:** `docs/superpowers/specs/2026-10-07-proposal-workflow-design.md` (decisions P1–P8, checks W1–W6; read its "Deviations recorded during planning" section too).

**How this plan was checked:** every task below was replayed on a clean `git archive` of this branch at the spec commit: each "see them fail" run failed, each suite run passed, and the result was byte-identical to the prototype it came from. The prototype also ran with the real mermaid 11.16 bundle: no console errors, three diagrams drawn as SVG text (no HTML labels), three PNGs in the DOCX, and LibreOffice and python-docx both open the file. Code blocks are those files, byte for byte; edits are exact old/new pairs, each matching once. If a step does not behave as written, stop and report — do not improvise.

## Global Constraints

- All commands run from the repo (worktree) root. `P = plugins/solution-architect/skills/proposal`.
- New modules: ≤ 200 lines, ≤ 10 functions, ≤ 22 lines per function, ≤ 3 params (each skill's `quality-gates.test.mjs` checks them, `estimate/shared/lib` included). Template scripts: ≤ 22 lines per function, ≤ 3 params.
- Prices are USD only; nothing converts or relabels currency (P1).
- Nothing on the page or in the DOCX carries an ID, score, component, per-milestone price, rate or duration (P5).
- The docx modules and `zip.mjs` use single-line `import` statements only: the page inlines them with import lines stripped.
- Classic proposal behaviour and classic estimate behaviour are unchanged; their existing tests are the check.
- No plugin version bump (the series is released when `feat/workflow-based-estimator` merges).
- Never `git stash`; `/usr/bin/git`, one command per Bash call. Conventional Commits, no AI attribution lines of any kind.
- Known flake: `✖ opening a system switches the cards to that system` (estimate `workflow-based/scripts/test/browser.test.mjs`) fails intermittently at the base commit, and longer waits do not fix it. It is the only failure a run may show; report it, do not fix it here.

## Review Focus

1. `proposal-inputs.json` mangled (curly quotes from chat, cut off) → one-line finding, nothing rendered (test: `W6: … bad inputs JSON …`, Task 2).
2. A price slipped into a sentence in another spelling (`12k SGD`, `5,000 dollars`, `€300`) → refused (test: `W3: a price written in a sentence is refused, in any common spelling`, Task 2).
3. Markup or quotes in a BA name or sentence → shown as text, cannot close the data script (tests: `markup in a name is shown as text, never as HTML`, Task 3; `a name cannot close the data script tag`, Task 5).
4. A diagram that does not draw → the DOCX still builds and writes that workflow's steps instead (test: `drawn workflows become images; an undrawn one falls back to its steps`, Task 4).
5. The estimate edited after it was computed → validate and render refuse, nothing written (tests: `W6: a stale estimate …`, Task 2; `render refuses on a finding …`, Task 5).

---

### Task 1: Shared zip writer (estimate)

**Files:**
- Modify: `plugins/solution-architect/skills/estimate/classic/scripts/render.mjs`
- Create: `plugins/solution-architect/skills/estimate/classic/scripts/test/zip-store.test.mjs`
- Modify: `plugins/solution-architect/skills/estimate/shared/assets/xlsx-export.js`
- Modify: `plugins/solution-architect/skills/estimate/shared/lib/inline.mjs`
- Create: `plugins/solution-architect/skills/estimate/shared/lib/zip.mjs`
- Modify: `plugins/solution-architect/skills/estimate/workflow-based/scripts/render.mjs`

**Interfaces:**
- Produces: `shared/lib/zip.mjs` → `crc32(bytes: Uint8Array): number`, `zipStore(files: Map<string, Uint8Array>): Uint8Array` (stored entries, insertion order).
- Produces: `shared/lib/inline.mjs` → `withZip(src: string): string` — the zip writer, `export ` stripped, ahead of `src`.
- Consumes: `classic/scripts/test/zip.mjs` → `readZip(buf: Buffer): Map<string, Buffer>` (exists).

- [ ] **Step 1: Write the failing tests**

Write `plugins/solution-architect/skills/estimate/classic/scripts/test/zip-store.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore } from '../../../shared/lib/zip.mjs';
import { withZip } from '../../../shared/lib/inline.mjs';
import { readZip } from './zip.mjs';

const enc = new TextEncoder();

test('zipStore writes an archive the reader opens, entries in order', () => {
  const files = new Map([['a.txt', enc.encode('hello')], ['dir/b.xml', enc.encode('<x/>')]]);
  const back = readZip(Buffer.from(zipStore(files)));
  assert.deepEqual([...back.keys()], ['a.txt', 'dir/b.xml']);
  assert.equal(back.get('dir/b.xml').toString('utf8'), '<x/>');
});

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
});

test('withZip puts the writer, without export keywords, ahead of the page script', () => {
  const out = withZip('PAGE_SCRIPT();');
  assert.match(out, /^\/\/ Minimal zip writer/);
  assert.match(out, /\nfunction zipStore\(/);
  assert.doesNotMatch(out, /^export /m);
  assert.ok(out.endsWith('\nPAGE_SCRIPT();'));
});
~~~~

- [ ] **Step 2: Run them and see them fail**

Run: `node --test plugins/solution-architect/skills/estimate/classic/scripts/test/zip-store.test.mjs`
Expected: FAIL — `Cannot find module …/shared/lib/zip.mjs`.

- [ ] **Step 3: Write the code**

In `plugins/solution-architect/skills/estimate/classic/scripts/render.mjs`, 2 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { stripInternal } from '../../shared/lib/inline.mjs';
~~~~

with

~~~~js
import { stripInternal, withZip } from '../../shared/lib/inline.mjs';
~~~~

(2) replace

~~~~js
    ...(isAgentic ? {} : { GUIDE: guideTableHtml(loadGuide()), XLSX: readFileSync(xlsxExportPath, 'utf8') }),
~~~~

with

~~~~js
    ...(isAgentic ? {} : { GUIDE: guideTableHtml(loadGuide()), XLSX: withZip(readFileSync(xlsxExportPath, 'utf8')) }),
~~~~

In `plugins/solution-architect/skills/estimate/shared/assets/xlsx-export.js`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~js
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// entry: { name: Uint8Array, data: Uint8Array, crc, offset }
function zipHeader(entry, central) {
  const b = new Uint8Array(central ? 46 : 30);
  const v = new DataView(b.buffer);
  v.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
  const at = central ? 6 : 4; // version-needed field; central adds version-made-by first
  v.setUint16(at, 20, true);
  v.setUint32(at + 10, entry.crc, true);
  v.setUint32(at + 14, entry.data.length, true);
  v.setUint32(at + 18, entry.data.length, true);
  v.setUint16(at + 22, entry.name.length, true);
  if (central) v.setUint32(42, entry.offset, true);
  return b;
}
function zipEnd(count, cdSize, cdStart) {
  const b = new Uint8Array(22);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, cdSize, true);
  v.setUint32(16, cdStart, true);
  return b;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const centrals = [];
  let offset = 0;
  for (const [path, data] of files) {
    const entry = { name: enc.encode(path), data, crc: crc32(data), offset };
    chunks.push(zipHeader(entry, false), entry.name, data);
    centrals.push(zipHeader(entry, true), entry.name);
    offset += 30 + entry.name.length + data.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const all = [...chunks, ...centrals, zipEnd(files.size, cdSize, offset)];
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
  all.reduce((at, b) => (out.set(b, at), at + b.length), 0);
  return out;
}
~~~~

with

~~~~js
// crc32 and zipStore come from shared/lib/zip.mjs, inlined ahead of this script.
~~~~

In `plugins/solution-architect/skills/estimate/shared/lib/inline.mjs`, 2 replacement(s), each matching exactly once:

(1) replace

~~~~js
// so the extraction is by name, never the whole module.
export function inlineModule(src) {
~~~~

with

~~~~js
// so the extraction is by name, never the whole module.
import { readFileSync } from 'node:fs';

export function inlineModule(src) {
~~~~

(2) replace

~~~~js
  return src.replaceAll(/^export /gm, '');
}
~~~~

with

~~~~js
  return src.replaceAll(/^export /gm, '');
}

// A page script that builds a zip (the xlsx export, the proposal's docx) gets
// the shared writer inlined ahead of it, so the writer exists once.
export function withZip(src) {
  return `${inlineModule(readFileSync(new URL('./zip.mjs', import.meta.url), 'utf8'))}\n${src}`;
}
~~~~

Write `plugins/solution-architect/skills/estimate/shared/lib/zip.mjs` (whole file):

~~~~js
// Minimal zip writer: stored (uncompressed) entries, which every zip reader
// accepts. Written once as ESM and shipped twice: imported by Node tests, and
// inlined ahead of the page scripts that build a file (the estimate's xlsx
// export, the proposal's docx) through withZip() in inline.mjs.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// entry: { name: Uint8Array, data: Uint8Array, crc, offset }
function zipHeader(entry, central) {
  const b = new Uint8Array(central ? 46 : 30);
  const v = new DataView(b.buffer);
  v.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
  const at = central ? 6 : 4; // version-needed field; central adds version-made-by first
  v.setUint16(at, 20, true);
  v.setUint32(at + 10, entry.crc, true);
  v.setUint32(at + 14, entry.data.length, true);
  v.setUint32(at + 18, entry.data.length, true);
  v.setUint16(at + 22, entry.name.length, true);
  if (central) v.setUint32(42, entry.offset, true);
  return b;
}
function zipEnd(count, cdSize, cdStart) {
  const b = new Uint8Array(22);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, cdSize, true);
  v.setUint32(16, cdStart, true);
  return b;
}
export function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const centrals = [];
  let offset = 0;
  for (const [path, data] of files) {
    const entry = { name: enc.encode(path), data, crc: crc32(data), offset };
    chunks.push(zipHeader(entry, false), entry.name, data);
    centrals.push(zipHeader(entry, true), entry.name);
    offset += 30 + entry.name.length + data.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const all = [...chunks, ...centrals, zipEnd(files.size, cdSize, offset)];
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
  all.reduce((at, b) => (out.set(b, at), at + b.length), 0);
  return out;
}
~~~~

In `plugins/solution-architect/skills/estimate/workflow-based/scripts/render.mjs`, 2 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { loadGuide } from '../../shared/lib/scoring.mjs';
~~~~

with

~~~~js
import { loadGuide } from '../../shared/lib/scoring.mjs';
import { withZip } from '../../shared/lib/inline.mjs';
~~~~

(2) replace

~~~~js
  mathSrc: asset('../../shared/lib/pricing.mjs'), xlsxSrc: asset('../../shared/assets/xlsx-export.js'),
~~~~

with

~~~~js
  mathSrc: asset('../../shared/lib/pricing.mjs'), xlsxSrc: withZip(asset('../../shared/assets/xlsx-export.js')),
~~~~

- [ ] **Step 4: Run the suite and see it pass**

Run: `node --test plugins/solution-architect/skills/estimate/classic/scripts/test/*.test.mjs plugins/solution-architect/skills/estimate/workflow-based/scripts/test/*.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)|^✖ [a-z]" | sort -u`
Expected: `ℹ fail 0`, or `ℹ fail 1` where the one failure is `✖ opening a system switches the cards to that system` (estimate `workflow-based/scripts/test/browser.test.mjs`). That case already fails intermittently at the base commit, with or without this change, and longer waits do not fix it; it is reported separately, not fixed here. Any other failure is real. The classic xlsx export and browser tests are the behaviour check for the move.

- [ ] **Step 5: Commit** (one command per call)

```bash
/usr/bin/git add plugins/solution-architect/skills/estimate/classic/scripts/render.mjs
/usr/bin/git add plugins/solution-architect/skills/estimate/classic/scripts/test/zip-store.test.mjs
/usr/bin/git add plugins/solution-architect/skills/estimate/shared/assets/xlsx-export.js
/usr/bin/git add plugins/solution-architect/skills/estimate/shared/lib/inline.mjs
/usr/bin/git add plugins/solution-architect/skills/estimate/shared/lib/zip.mjs
/usr/bin/git add plugins/solution-architect/skills/estimate/workflow-based/scripts/render.mjs
/usr/bin/git commit -m "refactor(estimate): share the zip writer for page downloads"
```

### Task 2: Workflow lead loading and sentence checks (proposal)

**Files:**
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/workflow-checks.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/workflow-lead.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/fixtures/proposal-inputs-pass.json`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/workflow-checks.test.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/workflow-stage.mjs`

**Interfaces:**
- Consumes: estimate `workflow-based/scripts/lib/requirements.mjs` → `resolveRequirementsPath(path, inputs)`, `loadRequirements(path)` → `{ raw, mapLabel, features, systems, systemById, workflows }`; `pair-findings.mjs` → `pairFindings(inputs, req, jsonPath): string[]`; `page-view.mjs` → `milestoneView(est)` → `[{ name, title, features: [{ id, name, system }], … }]`; proposal `figures.mjs` → `deriveFigures(est)` (throws when unpriced).
- Consumes: estimate `workflow-based/scripts/test/stage.mjs` → `staged(): string` (temp lead dir with estimation-inputs.json, requirements.json, estimation.json).
- Produces: `lib/workflow-lead.mjs` → `isWorkflow(estimation): boolean`; `loadLead(estimationPath)` → `{ est, req, findings }`; `loadInputs(path)` → `{ inputs, findings }`; `proposalFindings({ estimation, inputs })` (both paths) → `{ findings, est, req, inputs }`.
- Produces: `lib/workflow-checks.mjs` → `checkProposalInputs({ inputs, est, req }): string[]`; `sentences(inputs): [where, text][]`.
- Produces: `test/workflow-stage.mjs` → `lead(edit?)` → `{ dir, estimation, inputs }` (paths); `passInputs()` → the fixture object.

- [ ] **Step 1: Write the failing tests**

Write `plugins/solution-architect/skills/proposal/scripts/test/fixtures/proposal-inputs-pass.json` (whole file):

~~~~json
{
  "client": "Sin Kowa",
  "title": "Sin Kowa Digital Transformation",
  "firm": "Code Engine Studio",
  "date": "2026-10-07",
  "techLevel": "non-tech",
  "jargonAllow": [],
  "scopeIntro": "This proposal covers two systems for Phase 1: warehouse operations, and orders and invoicing. Each is described below by its workflows and the features that serve them.",
  "systems": {
    "SYS-002": "It closes the paper delivery-order gap that delays cash collection by weeks."
  },
  "milestones": {
    "M1 - Walking skeleton": { "name": "Digitise core records", "demonstrates": "Orders move through each stage on screen instead of on paper." },
    "M2 - Money": { "name": "Connect the workflow", "demonstrates": "Short-packs are flagged as they happen, and each person sees only their own work." },
    "M3 - Operations": { "name": "Invoice from the floor", "demonstrates": "Invoices are raised from what was actually packed." }
  }
}
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/test/workflow-checks.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { loadLead, proposalFindings, isWorkflow } from '../lib/workflow-lead.mjs';
import { checkProposalInputs } from '../lib/workflow-checks.mjs';
import { lead, passInputs } from './workflow-stage.mjs';

const staged = lead();
const { est, req } = loadLead(staged.estimation);
const check = (edit) => { const inputs = passInputs(); edit(inputs); return checkProposalInputs({ inputs, est, req }); };

test('the sin-kowa-mini lead and its sentences pass', () => {
  assert.equal(isWorkflow(est), true);
  assert.deepEqual(proposalFindings(staged).findings, []);
});

test('W1: client, title, firm, scope intro, ISO date and tech level are required', () => {
  const out = check((i) => { delete i.firm; i.scopeIntro = ' '; i.date = '7 Oct 2026'; i.techLevel = 'expert'; });
  assert.deepEqual(out, [
    'proposal-inputs.json: missing "firm"',
    'proposal-inputs.json: missing "scopeIntro"',
    'proposal-inputs.json: "date" must be an ISO date (YYYY-MM-DD)',
    'proposal-inputs.json: "techLevel" must be non-tech | low-tech | technical',
  ]);
});

test('W2: every milestone the features use needs a name and what it demonstrates; no unknown keys', () => {
  const out = check((i) => {
    delete i.milestones['M2 - Money'].demonstrates;
    i.milestones['M9 - Later'] = { name: 'x', demonstrates: 'y' };
    i.systems['SYS-404'] = 'nothing';
    i.systems['SYS-001'] = '';
  });
  assert.deepEqual(out, [
    'milestone "M2 - Money": needs a client "name" and "demonstrates"',
    'milestones: "M9 - Later" is not a milestone of this estimate',
    'systems: "SYS-404" is not a system in requirements.json',
    'systems: "SYS-001" needs a sentence or no entry',
  ]);
});

test('W3: a price written in a sentence is refused, in any common spelling', () => {
  for (const said of ['$40k', 'USD 5,000', 'SGD150,000', '5,000 dollars', '12k SGD', '€300']) {
    const out = check((i) => { i.scopeIntro = `Phase 1 costs about ${said} in total.`; });
    assert.equal(out.length, 1, said);
    assert.match(out[0], /^scopeIntro: price ".+" — prices come only from the estimate$/, said);
  }
  assert.deepEqual(check((i) => { i.scopeIntro = 'It covers 2 systems and 5 features in 3 milestones.'; }), []);
});

test('W4: an internal ID in a sentence is refused', () => {
  const out = check((i) => { i.milestones['M1 - Walking skeleton'].demonstrates = 'FEAT-001 works end to end.'; });
  assert.deepEqual(out, ['milestones.M1 - Walking skeleton.demonstrates: internal ID "FEAT-001" — name the thing in words']);
});

test('W5: jargon is refused for a non-tech client, allowed when listed or for a technical one', () => {
  const said = (i) => { i.systems['SYS-002'] = 'A backend checks every order.'; };
  assert.deepEqual(check(said), ['systems.SYS-002: jargon for a non-tech client: "backend" (rewrite plainly or add to jargonAllow)']);
  assert.deepEqual(check((i) => { said(i); i.jargonAllow = ['Backend']; }), []);
  assert.deepEqual(check((i) => { said(i); i.techLevel = 'technical'; }), []);
});

test('W6: a stale estimate, a missing BA package or bad inputs JSON stop before the sentences', () => {
  const stale = lead();
  const e = JSON.parse(readFileSync(stale.estimation, 'utf8'));
  e.computed.features['FEAT-001'].point += 1;
  writeFileSync(stale.estimation, JSON.stringify(e));
  assert.match(proposalFindings(stale).findings.join('\n'), /computed block differs/);
  const noReq = lead();
  unlinkSync(join(noReq.dir, 'requirements.json'));
  assert.match(proposalFindings(noReq).findings[0], /^requirements\.json not found/);
  const bad = lead();
  writeFileSync(bad.inputs, '{ “client”: "Sin Kowa" }');
  const { findings } = proposalFindings(bad);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /^proposal-inputs\.json: /);
});
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/test/workflow-stage.mjs` (whole file):

~~~~js
// A computed sin-kowa-mini lead (the estimate's own workflow test lead) plus
// the proposal's sentences, in a temp folder.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { staged } from '../../../estimate/workflow-based/scripts/test/stage.mjs';

export const passInputs = () => JSON.parse(readFileSync(new URL('./fixtures/proposal-inputs-pass.json', import.meta.url), 'utf8'));

export function lead(edit) {
  const dir = staged();
  const inputs = passInputs();
  if (edit) edit(inputs);
  writeFileSync(join(dir, 'proposal-inputs.json'), JSON.stringify(inputs));
  return { dir, estimation: join(dir, 'estimation.json'), inputs: join(dir, 'proposal-inputs.json') };
}
~~~~

- [ ] **Step 2: Run them and see them fail**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/workflow-checks.test.mjs`
Expected: FAIL — `Cannot find module …/lib/workflow-lead.mjs`.

- [ ] **Step 3: Write the code**

Write `plugins/solution-architect/skills/proposal/scripts/lib/workflow-checks.mjs` (whole file):

~~~~js
// The facts on a workflow proposal page are rendered from data; what the
// agent writes is sentences (proposal-inputs.json). These checks hold the
// sentences to the client rules: complete, no prices (the price comes only
// from the estimate), no internal IDs, no jargon for a non-tech reader.
import { milestoneView } from '../../../estimate/workflow-based/scripts/lib/page-view.mjs';
import { JARGON } from './jargon.mjs';
import { escapeRegExp } from './sections.mjs';

const TECH_LEVELS = ['non-tech', 'low-tech', 'technical'];
const CODES = 'USD|SGD|EUR|GBP|AUD';
const MONEY = new RegExp(`[$€£]\\s?\\d[\\d,.]*[kKmM]?|\\b(?:${CODES})\\s?\\d[\\d,.]*[kKmM]?|\\d[\\d,.]*\\s?[kKmM]?\\s?(?:${CODES}|dollars?)\\b`);
const ID = /\b(?:FEAT|FR|NFR|SYS|WF|BR|ASM|INT|SC|Q)-\d+/;
const filled = (v) => typeof v === 'string' && v.trim() !== '';

function checkRequired(inputs, out) {
  for (const key of ['client', 'title', 'firm', 'scopeIntro']) {
    if (!filled(inputs[key])) out.push(`proposal-inputs.json: missing "${key}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inputs.date ?? '') || Number.isNaN(Date.parse(inputs.date))) {
    out.push('proposal-inputs.json: "date" must be an ISO date (YYYY-MM-DD)');
  }
  if (!TECH_LEVELS.includes(inputs.techLevel)) out.push(`proposal-inputs.json: "techLevel" must be ${TECH_LEVELS.join(' | ')}`);
}

function checkKeys({ inputs, est, req }, out) {
  const used = milestoneView(est).map((m) => m.name);
  const ms = inputs.milestones ?? {};
  for (const name of used) {
    if (!filled(ms[name]?.name) || !filled(ms[name]?.demonstrates)) out.push(`milestone "${name}": needs a client "name" and "demonstrates"`);
  }
  for (const key of Object.keys(ms)) if (!used.includes(key)) out.push(`milestones: "${key}" is not a milestone of this estimate`);
  for (const [key, text] of Object.entries(inputs.systems ?? {})) {
    if (!req.systemById[key]) out.push(`systems: "${key}" is not a system in requirements.json`);
    else if (!filled(text)) out.push(`systems: "${key}" needs a sentence or no entry`);
  }
}

export function sentences(inputs) {
  const out = [['scopeIntro', inputs.scopeIntro]];
  for (const [id, text] of Object.entries(inputs.systems ?? {})) out.push([`systems.${id}`, text]);
  for (const [id, m] of Object.entries(inputs.milestones ?? {})) {
    out.push([`milestones.${id}.name`, m?.name], [`milestones.${id}.demonstrates`, m?.demonstrates]);
  }
  return out.filter(([, text]) => filled(text));
}

const jargonIn = (text, allow) => JARGON.filter((t) => !allow.has(t)
  && new RegExp(`(?<![\\w/])${escapeRegExp(t)}(?:e?s)?(?![\\w/])`, 'i').test(text));

function checkSentences(inputs, out) {
  const allow = new Set((Array.isArray(inputs.jargonAllow) ? inputs.jargonAllow : []).map((w) => String(w).toLowerCase()));
  for (const [where, text] of sentences(inputs)) {
    const money = MONEY.exec(text);
    if (money) out.push(`${where}: price "${money[0]}" — prices come only from the estimate`);
    const id = ID.exec(text);
    if (id) out.push(`${where}: internal ID "${id[0]}" — name the thing in words`);
    if (inputs.techLevel !== 'non-tech') continue;
    for (const term of jargonIn(text, allow)) out.push(`${where}: jargon for a non-tech client: "${term}" (rewrite plainly or add to jargonAllow)`);
  }
}

export function checkProposalInputs({ inputs, est, req }) {
  const out = [];
  checkRequired(inputs, out);
  checkKeys({ inputs, est, req }, out);
  checkSentences(inputs, out);
  return out;
}
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/lib/workflow-lead.mjs` (whole file):

~~~~js
// A workflow-mode proposal reads what the estimate already validated:
// estimation.json and the BA package it names. Loading re-runs the
// estimate's own validation, so a stale or hand-edited estimate never
// reaches a client page (spec 4 W6). Modules stay single-line-import: the
// page inlines some of them with their import lines stripped.
import { existsSync, readFileSync } from 'node:fs';
import { resolveRequirementsPath, loadRequirements } from '../../../estimate/workflow-based/scripts/lib/requirements.mjs';
import { pairFindings } from '../../../estimate/workflow-based/scripts/lib/pair-findings.mjs';
import { deriveFigures } from './figures.mjs';
import { checkProposalInputs } from './workflow-checks.mjs';

export const isWorkflow = (estimation) => estimation.inputs?.scopeMode === 'workflow';

function quotable(est) {
  try { deriveFigures(est); return []; } catch (e) { return [`cannot quote this estimate: ${e.message}`]; }
}

export function loadLead(estimationPath) {
  const est = JSON.parse(readFileSync(estimationPath, 'utf8'));
  const reqPath = resolveRequirementsPath(estimationPath, est.inputs);
  if (!reqPath || !existsSync(reqPath)) {
    return { est, req: null, findings: [`requirements.json not found (estimation.json names "${est.inputs.requirements}") — run the estimate skill in the lead folder`] };
  }
  const req = loadRequirements(reqPath);
  const findings = req.raw.scopeMode === 'workflow' ? [] : ['requirements.json is not in workflow scope mode'];
  findings.push(...pairFindings(est.inputs, req, estimationPath), ...quotable(est));
  return { est, req, findings };
}

export function loadInputs(path) {
  try {
    return { inputs: JSON.parse(readFileSync(path, 'utf8')), findings: [] };
  } catch (e) {
    return { inputs: null, findings: [`proposal-inputs.json: ${e.message}`] };
  }
}

// The lead first: the sentence checks need a valid estimate to know its milestones.
export function proposalFindings({ estimation, inputs }) {
  const lead = loadLead(estimation);
  const sent = loadInputs(inputs);
  const findings = [...lead.findings, ...sent.findings];
  if (!findings.length) findings.push(...checkProposalInputs({ inputs: sent.inputs, est: lead.est, req: lead.req }));
  return { findings, est: lead.est, req: lead.req, inputs: sent.inputs };
}
~~~~

- [ ] **Step 4: Run the suite and see it pass**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0` (quality gates include the two new modules).

- [ ] **Step 5: Commit** (one command per call)

```bash
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/workflow-checks.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/workflow-lead.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/fixtures/proposal-inputs-pass.json
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/workflow-checks.test.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/workflow-stage.mjs
/usr/bin/git commit -m "feat(proposal): workflow-mode inputs checks"
```

### Task 3: Page data and HTML body (proposal)

**Files:**
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/workflow-html.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/workflow-view.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/workflow-view.test.mjs`

**Interfaces:**
- Consumes: Task 2 `loadLead`, `lead`, `passInputs`; estimate `page-view.mjs` → `milestoneView(est)`, `registerView(est, req)` → `{ assumptions: string[], exclusions: string[] }`; proposal `figures.mjs` → `formatMoney(n)`; analyze-requirements `md-render.mjs` → `escapeHtml`.
- Produces: `lib/workflow-view.mjs` → `proposalView({ est, req, inputs })` → `{ client, title, byline, file, scope: { intro, mapLabel, systems: [{ name, map }], outLine }, systems: [{ anchor, no, name, purpose, extra, flows: [{ label, code, steps }], features: [{ name, does }] }], milestones: { lead, rows: [{ title, includes, demonstrates }] }, register: { lead, assumptions, exclusions }, cost: { lead, range, rangeNote, single, singleNote } }`; `flowCode({ steps, branches }): string` (mermaid).
- Produces: `lib/workflow-html.mjs` → `contentHtml(view): string`, `navHtml(view): string`.

- [ ] **Step 1: Write the failing tests**

Write `plugins/solution-architect/skills/proposal/scripts/test/workflow-view.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLead } from '../lib/workflow-lead.mjs';
import { proposalView, flowCode } from '../lib/workflow-view.mjs';
import { contentHtml, navHtml } from '../lib/workflow-html.mjs';
import { lead, passInputs } from './workflow-stage.mjs';

const { est, req } = loadLead(lead().estimation);
const view = (edit) => { const inputs = passInputs(); if (edit) edit(inputs); return proposalView({ est, req, inputs }); };
const ID = /\b(?:FEAT|FR|NFR|SYS|WF|BR|ASM|INT|SC|Q)-\d+|\bM\d+ - /;

test('systems in BA order, with purpose, the agent sentence, flows and features in words', () => {
  const v = view();
  assert.deepEqual(v.systems.map((s) => [s.no, s.name, s.extra !== '']), [[1, 'Warehouse operations', false], [2, 'Orders & invoicing', true]]);
  assert.deepEqual(v.systems[1].flows.map((f) => f.label), ['Main workflow · Order to cash', 'Sub-workflow · Custom order']);
  assert.equal(v.systems[1].flows[1].steps, 'Flag as custom → Vendor PO → Receive into stock');
  assert.deepEqual(v.systems[0].features[1], { name: 'Short-pack alert', does: 'Flags an item that cannot be packed, in time to buy or cancel' });
});

test('milestones carry client names, numbered, with the features each one finishes', () => {
  const { milestones } = view();
  assert.deepEqual(milestones.rows.map((m) => m.title), ['1. Digitise core records', '2. Connect the workflow', '3. Invoice from the floor']);
  assert.equal(milestones.rows[0].includes, 'Order pipeline & stage engine and Order intake & quotation');
  assert.match(milestones.lead, /^The 5 features sequence into 3 milestones;/);
});

test('register, cost and byline come from the estimate and the inputs', () => {
  const v = view();
  assert.deepEqual(v.register.exclusions, ['last-mile delivery tracking', 'Hosting and third-party subscription fees']);
  assert.equal(v.register.assumptions[0], 'InvoiceNow is a data model only, with no live connection');
  assert.equal(v.cost.range, '$39,000 – $48,500');
  assert.equal(v.cost.single, '$44,000');
  assert.equal(v.byline, 'Oct 7, 2026 · Code Engine Studio');
  assert.equal(v.file, 'sin-kowa-proposal.docx');
  assert.match(v.scope.outLine, /^Explicitly excluded: last-mile delivery tracking\./);
});

test('nothing on the page carries an internal ID or engineer milestone name', () => {
  const v = view();
  assert.doesNotMatch(JSON.stringify(v), ID);
  assert.doesNotMatch(contentHtml(v) + navHtml(v), ID);
});

test('flow code quotes labels, keeps branch labels and survives a quote in a name', () => {
  const code = flowCode({ steps: ['Say "hi"', 'Pack'], branches: [{ from: 'Pack', to: 'Say "hi"', label: 'redo' }] });
  assert.equal(code, 'flowchart LR\n  n0 --> n1\n  n1 -.->|"redo"| n0\n  n0["Say \'hi\'"]\n  n1["Pack"]');
});

test('markup in a name is shown as text, never as HTML', () => {
  const v = view();
  v.systems[0].features[0].name = '<img src=x onerror=alert(1)>';
  v.scope.intro = 'Fish & <b>chips</b>';
  const html = contentHtml(v);
  assert.doesNotMatch(html, /<img|<b>chips/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /Fish &amp; &lt;b&gt;chips&lt;\/b&gt;/);
});

test('without a map label the scope table has one column', () => {
  const v = view();
  v.scope.mapLabel = null;
  assert.match(contentHtml(v), /<thead><tr><th>System<\/th><\/tr><\/thead>/);
});

test('the menu links every section in page order', () => {
  const links = [...navHtml(view()).matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ['scope', 'system-1', 'system-2', 'milestones', 'register', 'cost']);
});
~~~~

- [ ] **Step 2: Run them and see them fail**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/workflow-view.test.mjs`
Expected: FAIL — `Cannot find module …/lib/workflow-view.mjs`.

- [ ] **Step 3: Write the code**

Write `plugins/solution-architect/skills/proposal/scripts/lib/workflow-html.mjs` (whole file):

~~~~js
// The workflow proposal's body and menu, rendered in Node from the page data
// (workflow-view.mjs), so the page script only draws diagrams and builds the
// downloads. Every value goes through esc().
import { escapeHtml as esc } from '../../../analyze-requirements/scripts/lib/md-render.mjs';

const para = (text) => (text ? `<p>${esc(text)}</p>` : '');
const cells = (tag, row) => row.map((c) => `<${tag}>${esc(c)}</${tag}>`).join('');
const table = (head, rows) => `<table><thead><tr>${cells('th', head)}</tr></thead><tbody>${rows.map((r) => `<tr>${cells('td', r)}</tr>`).join('')}</tbody></table>`;
const bullets = (items) => `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
const flowHtml = (f) => `<p class="flow-name">${esc(f.label)}</p><div class="diagram-shell"><div class="mermaid-canvas">${esc(f.code)}</div></div>`;

function scopeHtml({ scope }) {
  const head = scope.mapLabel ? ['System', scope.mapLabel] : ['System'];
  const rows = scope.systems.map((s) => (scope.mapLabel ? [s.name, s.map] : [s.name]));
  return `<section id="scope"><h2>Scope: what this proposal covers</h2>${para(scope.intro)}${table(head, rows)}${para(scope.outLine)}</section>`;
}

function systemHtml(s) {
  const features = table(['Feature', 'What it does'], s.features.map((f) => [f.name, f.does]));
  return `<section id="${s.anchor}" class="system"><h2><span class="sysno">System ${s.no}:</span> ${esc(s.name)}</h2>${para(s.purpose)}${para(s.extra)}${s.flows.map(flowHtml).join('')}${features}</section>`;
}

function closingHtml({ milestones, register, cost }) {
  const ms = table(['Milestone', 'Includes', 'What it demonstrates'], milestones.rows.map((m) => [m.title, m.includes, m.demonstrates]));
  const price = (label, value, note) => `<div><span>${esc(label)}</span><b>${esc(value)}</b><span>${esc(note)}</span></div>`;
  return `<section id="milestones"><h2>Milestones</h2>${para(milestones.lead)}${ms}</section>`
    + `<section id="register"><h2>Assumptions &amp; exclusions</h2>${para(register.lead)}<h3>Assumptions</h3>${bullets(register.assumptions)}<h3>Exclusions</h3>${bullets(register.exclusions)}</section>`
    + `<section id="cost"><h2>Cost estimate</h2>${para(cost.lead)}<div class="price">${price('Range', cost.range, cost.rangeNote)}${price('If one fixed number is needed', cost.single, cost.singleNote)}</div></section>`;
}

export function contentHtml(view) {
  return `<h1>${esc(view.title)}</h1><p class="byline">${esc(view.byline)}</p>${scopeHtml(view)}${view.systems.map(systemHtml).join('')}${closingHtml(view)}`;
}

export function navHtml(view) {
  const links = [['scope', 'Scope'], ...view.systems.map((s) => [s.anchor, `System ${s.no}: ${s.name}`]),
    ['milestones', 'Milestones'], ['register', 'Assumptions & exclusions'], ['cost', 'Cost estimate']];
  return links.map(([id, text]) => `<a href="#${id}">${esc(text)}</a>`).join('\n');
}
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/lib/workflow-view.mjs` (whole file):

~~~~js
// Page data for the workflow proposal: the BA package's systems, workflows
// and features, the estimate's milestones, register and price, and the
// agent's sentences from proposal-inputs.json. The HTML and the DOCX both
// print this one object, so the two can never disagree. No ID, score,
// component or per-milestone price goes in (spec 4 P5).
import { milestoneView, registerView } from '../../../estimate/workflow-based/scripts/lib/page-view.mjs';
import { formatMoney } from './figures.mjs';

const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const label = (s) => s.replaceAll('"', "'");

// Mermaid source for one workflow: the steps in a row, each branch dashed
// with its label.
export function flowCode(w) {
  const ids = new Map();
  const id = (name) => ids.get(name) ?? ids.set(name, `n${ids.size}`).get(name);
  const lines = ['flowchart LR'];
  w.steps.forEach((step, i) => { if (i) lines.push(`  ${id(w.steps[i - 1])} --> ${id(step)}`); });
  for (const b of w.branches) lines.push(`  ${id(b.from)} -.->${b.label ? `|"${label(b.label)}"|` : ''} ${id(b.to)}`);
  for (const [name, n] of ids) lines.push(`  ${n}["${label(name)}"]`);
  return lines.join('\n');
}

function flowsOf(system, req) {
  return (system.workflows ?? []).map((wid, i) => {
    const w = req.workflows[wid];
    const flow = { steps: w.steps ?? [], branches: w.branches ?? [] };
    return { label: `${i ? 'Sub-workflow' : 'Main workflow'} · ${w.name}`, code: flowCode(flow), steps: flow.steps.join(' → ') };
  });
}

function systemView(system, i, { req, inputs }) {
  return {
    anchor: `system-${i + 1}`, no: i + 1, name: system.name, purpose: system.purpose ?? '', extra: inputs.systems?.[system.id] ?? '',
    flows: flowsOf(system, req),
    features: (system.features ?? []).map((fid) => ({ name: req.features[fid].name, does: req.features[fid].does ?? '' })),
  };
}

function scopeView({ req, inputs }) {
  const out = req.raw.scope?.out ?? [];
  return {
    intro: inputs.scopeIntro, mapLabel: req.mapLabel,
    systems: req.systems.map((s) => ({ name: s.name, map: s.map ?? '' })),
    outLine: out.length
      ? `Explicitly excluded: ${list(out)}. Every assumption and exclusion is listed at the end of this proposal.`
      : 'The assumptions and exclusions this proposal rests on are listed at the end.',
  };
}

function milestonesView(est, inputs) {
  const rows = milestoneView(est).map((m, i) => ({
    title: `${i + 1}. ${inputs.milestones[m.name].name}`,
    includes: list(m.features.map((f) => f.name)), demonstrates: inputs.milestones[m.name].demonstrates,
  }));
  return { lead: `The ${est.inputs.features.length} features sequence into ${rows.length} milestones; each one ends with something working you can see.`, rows };
}

function costView(est) {
  const { price } = est.computed;
  return {
    lead: `The estimate scores the work behind all ${est.inputs.features.length} features above and rolls it up into a project range, including design, testing, project management and contingency.`,
    range: `${formatMoney(price.presentLow)} – ${formatMoney(price.presentHigh)}`, rangeNote: 'expected cost to worst realistic case, USD',
    single: formatMoney(price.singleNumber), singleNote: 'confident figure: 80% chance the project comes in at or under',
  };
}

export function proposalView({ est, req, inputs }) {
  return {
    client: inputs.client, title: `${inputs.title} — Systems & Workflows Proposal`, byline: `${longDate(inputs.date)} · ${inputs.firm}`,
    file: `${slug(inputs.client)}-proposal.docx`,
    scope: scopeView({ req, inputs }),
    systems: req.systems.map((s, i) => systemView(s, i, { req, inputs })),
    milestones: milestonesView(est, inputs),
    register: { lead: 'These carry over from the estimate, so the price and the scope never drift apart.', ...registerView(est, req) },
    cost: costView(est),
  };
}
~~~~

- [ ] **Step 4: Run the suite and see it pass**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`.

- [ ] **Step 5: Commit** (one command per call)

```bash
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/workflow-html.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/workflow-view.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/workflow-view.test.mjs
/usr/bin/git commit -m "feat(proposal): systems and workflows page data"
```

### Task 4: DOCX writer (proposal)

**Files:**
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/docx-body.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/docx-package.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/docx-xml.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/docx.test.mjs`

**Interfaces:**
- Consumes: Task 1 `zipStore`; Task 3 `proposalView`.
- Produces: `lib/docx-package.mjs` → `buildDocx(view, images): Uint8Array`, where `images` has one entry per workflow in page order: `{ bytes: Uint8Array (PNG), width: px, height: px }` or `null` (the steps are written instead).
- The three docx modules use single-line imports only: Task 5 inlines them into the page with import lines stripped.

- [ ] **Step 1: Write the failing tests**

Write `plugins/solution-architect/skills/proposal/scripts/test/docx.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLead } from '../lib/workflow-lead.mjs';
import { proposalView } from '../lib/workflow-view.mjs';
import { buildDocx } from '../lib/docx-package.mjs';
import { readZip } from '../../../estimate/classic/scripts/test/zip.mjs';
import { lead, passInputs } from './workflow-stage.mjs';

const { est, req } = loadLead(lead().estimation);
const view = proposalView({ est, req, inputs: passInputs() });
// A real 1x1 PNG, standing in for a drawn diagram.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const drawn = { bytes: PNG, width: 1200, height: 300 };
// Three workflows in page order; the second one was not drawn.
const docx = () => readZip(Buffer.from(buildDocx(view, [drawn, null, drawn])));
const count = (xml, re) => (xml.match(re) ?? []).length;

test('the package has every part Word needs, and one PNG per drawn workflow', () => {
  const files = docx();
  assert.deepEqual([...files.keys()], ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels',
    'word/styles.xml', 'word/numbering.xml', 'word/media/image1.png', 'word/media/image3.png']);
  const rels = files.get('word/_rels/document.xml.rels').toString('utf8');
  assert.match(rels, /Id="rIdImg1"[^>]*Target="media\/image1\.png"/);
  assert.doesNotMatch(rels, /rIdImg2/);
});

test('document.xml follows the page: headings, tables, lists, in order', () => {
  const xml = docx().get('word/document.xml').toString('utf8');
  assert.equal(count(xml, /<w:pStyle w:val="Heading1"\/>/g), 6); // scope, 2 systems, milestones, register, cost
  assert.equal(count(xml, /<w:tbl>/g), 5); // scope, 2 feature tables, milestones, cost
  assert.equal(count(xml, /<w:numId w:val="1"\/>/g), 4); // 2 assumptions + 2 exclusions
  const order = ['Scope: what this proposal covers', 'System 1: Warehouse operations', 'System 2: Orders &amp; invoicing', 'Milestones', 'Cost estimate'];
  const at = order.map((h) => xml.indexOf(`<w:t xml:space="preserve">${h}</w:t>`));
  assert.ok(at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1])), JSON.stringify(at));
});

test('drawn workflows become images; an undrawn one falls back to its steps', () => {
  const xml = docx().get('word/document.xml').toString('utf8');
  assert.deepEqual([...xml.matchAll(/r:embed="(\w+)"/g)].map((m) => m[1]), ['rIdImg1', 'rIdImg3']);
  assert.match(xml, /Order received → Quote → Invoice → Paid/);
  const [, cx] = /<wp:extent cx="(\d+)"/.exec(xml);
  assert.equal(Number(cx), 9638 * 635); // 1200 px is wider than the page: scaled to the text width
});

test('the price, no IDs, no undefined, and text is escaped', () => {
  const xml = docx().get('word/document.xml').toString('utf8');
  assert.match(xml, /\$39,000 – \$48,500/);
  assert.doesNotMatch(xml, /undefined|\b(?:FEAT|FR|SYS|WF|ASM)-\d|M\d - /);
  const v = structuredClone(view);
  v.systems[0].features[0].name = 'A <b> & "c"\u0007';
  const odd = readZip(Buffer.from(buildDocx(v, [null, null, null]))).get('word/document.xml').toString('utf8');
  assert.match(odd, /A &lt;b&gt; &amp; "c"<\/w:t>/);
});

const soffice = spawnSync('soffice', ['--version']).status === 0;
test('LibreOffice opens the file and reads the text back', { skip: soffice ? false : 'no soffice on PATH' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-docx-'));
  writeFileSync(join(dir, 'p.docx'), buildDocx(view, [drawn, null, drawn]));
  execFileSync('soffice', ['--headless', `-env:UserInstallation=file://${dir}/lo`, '--convert-to', 'txt:Text', '--outdir', dir, join(dir, 'p.docx')], { stdio: 'ignore' });
  const text = readFileSync(join(dir, 'p.txt'), 'utf8');
  for (const s of ['Systems & Workflows Proposal', 'System 2: Orders & invoicing', 'Short-pack alert', 'Invoice from the floor', '$39,000 – $48,500']) {
    assert.ok(text.includes(s), s);
  }
});
~~~~

- [ ] **Step 2: Run them and see them fail**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/docx.test.mjs`
Expected: FAIL — `Cannot find module …/lib/docx-package.mjs`.

- [ ] **Step 3: Write the code**

Write `plugins/solution-architect/skills/proposal/scripts/lib/docx-body.mjs` (whole file):

~~~~js
// document.xml for the proposal: the same page data the HTML prints, in the
// same order, as Word headings, paragraphs, tables and lists. Diagrams are
// the page's drawn workflows as PNGs; a workflow with no image (the drawing
// failed) falls back to its steps written out.
import { para, bullets, table, image } from './docx-xml.mjs';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
  + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
const SECTION = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';

function scopeXml({ scope }) {
  const head = scope.mapLabel ? ['System', scope.mapLabel] : ['System'];
  const rows = scope.systems.map((s) => (scope.mapLabel ? [s.name, s.map] : [s.name]));
  return para('Scope: what this proposal covers', 'Heading1') + para(scope.intro) + table(head, rows) + para(scope.outLine);
}

function systemXml(s, { images, first }) {
  const flows = s.flows.map((f, i) => {
    const img = images[first + i];
    return para(f.label, 'Heading3') + (img ? image(img, first + i + 1) : para(f.steps));
  }).join('');
  return para(`System ${s.no}: ${s.name}`, 'Heading1') + para(s.purpose) + para(s.extra) + flows
    + table(['Feature', 'What it does'], s.features.map((f) => [f.name, f.does]));
}

function closingXml({ milestones, register, cost }) {
  return para('Milestones', 'Heading1') + para(milestones.lead)
    + table(['Milestone', 'Includes', 'What it demonstrates'], milestones.rows.map((m) => [m.title, m.includes, m.demonstrates]))
    + para('Assumptions & exclusions', 'Heading1') + para(register.lead)
    + para('Assumptions', 'Heading2') + bullets(register.assumptions) + para('Exclusions', 'Heading2') + bullets(register.exclusions)
    + para('Cost estimate', 'Heading1') + para(cost.lead)
    + table(['Range', 'If one fixed number is needed'], [[cost.range, cost.single], [cost.rangeNote, cost.singleNote]]);
}

// images[k] belongs to the k-th workflow in page order (null when not drawn).
export function documentXml(view, images) {
  const firsts = view.systems.map((_, i) => view.systems.slice(0, i).reduce((n, s) => n + s.flows.length, 0));
  const body = para(view.title, 'Title') + para(view.byline, 'Subtitle') + scopeXml(view)
    + view.systems.map((s, i) => systemXml(s, { images, first: firsts[i] })).join('') + closingXml(view);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body}${SECTION}</w:body></w:document>`;
}
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/lib/docx-package.mjs` (whole file):

~~~~js
// The DOCX package around document.xml: content types, relationships, the
// built-in styles the body uses, one bullet list, and the diagram PNGs.
// Standard Word styles only — the team restyles the copy they send.
import { zipStore } from '../../../estimate/shared/lib/zip.mjs';
import { documentXml } from './docx-body.mjs';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml';

const CONTENT_TYPES = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
  + `<Override PartName="/word/document.xml" ContentType="${MAIN}.document.main+xml"/>`
  + `<Override PartName="/word/styles.xml" ContentType="${MAIN}.styles+xml"/>`
  + `<Override PartName="/word/numbering.xml" ContentType="${MAIN}.numbering+xml"/></Types>`;

const ROOT_RELS = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`;

const pStyle = (id, name, props) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>${props}</w:style>`;
const heading = (level, size, color) => pStyle(`Heading${level}`, `heading ${level}`,
  `<w:pPr><w:keepNext/><w:spacing w:before="${level === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr>`);
const BORDER = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="D9DDE3"/>`).join('');

const STYLES = `${XML}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>`
  + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
  + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
  + pStyle('Title', 'Title', '<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr>')
  + pStyle('Subtitle', 'Subtitle', '<w:rPr><w:color w:val="5C6470"/><w:sz w:val="24"/></w:rPr>')
  + heading(1, 32, '0F5C5A') + heading(2, 24, '1A1D21') + heading(3, 22, '5C6470')
  + pStyle('ListParagraph', 'List Paragraph', '<w:pPr><w:ind w:left="720"/></w:pPr>')
  + `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>${BORDER}</w:tblBorders>`
  + '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';

const NUMBERING = `${XML}<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>`
  + '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>'
  + '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

function documentRels(images) {
  const media = images.map((img, i) => (img ? `<Relationship Id="rIdImg${i + 1}" Type="${REL}/image" Target="media/image${i + 1}.png"/>` : '')).join('');
  return `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rIdStyles" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="${REL}/numbering" Target="numbering.xml"/>${media}</Relationships>`;
}

// images: one entry per workflow in page order, { bytes, width, height } or null.
export function buildDocx(view, images) {
  const enc = new TextEncoder();
  const files = new Map([
    ['[Content_Types].xml', CONTENT_TYPES], ['_rels/.rels', ROOT_RELS], ['word/document.xml', documentXml(view, images)],
    ['word/_rels/document.xml.rels', documentRels(images)], ['word/styles.xml', STYLES], ['word/numbering.xml', NUMBERING],
  ].map(([path, xml]) => [path, enc.encode(xml)]));
  images.forEach((img, i) => { if (img) files.set(`word/media/image${i + 1}.png`, img.bytes); });
  return zipStore(files);
}
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/lib/docx-xml.mjs` (whole file):

~~~~js
// WordprocessingML pieces for the proposal's DOCX: paragraphs, tables, bullet
// lists and inline images, in the styles docx-package.mjs defines. Pure
// strings, no DOM: Node tests read exactly what the page writes. Like the
// zip writer it ships twice, imported here and inlined into the page.
const TEXT_WIDTH = 9638; // twips: A4 width less two 2 cm margins
const EMU_PER_PX = 9525;
const EMU_PER_TWIP = 635;

// Control characters other than tab/newline are not allowed in XML 1.0.
export const xmlText = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const run = (text, bold) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;

export function para(text, style) {
  if (!text) return '';
  return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${run(text)}</w:p>`;
}

export const bullets = (items) => items.map((t) => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${run(t)}</w:p>`).join('');

function row(cells, head) {
  const cell = (c) => `<w:tc><w:p>${run(c, head)}</w:p></w:tc>`;
  return `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map(cell).join('')}</w:tr>`;
}

export function table(head, rows) {
  const col = Math.floor(TEXT_WIDTH / head.length);
  const grid = head.map(() => `<w:gridCol w:w="${col}"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${row(head, true)}${rows.map((r) => row(r, false)).join('')}</w:tbl><w:p/>`;
}

// One diagram, scaled down to the text width, never up. n is the image's
// 1-based number: its media file, relationship id and drawing id.
export function image(img, n) {
  const scale = Math.min(1, (TEXT_WIDTH * EMU_PER_TWIP) / (img.width * EMU_PER_PX));
  const cx = Math.round(img.width * EMU_PER_PX * scale);
  const cy = Math.round(img.height * EMU_PER_PX * scale);
  const pic = `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="diagram${n}.png"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`;
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Diagram ${n}"/>`
    + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">${pic}</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}
~~~~

- [ ] **Step 4: Run the suite and see it pass**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`. The LibreOffice case skips without `soffice` on PATH; say so in the report if it skipped.

- [ ] **Step 5: Commit** (one command per call)

```bash
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/docx-body.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/docx-package.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/docx-xml.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/docx.test.mjs
/usr/bin/git commit -m "feat(proposal): docx export of the workflow proposal"
```

### Task 5: Page template, render and validate routing (proposal)

**Files:**
- Create: `plugins/solution-architect/skills/proposal/assets/proposal-workflow.html`
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/workflow-cli.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/lib/workflow-page.mjs`
- Modify: `plugins/solution-architect/skills/proposal/scripts/render.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/workflow-browser.test.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/workflow-render.test.mjs`
- Modify: `plugins/solution-architect/skills/proposal/scripts/validate.mjs`

**Interfaces:**
- Consumes: Tasks 1–4 (`withZip`, `proposalFindings`, `proposalView`, `contentHtml`, `navHtml`, `buildDocx`); analyze-requirements `embed`, `buildFontFaces`, `cdp.mjs` → `openPage(url)` → `{ eval, errors, send, close }`.
- Produces: CLI — workflow mode is chosen by `estimation.inputs.scopeMode === "workflow"`: `validate.mjs --estimation <e> --inputs <i>`; `render.mjs --estimation <e> --inputs <i> --mermaid-bundle <b> --out <dist>` → `<dist>/proposal.html`. Classic arguments unchanged.
- Produces: in the page, `window.__buildDocx(): Promise<string>` (base64 DOCX), `#pdf` and `#docx` buttons.

- [ ] **Step 1: Write the failing tests**

Write `plugins/solution-architect/skills/proposal/scripts/test/workflow-browser.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';
import { readZip } from '../../../estimate/classic/scripts/test/zip.mjs';
import { lead } from './workflow-stage.mjs';

const skip = findChrome() ? false : 'no chrome on PATH';
const settle = () => new Promise((r) => setTimeout(r, 1500));
// Draws a small SVG into each diagram, as mermaid would, so the PNG path runs for real.
const DRAWING_STUB = 'globalThis.mermaid={initialize(){},async run({querySelector}){for(const el of document.querySelectorAll(querySelector)){'
  + 'el.innerHTML=\'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><rect x="5" y="5" width="120" height="40" fill="#eee" stroke="#333"/><text x="20" y="30">Step</text></svg>\';}}};';

function proposalUrl() {
  const l = lead();
  const bundle = join(l.dir, 'mermaid.js');
  writeFileSync(bundle, DRAWING_STUB);
  execFileSync('node', [new URL('../render.mjs', import.meta.url).pathname, '--estimation', l.estimation, '--inputs', l.inputs,
    '--mermaid-bundle', bundle, '--out', join(l.dir, 'dist')]);
  return pathToFileURL(join(l.dir, 'dist', 'proposal.html')).href;
}

test('the page renders every section with no console errors', { skip }, async () => {
  const page = await openPage(proposalUrl());
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval('document.querySelectorAll("nav a").length'), 6);
    assert.equal(await page.eval('document.querySelectorAll(".mermaid-canvas svg").length'), 3);
    assert.match(await page.eval('document.getElementById("cost").textContent'), /\$39,000 – \$48,500/);
  } finally { await page.close(); }
});

test('Download DOCX builds a Word file with one PNG per diagram and well-formed XML', { skip }, async () => {
  const page = await openPage(proposalUrl());
  try {
    await settle();
    const files = readZip(Buffer.from(await page.eval('window.__buildDocx()'), 'base64'));
    const pngs = [...files.keys()].filter((k) => k.startsWith('word/media/'));
    assert.deepEqual(pngs, ['word/media/image1.png', 'word/media/image2.png', 'word/media/image3.png']);
    assert.equal(files.get('word/media/image1.png').subarray(1, 4).toString('latin1'), 'PNG');
    for (const part of ['word/document.xml', 'word/styles.xml', 'word/numbering.xml', '[Content_Types].xml']) {
      const xml = JSON.stringify(files.get(part).toString('utf8'));
      const broken = await page.eval(`new DOMParser().parseFromString(${xml}, 'application/xml').getElementsByTagName('parsererror').length`);
      assert.equal(broken, 0, part);
    }
  } finally { await page.close(); }
});

test('the print layout hides the menu and both buttons', { skip }, async () => {
  const page = await openPage(proposalUrl());
  try {
    await page.send('Emulation.setEmulatedMedia', { media: 'print' });
    assert.equal(await page.eval('getComputedStyle(document.querySelector(".tools")).display'), 'none');
    assert.equal(await page.eval('getComputedStyle(document.querySelector("nav")).display'), 'none');
    assert.equal(await page.eval('getComputedStyle(document.getElementById("system-2")).breakBefore'), 'page');
  } finally { await page.close(); }
});
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/test/workflow-render.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lead } from './workflow-stage.mjs';

const cli = (name) => new URL(`../${name}.mjs`, import.meta.url).pathname;
const tpl = () => readFileSync(new URL('../../assets/proposal-workflow.html', import.meta.url), 'utf8');
const STUB_BUNDLE = 'globalThis.mermaid={initialize(){},run(){return Promise.resolve();}};';

function render(l, bundleText = STUB_BUNDLE) {
  const bundle = join(l.dir, 'mermaid.js');
  writeFileSync(bundle, bundleText);
  return spawnSync('node', [cli('render'), '--estimation', l.estimation, '--inputs', l.inputs, '--mermaid-bundle', bundle, '--out', join(l.dir, 'dist')], { encoding: 'utf8' });
}
const page = (l) => readFileSync(join(l.dir, 'dist', 'proposal.html'), 'utf8');

test('template carries exactly its seven slots, both buttons, a print layout and no external URL', () => {
  const markers = [...new Set([...tpl().matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]))].sort();
  assert.deepEqual(markers, ['CONTENT', 'DATA', 'DOCX', 'FONTS', 'MERMAID_BUNDLE', 'NAV', 'TITLE']);
  assert.match(tpl(), /id="pdf"[^>]*>Download PDF</);
  assert.match(tpl(), /id="docx"[^>]*>Download DOCX</);
  assert.match(tpl(), /@media print[\s\S]*\.tools[\s\S]*break-before: page/);
  assert.doesNotMatch(tpl(), /https?:\/\/(?!www\.w3\.org)/);
});

test('validate routes a workflow estimate to the inputs checks', () => {
  const ok = lead();
  const r = spawnSync('node', [cli('validate'), '--estimation', ok.estimation, '--inputs', ok.inputs], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /proposal inputs valid/);
  const noInputs = spawnSync('node', [cli('validate'), '--estimation', ok.estimation], { encoding: 'utf8' });
  assert.equal(noInputs.status, 1);
  assert.match(noInputs.stderr, /^usage: validate\.mjs --estimation estimation\.json --inputs proposal-inputs\.json/);
  const bad = lead((i) => { i.scopeIntro = 'About $40k.'; });
  const r2 = spawnSync('node', [cli('validate'), '--estimation', bad.estimation, '--inputs', bad.inputs], { encoding: 'utf8' });
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /scopeIntro: price "\$40k"/);
});

test('render writes a self-contained proposal.html with the page data and the DOCX writer', () => {
  const l = lead();
  const r = render(l);
  assert.equal(r.status, 0, r.stderr);
  const html = page(l);
  assert.doesNotMatch(html, /<!-- slot:/);
  assert.doesNotMatch(html, /<(link|script|img)[^>]+(href|src)="https?:/);
  assert.match(html, /<title>Proposal — Sin Kowa<\/title>/);
  assert.match(html, /<h1>Sin Kowa Digital Transformation — Systems &amp; Workflows Proposal<\/h1>/);
  assert.match(html, /function zipStore\(/);
  assert.match(html, /function buildDocx\(/);
  assert.doesNotMatch(html, /^\s*(?:export|import) /m);
  const data = JSON.parse(/<script type="application\/json" id="proposal-data">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(data.cost.range, '$39,000 – $48,500');
  assert.equal(data.systems.length, 2);
});

test('a name cannot close the data script tag', () => {
  const l = lead((i) => { i.scopeIntro = 'Ends here </script><script>alert(1)</script>'; });
  assert.equal(render(l).status, 0);
  const html = page(l);
  assert.equal((html.match(/<script>alert/g) ?? []).length, 0);
});

test('render refuses on a finding, or a bundle with a script terminator, and writes nothing', () => {
  const bad = lead((i) => { delete i.milestones['M3 - Operations']; });
  const r = render(bad);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /milestone "M3 - Operations": needs a client "name" and "demonstrates"/);
  assert.equal(existsSync(join(bad.dir, 'dist', 'proposal.html')), false);
  const l = lead();
  assert.equal(render(l, 'var x = "</script>";').status, 1);
  assert.equal(existsSync(join(l.dir, 'dist', 'proposal.html')), false);
});
~~~~

- [ ] **Step 2: Run them and see them fail**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/workflow-render.test.mjs`
Expected: FAIL — the template file does not exist and `validate.mjs` has no workflow route.

- [ ] **Step 3: Write the code**

Write `plugins/solution-architect/skills/proposal/assets/proposal-workflow.html` (whole file):

~~~~html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><!-- slot:TITLE --></title>
<style>
<!-- slot:FONTS -->
:root {
  --ink: #1a1d21; --muted: #5c6470; --line: #d9dde3;
  --accent: #0f5c5a; --bg: #ffffff; --wash: #f6f7f9;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 16px/1.65 "IBM Plex Sans", system-ui, sans-serif;
}
nav {
  position: fixed; top: 0; left: 0; bottom: 0; width: 230px;
  padding: 2.5rem 1.5rem; border-right: 1px solid var(--line);
  background: var(--wash); overflow-y: auto;
}
nav a {
  display: block; color: var(--muted); text-decoration: none;
  font-size: .85rem; padding: .3rem 0;
}
nav a:hover { color: var(--accent); }
main { max-width: 52rem; margin: 0 auto; padding: 3rem 2rem 5rem; }
@media (min-width: 980px) { main { margin-left: 270px; } }
@media (max-width: 979px) { nav { display: none; } }
.tools { display: flex; gap: .5rem; justify-content: flex-end; margin-bottom: 1rem; }
.tools button {
  font: inherit; font-size: .85rem; color: var(--ink); background: var(--wash);
  border: 1px solid var(--line); border-radius: .3rem; padding: .35rem .8rem; cursor: pointer;
}
.tools button:hover { border-color: var(--accent); color: var(--accent); }
h1 { font-size: 1.9rem; line-height: 1.25; letter-spacing: -.01em; margin: 0 0 .4rem; }
.byline { color: var(--muted); margin: 0 0 1.6rem; }
h2 {
  font-size: 1.25rem; margin-top: 2.6rem; padding-top: 1.2rem;
  border-top: 1px solid var(--line); color: var(--accent);
}
h2 .sysno { color: var(--muted); font-weight: 500; }
h3 {
  font-size: .85rem; text-transform: uppercase; letter-spacing: .07em;
  color: var(--muted); font-weight: 600; margin: 1.6rem 0 .3rem;
}
p { max-width: 68ch; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
td:first-child { font-weight: 600; width: 34%; }
.flow-name { font-size: .85rem; font-weight: 600; color: var(--muted); margin: 1.2rem 0 .3rem; }
.diagram-shell { margin: 0 0 1rem; padding: 1rem; background: var(--wash); border-radius: 8px; overflow-x: auto; }
.mermaid-canvas { white-space: pre; font-size: .8rem; color: var(--muted); }
.mermaid-canvas svg { max-width: 100%; height: auto; }
.price { display: flex; flex-wrap: wrap; gap: 1rem; margin: .8rem 0 1rem; }
.price > div { flex: 1 1 14rem; background: var(--wash); border: 1px solid var(--line); border-radius: .3rem; padding: .8rem 1rem; }
.price span { display: block; font-size: .8rem; color: var(--muted); }
.price b { display: block; font-size: 1.5rem; font-weight: 600; margin: .15rem 0; font-variant-numeric: tabular-nums; }
@media print {
  nav, .tools { display: none; }
  main { margin: 0 auto; padding: 0; max-width: none; }
  section.system { break-before: page; }
  h2, h3, .flow-name { break-after: avoid; }
  table, .diagram-shell, .price { break-inside: avoid; }
  @page { size: A4; margin: 22mm 18mm; }
}
</style>
</head>
<body>
<nav aria-label="Sections">
<!-- slot:NAV -->
</nav>
<main>
<div class="tools"><button id="pdf" type="button">Download PDF</button><button id="docx" type="button">Download DOCX</button></div>
<!-- slot:CONTENT -->
</main>
<script type="application/json" id="proposal-data"><!-- slot:DATA --></script>
<script>
<!-- slot:MERMAID_BUNDLE -->
</script>
<script type="module">
// A module, so the inlined writer's names stay out of the page's global scope.
<!-- slot:DOCX -->
const PROPOSAL = JSON.parse(document.getElementById('proposal-data').textContent);
// Plain SVG text labels: a canvas refuses to export a drawing with HTML labels.
mermaid.initialize({ startOnLoad: false, theme: 'neutral', htmlLabels: false, flowchart: { htmlLabels: false }, fontFamily: '"IBM Plex Sans", sans-serif' });
const drawn = mermaid.run({ querySelector: '.mermaid-canvas' });

async function svgPng(svg) {
  const { width, height } = svg.getBoundingClientRect();
  const copy = svg.cloneNode(true);
  copy.setAttribute('width', width);
  copy.setAttribute('height', height);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 2);
  canvas.height = Math.ceil(height * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: Math.round(width), height: Math.round(height) };
}

// One entry per workflow in page order; a diagram that did not draw is null
// and the DOCX writes its steps instead.
async function diagramImages() {
  await drawn.catch(() => null);
  const canvases = [...document.querySelectorAll('.mermaid-canvas')];
  return Promise.all(canvases.map((c) => {
    const svg = c.querySelector('svg');
    return svg ? svgPng(svg).catch(() => null) : null;
  }));
}

const docxBytes = async () => buildDocx(PROPOSAL, await diagramImages());
window.__buildDocx = async () => {
  const bytes = await docxBytes();
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
document.getElementById('pdf').onclick = () => window.print();
document.getElementById('docx').onclick = async () => {
  const blob = new Blob([await docxBytes()], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = PROPOSAL.file;
  a.click();
  URL.revokeObjectURL(a.href);
};
</script>
</body>
</html>
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/lib/workflow-cli.mjs` (whole file):

~~~~js
// validate.mjs and render.mjs in workflow mode: estimation.json (with the
// BA package it names) plus proposal-inputs.json. Same rule as classic:
// render re-runs validation and writes nothing on a finding.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { proposalFindings } from './workflow-lead.mjs';
import { proposalView } from './workflow-view.mjs';
import { workflowPage } from './workflow-page.mjs';

const USAGE = {
  validate: 'usage: validate.mjs --estimation estimation.json --inputs proposal-inputs.json',
  render: 'usage: render.mjs --estimation estimation.json --inputs proposal-inputs.json --mermaid-bundle <path> --out <lead>/dist',
};

function report(findings) {
  console.error(findings.join('\n'));
  return 1;
}

export function validateWorkflow(args) {
  if (typeof args.inputs !== 'string') return report([USAGE.validate]);
  const { findings } = proposalFindings(args);
  if (findings.length) return report(findings);
  console.log('proposal inputs valid');
  return 0;
}

function readBundle(path) {
  if (typeof path !== 'string') return { error: '--mermaid-bundle is required (see analyze-requirements references/viewer.md §1)' };
  const bundle = readFileSync(path, 'utf8');
  if (bundle.includes('</script')) return { error: 'mermaid bundle carries a literal </script — rebuild it (analyze-requirements references/viewer.md §1)' };
  return { bundle };
}

export function renderWorkflow(args) {
  if (typeof args.inputs !== 'string' || typeof args.out !== 'string') return report([USAGE.render]);
  const { findings, ...lead } = proposalFindings(args);
  if (findings.length) return report(findings);
  const { bundle, error } = readBundle(args['mermaid-bundle']);
  if (error) return report([error]);
  mkdirSync(args.out, { recursive: true });
  const out = join(args.out, 'proposal.html');
  writeFileSync(out, workflowPage({ view: proposalView(lead), bundle }));
  console.log(out);
  return 0;
}
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/lib/workflow-page.mjs` (whole file):

~~~~js
// Fills the workflow proposal template: the body and menu rendered in Node,
// the page data for the DOCX, the mermaid bundle, and the DOCX writer (the
// shared zip writer plus the three docx modules, imports stripped).
import { readFileSync } from 'node:fs';
import { embed } from '../../../analyze-requirements/scripts/lib/embed.mjs';
import { buildFontFaces } from '../../../analyze-requirements/scripts/lib/fonts.mjs';
import { escapeHtml } from '../../../analyze-requirements/scripts/lib/md-render.mjs';
import { inlineModule, withZip } from '../../../estimate/shared/lib/inline.mjs';
import { contentHtml, navHtml } from './workflow-html.mjs';

const here = (rel) => new URL(rel, import.meta.url);
const DOCX_MODULES = ['./docx-xml.mjs', './docx-body.mjs', './docx-package.mjs'];
const noImports = (src) => src.replace(/^import [^\n]*\n/gm, '');

export const docxScript = () => withZip(DOCX_MODULES.map((m) => inlineModule(noImports(readFileSync(here(m), 'utf8')))).join('\n'));

// Every "<" escaped: nothing in the data can close or comment out its script tag.
const island = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

export function workflowPage({ view, bundle }) {
  return embed({
    template: readFileSync(here('../../assets/proposal-workflow.html'), 'utf8'),
    slots: {
      TITLE: escapeHtml(`Proposal — ${view.client}`),
      FONTS: buildFontFaces(here('../../../analyze-requirements/assets/fonts/').pathname),
      NAV: navHtml(view), CONTENT: contentHtml(view), DATA: island(view),
      MERMAID_BUNDLE: bundle, DOCX: docxScript(),
    },
  });
}
~~~~

In `plugins/solution-architect/skills/proposal/scripts/render.mjs`, 3 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { checkProposal } from './lib/checks.mjs';
~~~~

with

~~~~js
import { checkProposal } from './lib/checks.mjs';
import { isWorkflow } from './lib/workflow-lead.mjs';
import { renderWorkflow } from './lib/workflow-cli.mjs';
~~~~

(2) replace

~~~~js
const args = parseArgs(process.argv.slice(2));
const md = readFileSync(args.md, 'utf8');
~~~~

with

~~~~js
const args = parseArgs(process.argv.slice(2));
const estimation = JSON.parse(readFileSync(args.estimation, 'utf8'));
// A workflow-mode estimate gets the Systems & Workflows page (spec 4); no proposal.md.
if (isWorkflow(estimation)) process.exit(renderWorkflow(args));
const md = readFileSync(args.md, 'utf8');
~~~~

(3) replace

~~~~js
const md = readFileSync(args.md, 'utf8');
const estimation = JSON.parse(readFileSync(args.estimation, 'utf8'));
~~~~

with

~~~~js
const md = readFileSync(args.md, 'utf8');
~~~~

In `plugins/solution-architect/skills/proposal/scripts/validate.mjs`, 3 replacement(s), each matching exactly once:

(1) replace

~~~~js
import { checkProposal } from './lib/checks.mjs';
~~~~

with

~~~~js
import { checkProposal } from './lib/checks.mjs';
import { isWorkflow } from './lib/workflow-lead.mjs';
import { validateWorkflow } from './lib/workflow-cli.mjs';
~~~~

(2) replace

~~~~js
const args = parseArgs(process.argv.slice(2));
const md = readFileSync(args.md, 'utf8');
~~~~

with

~~~~js
const args = parseArgs(process.argv.slice(2));
const estimation = JSON.parse(readFileSync(args.estimation, 'utf8'));
if (isWorkflow(estimation)) process.exit(validateWorkflow(args));
const md = readFileSync(args.md, 'utf8');
~~~~

(3) replace

~~~~js
const md = readFileSync(args.md, 'utf8');
const estimation = JSON.parse(readFileSync(args.estimation, 'utf8'));
const findings = checkProposal({ md, estimation });
~~~~

with

~~~~js
const md = readFileSync(args.md, 'utf8');
const findings = checkProposal({ md, estimation });
~~~~

- [ ] **Step 4: Run the suite and see it pass**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`; the classic render/validate/e2e tests pass unchanged. Browser cases skip without Chrome; say so if they did.

- [ ] **Step 5: Commit** (one command per call)

```bash
/usr/bin/git add plugins/solution-architect/skills/proposal/assets/proposal-workflow.html
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/workflow-cli.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/lib/workflow-page.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/render.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/workflow-browser.test.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/workflow-render.test.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/validate.mjs
/usr/bin/git commit -m "feat(proposal): workflow proposal page with pdf and docx"
```

### Task 6: SKILL routing, workflow reference, review charter, eval

**Files:**
- Create: `plugins/solution-architect/evals/proposal-workflow/case.yaml`
- Create: `plugins/solution-architect/evals/proposal-workflow/fixture.sh`
- Create: `plugins/solution-architect/evals/proposal-workflow/graders/inputs-written.md`
- Create: `plugins/solution-architect/evals/proposal-workflow/graders/no-proposal-md.md`
- Create: `plugins/solution-architect/evals/proposal-workflow/graders/skill-fired.md`
- Create: `plugins/solution-architect/evals/proposal-workflow/graders/validate-then-render.md`
- Create: `plugins/solution-architect/evals/proposal-workflow/prompt.md`
- Modify: `plugins/solution-architect/skills/proposal/README.md`
- Modify: `plugins/solution-architect/skills/proposal/SKILL.md`
- Modify: `plugins/solution-architect/skills/proposal/references/review.md`
- Create: `plugins/solution-architect/skills/proposal/references/workflow.md`
- Modify: `plugins/solution-architect/skills/proposal/scripts/test/evals-fixtures.test.mjs`
- Create: `plugins/solution-architect/skills/proposal/scripts/test/workflow-docs.test.mjs`
- Create (generated by the commands in Step 3): `plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini/` — requirements.json, ARCHITECTURE.md, measurements.jsonl, estimation-inputs.json, estimation.json

**Interfaces:**
- Consumes: Task 2 `loadLead` (the fixture pin test).
- Produces: `references/workflow.md` (the flow the agent follows), eval case `plugins/solution-architect/evals/proposal-workflow/`, fixture lead `proposal/evals/fixtures/workflow-sin-kowa-mini/`.

- [ ] **Step 1: Write the failing tests**

In `plugins/solution-architect/skills/proposal/scripts/test/evals-fixtures.test.mjs`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~js
  assert.throws(() => deriveFigures(stored), /not priced/);
});
~~~~

with

~~~~js
  assert.throws(() => deriveFigures(stored), /not priced/);
});

test('the workflow fixture lead validates as the proposal will load it', async () => {
  const { loadLead } = await import('../lib/workflow-lead.mjs');
  const lead = loadLead(new URL('fixtures/workflow-sin-kowa-mini/estimation.json', evalsDir).pathname);
  assert.deepEqual(lead.findings, []);
  assert.equal(lead.est.inputs.scopeMode, 'workflow');
});
~~~~

Write `plugins/solution-architect/skills/proposal/scripts/test/workflow-docs.test.mjs` (whole file):

~~~~js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('SKILL.md routes a workflow estimate to references/workflow.md', () => {
  const skill = doc('SKILL.md');
  assert.match(skill, /scopeMode` is `"workflow"` → follow\s+`references\/workflow\.md`/);
  assert.ok(skill.includes('proposal-inputs.json'));
});

test('workflow.md carries the inputs contract, both commands and the hand-over', () => {
  const d = doc('references/workflow.md');
  for (const needle of ['proposal-inputs.json', 'scripts/validate.mjs --estimation', '--inputs', 'scripts/render.mjs --estimation',
    '--mermaid-bundle', 'Download PDF', 'Download DOCX', 'USD', 'jargonAllow', 'techLevel', 'demonstrates', 'no proposal.md']) {
    assert.ok(d.includes(needle), `workflow.md missing: ${needle}`);
  }
  assert.doesNotMatch(d, /\bTBD\b|\bTODO\b/);
});

test('review.md has a workflow charter that reads the rendered page', () => {
  const d = doc('references/review.md');
  assert.match(d, /## Workflow mode[\s\S]*dist\/proposal\.html/);
});
~~~~

- [ ] **Step 2: Run them and see them fail**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/workflow-docs.test.mjs plugins/solution-architect/skills/proposal/scripts/test/evals-fixtures.test.mjs`
Expected: FAIL — `references/workflow.md` and the eval fixture lead do not exist.

- [ ] **Step 3: Write the code**

Write `plugins/solution-architect/evals/proposal-workflow/case.yaml` (whole file):

~~~~yaml
schema_version: "1.1"
name: proposal-workflow
context:
  scaffold_script: fixture.sh
~~~~

Write `plugins/solution-architect/evals/proposal-workflow/fixture.sh` (whole file):

~~~~bash
#!/usr/bin/env bash
# Seeds the empty workspace as the sin-kowa-mini lead folder with a finished
# workflow-mode estimate: BA package, architecture, estimate inputs and output.
set -euo pipefail
src="$(cd "$(dirname "$0")/../../skills/proposal/evals/fixtures/workflow-sin-kowa-mini" && pwd)"
cp "$src/requirements.json" "$src/ARCHITECTURE.md" "$src/estimation-inputs.json" "$src/estimation.json" "$src/measurements.jsonl" .
~~~~

Write `plugins/solution-architect/evals/proposal-workflow/graders/inputs-written.md` (whole file):

~~~~markdown
---
type: llm
focus: trace
---

Workflow mode: the agent writes only the sentences, in proposal-inputs.json
beside estimation.json. The estimate's milestones are "M1 - Walking
skeleton", "M2 - Money" and "M3 - Operations".

PASS if the agent wrote proposal-inputs.json with client "Sin Kowa", title
"Sin Kowa Digital Transformation", firm "Code Engine Studio", an ISO date,
techLevel "non-tech", a non-empty scopeIntro, and a "milestones" entry for
each of the three milestone names with a "name" and a "demonstrates"
sentence; and no sentence in it carries a price, a currency amount or an
internal ID such as FEAT-001 or SYS-002.
FAIL if it wrote proposal.md, a nine-section proposal, or proposal-figures.json,
or if any required key or milestone entry is missing.
~~~~

Write `plugins/solution-architect/evals/proposal-workflow/graders/no-proposal-md.md` (whole file):

~~~~markdown
---
type: file_exists
path: "proposal.md"
exists: false
---

Workflow mode never writes proposal.md (spec 4 P2).
~~~~

Write `plugins/solution-architect/evals/proposal-workflow/graders/skill-fired.md` (whole file):

~~~~markdown
---
type: tool_used
tool: Skill
min: 1
---

The skill must actually be invoked, not merely described.
~~~~

Write `plugins/solution-architect/evals/proposal-workflow/graders/validate-then-render.md` (whole file):

~~~~markdown
---
type: llm
focus: trace
---

This sandbox has no Bash, so the scripts cannot run here.

PASS if, after writing proposal-inputs.json, the agent either ran or named
both `validate.mjs --estimation … --inputs …` and `render.mjs --estimation …
--inputs … --mermaid-bundle … --out …/dist` (validate first), or said it
cannot run them here and stopped.
FAIL if it claimed proposal.html was rendered without running render.mjs,
or wrote proposal.html itself.
~~~~

Write `plugins/solution-architect/evals/proposal-workflow/prompt.md` (whole file):

~~~~markdown
---
max_turns: 40
allowed_tools: [Read, Glob, Grep, Write, Skill, AskUserQuestion, TodoWrite]
---

Use the proposal skill. The estimate for sin-kowa-mini is done
(estimation.json in this folder). The client is Sin Kowa, they are not
technical, and we are Code Engine Studio — no need to save a firm profile.
Title it "Sin Kowa Digital Transformation". Propose the milestone names and
what each one demonstrates yourself; I'll correct them on the page.
~~~~

In `plugins/solution-architect/skills/proposal/README.md`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~markdown
human review → render.mjs → serve.mjs
~~~~

with

~~~~markdown
human review → render.mjs → serve.mjs

## Workflow mode

When the estimate is in workflow mode (`scopeMode: "workflow"`), the skill
builds a Systems & Workflows page instead: scope, each system with its
workflow diagrams and features, milestones, assumptions & exclusions and the
price, all from the BA package and the estimate. The agent writes only the
sentences (`proposal-inputs.json`); there is no proposal.md. The page has
Download PDF and Download DOCX buttons. Prices are USD. See
`references/workflow.md`.

interview → proposal-inputs.json → validate.mjs → render.mjs → fresh-eyes
review → serve.mjs → human review on the page
~~~~

In `plugins/solution-architect/skills/proposal/SKILL.md`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~markdown
   a client.
~~~~

with

~~~~markdown
   a client.

## Mode

Read `estimation.json` first. `inputs.scopeMode` is `"workflow"` → follow
`references/workflow.md` instead of the flow below: the proposal is built
from the BA package and the estimate as a Systems & Workflows page, you
write only its sentences (`proposal-inputs.json`), and there is no
proposal.md and no derive step. Anything else → the classic flow below.
~~~~

In `plugins/solution-architect/skills/proposal/references/review.md`, 1 replacement(s), each matching exactly once:

(1) replace

~~~~markdown

## Loop bound
~~~~

with

~~~~markdown

## Workflow mode

Run after `render.mjs` first writes `dist/proposal.html`, before human
review. Dispatch one general-purpose subagent with **only**:
`dist/proposal.html`, estimation.json, and the client tech level. Same
charter, read against the page text, except item 2, which becomes: does
the Scope section say what we build, and the Cost section what it costs?
Findings are fixed in `proposal-inputs.json` (the only text you wrote);
a finding about a system, feature, assumption or exclusion goes back to
the BA package or the estimate, never into the proposal.

## Loop bound
~~~~

Write `plugins/solution-architect/skills/proposal/references/workflow.md` (whole file):

~~~~markdown
# Workflow mode — Systems & Workflows proposal page

Read when `estimation.json` has `inputs.scopeMode: "workflow"`. The page
copies the format of the proposal sent to Sin Kowa: Scope, one section per
system (its workflow diagrams and a Feature | What it does table),
Milestones, Assumptions & exclusions, Cost estimate. Every fact on it comes
from data; you write only the sentences, in `proposal-inputs.json`. There
is no proposal.md, and nobody edits one: the human reads the page, asks for
changes in chat, and downloads the DOCX or PDF to send.

## 1. Where each part comes from

| Part | Source |
| --- | --- |
| Systems, workflows, features and what each does, scope.out | `requirements.json` (the BA package the estimate names) |
| Milestone contents, assumptions, exclusions, price | `estimation.json` |
| Title, byline, scope intro, one optional sentence per system, milestone client names and what each demonstrates | `proposal-inputs.json` (you) |

Prices are USD. The team changes the currency, and adds an About-us or
next-steps section if they want one, in the copy they send — never in a
skill file.

## 2. Flow

1. **Gate.** `estimation.json` exists with `scopeMode: "workflow"`, and the
   `requirements.json` it names exists. A missing estimate → stop: "run the
   estimate skill first." `validate.mjs` (step 4) re-runs the estimate's own
   validation; a finding there → stop and name the estimate skill.
2. **Interview, one question at a time, only what is unknown.** Client name;
   tech level (non-tech | low-tech | technical, as classic
   `references/interview.md` §1); the firm name (`firm` from the profile,
   classic §3 lookup — ask only the name if there is no profile). Then show
   the milestones (`computed.features[].milestone`, with the features each
   finishes) and propose a client name and one "what it demonstrates" line
   for each; the user corrects them.
3. **Write `proposal-inputs.json`** beside `estimation.json` (§3).
4. **Validate:** `node scripts/validate.mjs --estimation <dir>/estimation.json
   --inputs <dir>/proposal-inputs.json` — fix findings, re-run until clean.
5. **Render:** `node scripts/render.mjs --estimation <dir>/estimation.json
   --inputs <dir>/proposal-inputs.json --mermaid-bundle <path> --out <dir>/dist`
   — the same mermaid bundle as classic step 8. It re-runs validation and
   writes nothing on a finding.
6. **Fresh-eyes review** of `dist/proposal.html` (`references/review.md`,
   Workflow mode); fix in `proposal-inputs.json`, steps 4–5 again.
7. **Serve and hand over.** `node ../analyze-requirements/scripts/serve.mjs <dir>`.
   Tell the user: the URL; that the page has Download PDF and Download DOCX
   buttons; that prices are USD and currency, About-us and next steps are
   theirs to change in the sent copy. Changes → edit `proposal-inputs.json`
   (or, for a fact, the BA package or estimate) → steps 4–7 again.

## 3. `proposal-inputs.json`

```json
{
  "client": "Sin Kowa",
  "title": "Sin Kowa Digital Transformation",
  "firm": "Code Engine Studio",
  "date": "2026-10-07",
  "techLevel": "non-tech",
  "jargonAllow": [],
  "scopeIntro": "This proposal covers two systems for Phase 1 …",
  "systems": { "SYS-002": "It closes the paper delivery-order gap …" },
  "milestones": {
    "M1 - Walking skeleton": { "name": "Digitise core records", "demonstrates": "Orders move through each stage on screen …" }
  }
}
```

- `title` becomes "<title> — Systems & Workflows Proposal"; `date` is today
  (ISO) and shows as "Oct 7, 2026 · <firm>".
- `systems` is optional, keyed by the BA system id; the sentence follows the
  system's own purpose line.
- `milestones` needs an entry for every milestone the estimate uses, keyed
  by its estimate name, and no others. The page numbers them in order.

## 4. Sentence rules (validate.mjs refuses each)

- No price of any kind in a sentence (`$40k`, `USD 5,000`, `12k SGD`,
  `5,000 dollars`): the only prices on the page are the estimate's.
- No internal ID (`FEAT-001`, `SYS-002`, `FR-003` …): name the thing in words.
- `non-tech`: no word from the jargon list (`scripts/lib/jargon.mjs`) unless
  listed in `jargonAllow` because the client uses it.
- No timeline, rate, team or score: the estimate produces none for the
  client (the fresh-eyes review catches what no script can).
~~~~

Run: `mkdir -p plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini`

Run: `cp plugins/solution-architect/skills/estimate/workflow-based/scripts/test/fixtures/requirements.json plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini/requirements.json`

Run: `cp plugins/solution-architect/skills/estimate/workflow-based/scripts/test/fixtures/ARCHITECTURE-mini.md plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini/ARCHITECTURE.md`

Run: `touch plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini/measurements.jsonl`

Run: `node -e "const fs=require('fs');const i=JSON.parse(fs.readFileSync('plugins/solution-architect/skills/estimate/workflow-based/scripts/test/fixtures/inputs-pass.json','utf8'));i.measurementsPath='measurements.jsonl';fs.writeFileSync('plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini/estimation-inputs.json',JSON.stringify(i,null,2)+'\\n')"`

Run: `(cd plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini && node ../../../../estimate/workflow-based/scripts/compute.mjs --inputs estimation-inputs.json --out estimation.json)`

- [ ] **Step 4: Run the suite and see it pass**

Run: `node --test plugins/solution-architect/skills/proposal/scripts/test/*.test.mjs 2>&1 | tail -8`
Expected: `ℹ fail 0`.

- [ ] **Step 5: Commit** (one command per call)

```bash
/usr/bin/git add plugins/solution-architect/evals/proposal-workflow/case.yaml
/usr/bin/git add plugins/solution-architect/evals/proposal-workflow/fixture.sh
/usr/bin/git add plugins/solution-architect/evals/proposal-workflow/graders/inputs-written.md
/usr/bin/git add plugins/solution-architect/evals/proposal-workflow/graders/no-proposal-md.md
/usr/bin/git add plugins/solution-architect/evals/proposal-workflow/graders/skill-fired.md
/usr/bin/git add plugins/solution-architect/evals/proposal-workflow/graders/validate-then-render.md
/usr/bin/git add plugins/solution-architect/evals/proposal-workflow/prompt.md
/usr/bin/git add plugins/solution-architect/skills/proposal/README.md
/usr/bin/git add plugins/solution-architect/skills/proposal/SKILL.md
/usr/bin/git add plugins/solution-architect/skills/proposal/evals/fixtures/workflow-sin-kowa-mini
/usr/bin/git add plugins/solution-architect/skills/proposal/references/review.md
/usr/bin/git add plugins/solution-architect/skills/proposal/references/workflow.md
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/evals-fixtures.test.mjs
/usr/bin/git add plugins/solution-architect/skills/proposal/scripts/test/workflow-docs.test.mjs
/usr/bin/git commit -m "docs(proposal): workflow mode flow, review and eval"
```

### Task 7: Verify, eval, hand-try, review, report — then wait

- [ ] **Step 1: Full suite** — `npm test 2>&1 | tail -8` → `ℹ fail 0` (or only the known flake; say which). Baseline at the spec commit: 1308 tests; expected after: 1354. Say if the browser or LibreOffice cases skipped.
- [ ] **Step 2: Eval** — `claude plugin eval plugins/solution-architect --case 'proposal-workflow' --runs 1 --ablation none --no-publish --trust-plugin --scaffold` (check `claude plugin eval --help` for the plugin path and `--scaffold`; the case seeds its lead with `fixture.sh`). The sandbox has no Bash, so `validate-then-render` passes on "named the commands and stopped". If a grader misjudges, fix its wording and re-run that case only.
- [ ] **Step 3: Hand-try with a real mermaid bundle** — build one per analyze-requirements `references/viewer.md` §1 (or reuse a lead's). On a staged lead (`node -e "import('./plugins/solution-architect/skills/proposal/scripts/test/workflow-stage.mjs').then(m => console.log(m.lead().dir))"`): `node plugins/solution-architect/skills/proposal/scripts/render.mjs --estimation <dir>/estimation.json --inputs <dir>/proposal-inputs.json --mermaid-bundle <bundle> --out <dir>/dist`, open `dist/proposal.html`, press Download DOCX and Download PDF, open the DOCX in LibreOffice or Word. Expected: no console errors, three diagrams in the page and in the DOCX.
- [ ] **Step 4: Whole-branch review** (`superpowers:requesting-code-review`); fix findings in the worktree.
- [ ] **Step 5: Report and stop.** Commits, test counts, eval scores, hand-try result, every divergence from this plan, and the known flake. Ask the user to open the DOCX in Google Docs. **Do not merge**: the user tests first and says when; then squash-merge into `feat/workflow-based-estimator` as `feat(proposal): workflow-mode systems and workflows page`.
