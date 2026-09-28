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
// shape depends on an optional input (recommendedReason, the expose flag).
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

// The data island is the only place a rendered page states a number: every
// section is drawn in the browser from this blob, so a test about what the
// page carries reads it here rather than pattern-matching template source.
function embedded(html) {
  return JSON.parse(html.match(/<script type="application\/json" id="estimation-data">([\s\S]*?)<\/script>/)[1]);
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
  assert.deepEqual([...new Set(markers)], ['DATA', 'FONTS', 'GUIDE', 'TITLE', 'VIEWER']);
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
  // No formula is inlined any more: the page reads committed numbers only.
  assert.doesNotMatch(html, /function pert\(/);
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

// The page's one headline is the price, and it is the price the roll-up
// committed — the summary reads computed.price and nothing else. Durations
// are checked over the whole file (minus HTML comments, so a commented-out
// month would not pass) because nothing in the model produces one any more.
test('the page carries the price block and no duration anywhere', () => {
  const html = renderedPage();
  const { price, roadmap } = embedded(html).computed;
  assert.deepEqual(
    [price.presentLow, price.presentHigh, price.singleNumber, price.contingencyRate],
    [10000, 14000, 12000, 0.15]);
  // the retired key was one level up, computed.scenarios, not computed.price.scenarios —
  // breaks if rollup.mjs/project-price.mjs ever puts a scenarios key back on computed
  assert.equal(embedded(html).computed.scenarios, undefined);
  assert.ok(roadmap.length > 0);
  assert.ok(!/month/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'no durations anywhere');
});

// The roadmap is milestone shares of total effort. The percentages the page
// draws are checked in browser.test.mjs; here the shares must reach the page
// attached to the milestone they size.
test('the roadmap travels as milestone shares, not month bands', () => {
  const { roadmap } = embedded(renderedPage()).computed;
  assert.deepEqual(roadmap.map((b) => [b.milestone, b.share]),
    [['M1 - Booking core', 0.76], ['M2 - Notifications', 0.24]]);
  for (const band of roadmap) {
    assert.equal(band.startMonths, undefined);
    assert.equal(band.endMonths, undefined);
  }
});

// proposal-figures.json carries a cost range and a single number; it carries
// no duration, so neither does the line the page draws from it.
test('--figures adds the client-facing range; without it there is none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-figures-'));
  const figures = join(dir, 'proposal-figures.json');
  writeFileSync(figures, JSON.stringify({
    cost: { low: 5000, high: 7000 }, singleNumber: 6500,
    milestones: [{ name: 'M1 - Booking core', share: 0.76 }],
  }));
  const withRange = renderedPage(['--figures', figures]);
  assert.deepEqual(embedded(withRange).figures,
    { cost: { low: 5000, high: 7000 }, singleNumber: 6500 });
  const without = renderedPage();
  assert.equal(embedded(without).figures, undefined);
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

// exposeRatesToClient gates the pricing working: the context multiplier, the
// overhead lines, the adjusted base, and each feature's tier and price band.
//
// Bare identifiers, not quoted JSON keys, for everything the page names only
// while drawing the working — the renderer for it lives inside an
// internal:start/end block, so a client file carries these in neither its data
// nor its code, captions included. `Tier Reference` is that block's caption
// and is checked the same way.
const BARE_INTERNALS = ['contextMultiplier', 'adjustedBase', 'featurePoints', 'priceLow', 'priceHigh', 'Tier Reference'];
// `overheads` is the one exception: the Method section explains in prose that
// overheads are loaded onto the base, and that sentence is client-facing. Only
// the numbers behind it are internal, so this one is matched as a quoted JSON
// key — the form that still fails if redact.mjs stops stripping the block.
const QUOTED_INTERNALS = [/"overheads":/, /"contextMultiplier":/, /"adjustedBase":/];

test('--client-only strips the pricing internals and keeps the presented range', () => {
  const internal = renderedPage();
  for (const field of BARE_INTERNALS) assert.ok(internal.includes(field), `internal render must carry ${field}`);
  for (const re of QUOTED_INTERNALS) assert.match(internal, re);

  const html = renderedPage(['--client-only']);
  for (const field of BARE_INTERNALS) assert.ok(!html.includes(field), `client view leaks ${field}`);
  for (const re of QUOTED_INTERNALS) assert.doesNotMatch(html, re);

  const { price } = embedded(html).computed;
  assert.deepEqual([price.presentLow, price.presentHigh, price.singleNumber], [10000, 14000, 12000]);
});

// The per-feature half of the same strip: the tier a feature landed in and
// the band it priced at are the working, not the quote.
test('--client-only strips each feature tier and price band', () => {
  const client = embedded(renderedPage(['--client-only'])).computed.features;
  assert.deepEqual(Object.keys(client).sort(), ['booking', 'reminders']);
  for (const f of Object.values(client)) {
    assert.deepEqual([f.tier, f.point, f.priceLow, f.priceHigh], [undefined, undefined, undefined, undefined]);
    assert.equal(typeof f.hours, 'number'); // delivery planning survives
    assert.equal(typeof f.scoreTotal, 'number'); // so does the score it was judged on
  }
});

// The cite is internal shorthand — ticket phrases, file names, meeting
// wording — so it never ships, rates opt-out or not. The anchor is the guide
// sentence the client can read, and it stays.
test('--client-only blanks the evidence cites and keeps the anchors', () => {
  const client = renderedPage(['--client-only']);
  assert.doesNotMatch(client, /slot conflict \+ cancellation rules/);
  assert.match(client, /Custom business logic, moderate algorithm complexity, multiple states/);
  assert.match(renderedPage(), /slot conflict \+ cancellation rules/);
});

test('--client-only keeps the pricing internals when exposeRatesToClient is true', () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-render-'));
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  inputs.exposeRatesToClient = true;
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', inputsPath, '--out', json]);
  execFileSync('node', [cli, '--json', json, '--md', passMd, '--out', dir, '--client-only']);
  const { computed } = embedded(readFileSync(join(dir, 'estimate.html'), 'utf8'));
  assert.equal(computed.price.contextMultiplier, 1.4);
  assert.equal(computed.price.overheads.totalPct, 0.56);
  assert.equal(computed.features.booking.tier, 'M');
  assert.equal(typeof computed.features.booking.priceLow, 'number');
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

// An agentic estimation scores nothing, so its features carry no tier and
// its price is all zeroes — but the price block itself still exists, and its
// working is stripped by the same rule as a team estimate's.
test('agentic client render strips the pricing internals too', () => {
  const full = renderAgentic();
  const fullPrice = embedded(full).computed.price;
  assert.equal(fullPrice.contextMultiplier, 1);
  assert.equal(typeof fullPrice.overheads.totalPct, 'number');

  const client = renderAgentic({ clientOnly: true });
  for (const field of ['contextMultiplier', 'overheads', 'adjustedBase', 'featurePoints']) {
    assert.ok(!client.includes(field), `agentic client view leaks ${field}`);
  }
  assert.equal(embedded(client).computed.price.presentLow, 0);
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

test('the page never derives scores and carries the guide from the reference file', () => {
  const html = renderedPage();
  for (const gone of ['deriveScores', 'TECH_CATEGORY_SCORE', 'scoreTier', 'SCORE_GUIDE', 'bdModePill', 'bdMode(', 'derived:']) {
    assert.equal(html.includes(gone), false, `${gone} must not be in the page`);
  }
  assert.match(html, /<template id="scoring-guide"><table class="guide-table">/);
  assert.ok(html.includes('Payments, auth, data migrations, or PII — high business impact'));
});

test('the agentic page has no guide slot', () => {
  const html = renderAgentic();
  assert.doesNotMatch(html, /scoring-guide/);
});
