import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inlineModule, extractExports, stripInternal } from '../lib/inline.mjs';

const tpl = () => readFileSync(new URL('../../assets/estimate-template.html', import.meta.url), 'utf8');
const cli = new URL('../render.mjs', import.meta.url).pathname;
const fixture = new URL('./fixtures/booking-inputs.json', import.meta.url).pathname;
const passMd = new URL('./fixtures/estimation-pass.md', import.meta.url).pathname;
const computeCli = new URL('../compute.mjs', import.meta.url).pathname;
const agenticFixture = new URL('./fixtures/agentic-inputs.json', import.meta.url).pathname;
const agenticPassMd = new URL('./fixtures/agentic-estimation-pass.md', import.meta.url).pathname;
const measurementsFixture = new URL('./fixtures/measurements.jsonl', import.meta.url).pathname;

function renderedPage(extra = []) {
  return renderWith(() => {}, extra);
}

// Same pipeline, with the booking inputs mutated first — for pages whose
// shape depends on the scenarios (one team vs several, AI-only variants).
function renderWith(mutate, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-render-'));
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  mutate(inputs);
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', inputsPath, '--out', json]);
  execFileSync('node', [cli, '--json', json, '--md', passMd, '--out', dir, ...extra]);
  return readFileSync(join(dir, 'estimate.html'), 'utf8');
}

// Agentic fixtures point measurementsPath at the shared fixture file, same
// as validate.test.mjs's agenticEstimation() helper.
function renderAgentic({ clientOnly = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-render-agentic-'));
  const inputs = JSON.parse(readFileSync(agenticFixture, 'utf8'));
  inputs.measurementsPath = measurementsFixture;
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', inputsPath, '--out', json]);
  execFileSync('node', [cli, '--json', json, '--md', agenticPassMd, '--out', dir, ...(clientOnly ? ['--client-only'] : [])]);
  return readFileSync(join(dir, 'estimate.html'), 'utf8');
}

test('render refuses a deliverable that fails validation', () => {
  const failMd = new URL('./fixtures/estimation-fail.md', import.meta.url).pathname;
  const dir = mkdtempSync(join(tmpdir(), 'estimate-render-'));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', fixture, '--out', json]);
  assert.throws(() => execFileSync('node', [cli, '--json', json, '--md', failMd, '--out', dir]));
});

test('template carries exactly the five slots and no external URLs', () => {
  const markers = [...tpl().matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(markers)], ['DATA', 'FONTS', 'MATH', 'TITLE', 'VIEWER']);
  // openxmlformats URIs are XML namespace identifiers the xlsx export writes
  // into generated sheets — never fetched, so the page stays self-contained.
  assert.doesNotMatch(tpl(), /https?:\/\/(?!www\.w3\.org|schemas\.openxmlformats\.org)/);
});

// Companion mode: the analyze-requirements viewer links this page, and this page links
// back. The href is caller-supplied because only the caller knows where the
// viewer was rendered; internal-only because a client file must not point at
// an internal document set.
test('--viewer adds an internal-only back-link; client-only strips it', () => {
  const withLink = renderedPage(['--viewer', '../viewer/index.html']);
  assert.match(withLink, /<a id="viewer-link" data-internal href="\.\.\/viewer\/index\.html">/);
  const without = renderedPage();
  assert.doesNotMatch(without, /<a id="viewer-link"/);
  const client = renderedPage(['--viewer', '../viewer/index.html', '--client-only']);
  assert.doesNotMatch(client, /<a id="viewer-link"/);
});

test('the --viewer href is attribute-escaped', () => {
  const html = renderedPage(['--viewer', '../a"b/index.html']);
  assert.match(html, /href="\.\.\/a&quot;b\/index\.html"/);
});

