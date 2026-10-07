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
