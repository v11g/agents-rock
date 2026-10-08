import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageData, undecided, idLeaks } from '../lib/review-data.mjs';
import { fillPage, pageHtml } from '../lib/review-page.mjs';
import { loadWorkflow, noFlows } from './scope-cases.mjs';
import { DATE, decided, drafted } from './review-fixture.mjs';
import { checkPackage } from '../lib/checks.mjs';

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
  const pkg = drafted();
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
  assert.doesNotMatch(html, /flowcap|<nav/);
  assert.match(html, /<title>Sin Kowa Mini<\/title>/);
  for (const part of [
    '<p class="summary">2 systems · 5 features · 2 assumptions · <span class="tag">★ New</span> 2 added in interview</p>',
    '<h2><span class="sysno">System 2:</span> Orders &amp; invoicing</h2>',
    '<p class="flow-name">Main workflow · Order pipeline</p>\n<div class="flow">',
    '<tr class="new"><td><span class="tag">★ New</span> Invoice from packed quantities<span class="src">Added: PO in interview, 2026-10-07</span></td><td>Raises the invoice from what was packed and shipped</td></tr>',
    '<p class="flow-name">Sub-workflow · Custom order — starts at Order received, rejoins Order pipeline · about 20% of orders</p>',
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
  const r = runPage(drafted());
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

test('a system with no workflow draws its feature table only', () => {
  const { pkg } = noFlows();
  assert.deepEqual(pageData(pkg, DATE).systems[1].flows, []);
  assert.doesNotMatch(pageHtml(pkg, DATE).split('System 2:</span>')[1], /class="flow"/);
});

test('the canonical workflow fixture is R5-clean; drafted() rebuilds a 0.3.x re-run', () => {
  const { pkg, md } = loadWorkflow();
  assert.deepEqual(undecided(pkg), []);
  assert.doesNotMatch(JSON.stringify(pkg) + md, /drafted|right shape/i);
  const old = drafted();
  assert.deepEqual(undecided(old), [
    'WF-003: not decided; ask the PO in the interview',
    'FEAT-004: not decided; ask the PO in the interview',
  ]);
  assert.deepEqual(checkPackage({ pkg: old, md: null }), []);
});

const doc = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DOCS = ['SKILL.md', 'README.md', 'references/interview.md', 'references/writing.md', 'references/review.md'];
const flat = (p) => doc(p).replace(/\s+/g, ' ');

test('docs: the review page is read-only; nothing is pasted back', () => {
  for (const p of DOCS) {
    assert.doesNotMatch(doc(p), /Copy decisions|review\.mjs apply|--confirm|leftOut|review decisions|No, keep them|\(Recommended\)/, p);
  }
  assert.match(doc('SKILL.md'), /\*\*review page\*\*/);
});

test('docs: interview options cite an input quote, assume with a boundary, never recommend', () => {
  const t = doc('references/interview.md');
  assert.match(t, /starts with "Assume"/);
  assert.doesNotMatch(t, /no hint in the input|input hint/);
  const f = flat('references/interview.md');
  assert.match(f, /cites its input quote: the file, the place and the exact words, copied, not paraphrased/);
  assert.match(f, /An option with no input quote cites nothing/);
  assert.match(f, /a scale and a limit/);
  assert.match(f, /else the smallest scope still safe to price/);
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

test('docs: an undecided workflow is asked with the input steps, No workflow, or Other only', () => {
  const t = flat('references/interview.md');
  assert.match(t, /the steps exactly as the input lists them/);
  assert.match(t, /"No workflow for <system>: its features stay, on no step"/);
  assert.match(t, /lists the steps through "Other"/);
  assert.match(t, /Never offer a step order the input does not give/);
  assert.match(t, /Leaving a workflow out never removes a feature/);
  const grader = readFileSync(new URL('../../../../evals/ba-review-page/graders/decide-in-interview.md', import.meta.url), 'utf8');
  assert.match(grader.replace(/\s+/g, ' '), /offers, as an option to pick, a step order the brief never gave/);
});

test('docs: a real answer is confirmed (§2b is the one rule); scope waits for the md', () => {
  assert.doesNotMatch(flat('references/interview.md'), /default to `assumed`/);
  for (const p of ['references/interview.md', 'SKILL.md']) {
    assert.match(flat(p), /`scope` once requirements\.md exists; before that,? validate with `--json` only/, p);
  }
});

test('docs: frameworks never leave an asked feature open', () => {
  assert.doesNotMatch(flat('references/frameworks.md'), /becomes an open question/);
  assert.match(flat('references/frameworks.md'), /closes like every asked question/);
});

test('docs: after the page, one approval question; at the end, the handoff line', () => {
  const t = flat('references/interview.md');
  assert.match(t, /"Does the review page read like your document\?"/);
  assert.match(t, /"Approve: go on to requirements\.md and the readiness report"/);
  assert.match(t, /"Change something: say what in Other"/);
  assert.match(flat('SKILL.md'), /send requirements\.md and requirements\.json to the engineering team for the estimate/);
});

test('docs: branch labels are copied; the input assumptions stay word for word', () => {
  const t = flat('references/writing.md');
  assert.match(t, /A branch `label` is the input's own arrow text, copied; an arrow with no text has no `label`/);
  assert.match(t, /Every assumption the input lists is an ASM row, word for word, in the input's order/);
  assert.match(t, /even when it reads like a constraint/);
  assert.match(t, /leaves the page only when the PO picks to drop it/);
});

test('docs: an answered input assumption is accepted; dropping one is an option', () => {
  const w = flat('references/writing.md');
  assert.match(w, /Once the PO answers, the input row's status becomes `accepted`; its words stay\./);
  assert.match(w, /A question about an input assumption adds the option "Drop this assumption"; picking it sets that row's status to `resolved`\./);
  assert.match(flat('references/interview.md').split('## §2b')[1].split('## §3')[0], /"Drop this assumption"/);
});

test('docs: the review page asks nothing first; a change comes through Other or chat', () => {
  assert.doesNotMatch(flat('SKILL.md'), /Nothing else is asked/);
  assert.match(flat('SKILL.md'), /Nothing is asked before the page; it ends with the approval question \(interview\.md §8\)\./);
  assert.match(flat('references/interview.md'), /A change \(through Other, or in chat\) is a re-run/);
  assert.match(flat('references/review.md'), /Input assumptions \(source names an input file\) are verbatim: flag a problem, never reword them\./);
});

test('docs: step 11 ends with the handoff line', () => {
  const step = flat('SKILL.md').split('11. **Finish**')[1].split('## Review page')[0];
  const handoff = step.indexOf('send requirements.md and requirements.json to the engineering team');
  assert.ok(step.indexOf('review page') >= 0 && handoff > step.indexOf('review page'));
});

const pipeline = (pkg) => pkg.workflows.find((w) => w.name === 'Order pipeline');

test('the diagram: main row, then each branch under its parent', () => {
  const pkg = decided();
  pipeline(pkg).branches.push({ from: 'Short-pack alert', to: 'Cancel or substitute' });
  const html = pageHtml(pkg, DATE);
  for (const part of [
    '<div class="grid">',
    '<div class="step" style="grid-area:1/1">Order In</div>',
    '<div class="arrow" style="grid-area:1/2">→</div>',
    '<div class="step" style="grid-area:1/3">Pack</div>',
    '<div class="down" style="grid-area:2/3"><span class="lbl">can\'t fulfil</span></div>',
    '<div class="step alt" style="grid-area:3/3">Short-pack alert</div>',
    '<div class="down" style="grid-area:2/5"><span class="lbl">mismatch</span></div>',
    '<div class="step back" style="grid-area:3/5">↺ back to Pack</div>',
    '<div class="down" style="grid-area:4/3"></div>',
    '<div class="step alt" style="grid-area:5/3">Cancel or substitute</div>',
  ]) assert.ok(html.includes(part), part);
  assert.doesNotMatch(html, /↳|row side|class="row"/);
});

test('two branches from one step sit side by side; the step spans them', () => {
  const pkg = decided();
  pipeline(pkg).branches.push({ from: 'Pack', to: 'Extra box', label: 'needs a box' });
  const html = pageHtml(pkg, DATE);
  for (const part of [
    '<div class="step wide" style="grid-area:1/3/auto/span 2">Pack</div>',
    '<div class="arrow" style="grid-area:1/5">→</div>',
    '<div class="step" style="grid-area:1/6">Pack Review</div>',
    '<div class="step alt" style="grid-area:3/3">Short-pack alert</div>',
    '<div class="down" style="grid-area:2/4"><span class="lbl">needs a box</span></div>',
    '<div class="step alt" style="grid-area:3/4">Extra box</div>',
    '<div class="step back" style="grid-area:3/6">↺ back to Pack</div>',
  ]) assert.ok(html.includes(part), part);
});

test('a child listed before its parent is drawn one level below it', () => {
  const pkg = decided();
  pipeline(pkg).branches.unshift({ from: 'Short-pack alert', to: 'Cancel or substitute' });
  const html = pageHtml(pkg, DATE);
  assert.ok(html.includes('<div class="step alt" style="grid-area:3/3">Short-pack alert</div>'));
  assert.ok(html.includes('<div class="step alt" style="grid-area:5/3">Cancel or substitute</div>'));
});

test('a cycle between two branch boxes draws each once, under the first step', () => {
  const pkg = decided();
  pipeline(pkg).branches.push({ from: 'Loop B', to: 'Loop A' }, { from: 'Loop A', to: 'Loop B' });
  const html = pageHtml(pkg, DATE);
  assert.ok(html.includes('<div class="step alt" style="grid-area:3/1">Loop A</div>'));
  assert.ok(html.includes('<div class="step alt" style="grid-area:5/1">Loop B</div>'));
  assert.equal(html.split('>Loop A<').length, 2);
  assert.equal(html.split('>Loop B<').length, 2);
});