test('rendered page is self-contained and carries parseable data', () => {
  const html = renderedPage();
  assert.doesNotMatch(html, /<!-- slot:/);
  assert.match(html, /@font-face/);
  const data = html.match(/<script type="application\/json" id="estimation-data">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(data).inputs.project, 'Booking App');
  // Only pert() is inlined (task expected hours in the breakdown); the
  // scenario math stays in Node — every month and cost shown is committed.
  assert.match(html, /function pert\(/);
  assert.doesNotMatch(html, /function scenarioRollup\(|function taskHours\(/);
});

test('inlineModule strips export keywords; extractExports keeps only the named blocks', () => {
  assert.equal(inlineModule('export function f() {}\nexport const X = 1;\nconst y = 2;'),
    'function f() {}\nconst X = 1;\nconst y = 2;');
  assert.equal(extractExports('export const A = 1;\nexport function b() {\n  return A;\n}\nexport const C = 3;', ['b']),
    'export function b() {\n  return A;\n}');
});

test('the page carries a method section with source attributions', () => {
  const html = renderedPage();
  assert.match(html, /id="method"/);
  assert.match(html, /atomicobject\.com/); // sources cited in the page, not only in refs
  assert.match(html, /kmino\.io/);
});

test('the summary comes first and the method fold last — the number before the formula', () => {
  assert.match(tpl(), /<main>\s*<div class="col">\s*<section id="summary">/);
  assert.match(tpl(), /<section id="register"><\/section>\s*<section id="method"><\/section>\s*<\/div>\s*<\/main>/);
});

// The scenario cards, the cost bars and the what-if rail are gone: one
// Summary block states the recommended team, months and cost once.
test('the page has no scenario cards, cost bars or what-if rail', () => {
  const html = renderedPage();
  assert.doesNotMatch(html, /scenario-cards|cost-bars|ctl-|whatif|modified-banner|id="reset"/);
  assert.match(html, /id="summary"/);
});

test('the summary names the recommended team, its AI assistance, months and cost', () => {
  const html = renderedPage();
  // renderer source: the label rule, and the JSON it reads from
  assert.match(html, /humans unaided/);
  assert.match(html, /AI-assisted/);
  assert.match(html, /"recommendedScenario":"2eng-max5x"/);
});

// Only a different roster is an alternative worth a row; a same-team variant
// that differs in AI assistance collapses to one line.
test('renderer distinguishes team alternatives from AI-only variants', () => {
  const html = renderedPage();
  assert.match(html, /AI assistance: /);            // the collapsed same-team line
  assert.match(html, /<caption>Alternatives<\/caption>/); // the different-roster table
  assert.match(html, /function sameTeam|const sameTeam/);
});

test('--figures adds the client-facing range line; without it there is none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-figures-'));
  const figures = join(dir, 'proposal-figures.json');
  writeFileSync(figures, JSON.stringify({ scenario: '2eng-max5x', cost: { low: 5000, high: 7000 }, months: { low: 0.3, high: 0.5 } }));
  const withRange = renderedPage(['--figures', figures]);
  assert.match(withRange, /"figures":\{"cost":\{"low":5000,"high":7000\},"months":\{"low":0.3,"high":0.5\}\}/);
  const without = renderedPage();
  assert.doesNotMatch(without, /"figures":/);
});

test('recommendedReason travels with the data', () => {
  const html = renderWith((inputs) => { inputs.recommendedReason = 'client has one senior available'; });
  assert.match(html, /"recommendedReason":"client has one senior available"/);
});

test('the breakdown no longer carries a Range column', () => {
  assert.doesNotMatch(tpl(), /label: 'Range'/);
});

test('--client-only strips every internal range', () => {
  const html = renderedPage(['--client-only']);
  assert.doesNotMatch(html, /data-internal|internal:start|ctl-team/);
  assert.match(stripInternal('a<!-- internal:start -->X<!-- internal:end -->b'), /^ab$/);
});

test('--client-only redacts rates and cost breakdown unless exposeRatesToClient is set', () => {
  // Matched as quoted JSON keys, not bare identifiers: estimate-math.mjs is
  // inlined verbatim for the what-if engine and legitimately declares
  // `laborCost`/`toolingCost` as plain JS locals in every render, client or not.
  const html = renderedPage(['--client-only']);
  assert.doesNotMatch(html, /"rate":/);
  assert.doesNotMatch(html, /"laborCost":/);
  assert.doesNotMatch(html, /"toolingCost":/);
});

test('--client-only keeps rates when exposeRatesToClient is true', () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-render-'));
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  inputs.exposeRatesToClient = true;
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', inputsPath, '--out', json]);
  execFileSync('node', [cli, '--json', json, '--md', passMd, '--out', dir, '--client-only']);
  const html = readFileSync(join(dir, 'estimate.html'), 'utf8');
  assert.match(html, /"rate":/);
});

test('component data survives the client-only render', () => {
  // deliberate: names come from the architecture doc the client already sees;
  // costs stay redacted — the rollup shows hours/share only
  const client = renderedPage(['--client-only']);
  assert.match(client, /"components":/);
  assert.match(client, /"component":"api"/);
});

test('the rendered page carries the roadmap section markup', () => {
  const html = renderedPage();
  assert.match(html, /id="roadmap"/);
  assert.match(html, /roadmapRow|roadmap-row/); // renderer present, not stripped
});

// Agentic template routing.
test('agentic estimation renders the agentic template', () => {
  const html = renderAgentic();
  assert.match(html, /Delivery: agentic/);
  assert.match(html, /UNCALIBRATED/);
  assert.match(html, /Refactor A/); // evidence rendered from computed data
  assert.doesNotMatch(html, /boilerplate/); // no AI-category machinery on this page
});

test('agentic client render still redacts rates', () => {
  const html = renderAgentic({ clientOnly: true });
  assert.doesNotMatch(html, /"rate":/);
});

test('agentic client render strips the measurements path, repository, and evidence descriptions', () => {
  const full = renderAgentic();
  assert.match(full, new RegExp(measurementsFixture.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(full, /"repository":"project-a"/);
  assert.match(full, /Refactor A/);

  const client = renderAgentic({ clientOnly: true });
  assert.doesNotMatch(client, new RegExp(measurementsFixture.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(client, /"measurementsPath":/);
  assert.doesNotMatch(client, /"repository":/);
  assert.doesNotMatch(client, /Refactor A/);
  assert.doesNotMatch(client, />undefined</); // renderEvidence tolerates a stripped description
});
