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
