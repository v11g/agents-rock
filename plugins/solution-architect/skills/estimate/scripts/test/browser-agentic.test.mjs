import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };
const fixture = new URL('./fixtures/agentic-inputs.json', import.meta.url).pathname;
const passMd = new URL('./fixtures/agentic-estimation-pass.md', import.meta.url).pathname;
const measurementsFixture = new URL('./fixtures/measurements.jsonl', import.meta.url).pathname;

// Agentic estimation.json never carries scenarios or months (schema.mjs
// refuses `scenarios` outright), so this is the browser-level guard the
// team fixture already gets in browser.test.mjs: build the page, actually
// open it in Chrome and read the DOM, rather than pattern-matching template
// source or the embedded JSON blob the way render.test.mjs does.
function buildPage(extra = [], mutate = () => {}, mdExtra = '') {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-browser-agentic-'));
  const scripts = new URL('..', import.meta.url).pathname;
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  inputs.measurementsPath = measurementsFixture;
  mutate(inputs);
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));
  const json = join(dir, 'estimation.json');
  const md = join(dir, 'estimation.md');
  writeFileSync(md, readFileSync(passMd, 'utf8') + mdExtra);
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', inputsPath, '--out', json]);
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', json, '--md', md, '--out', dir, ...extra]);
  return pathToFileURL(join(dir, 'estimate.html')).href;
}

// HTML comments are stripped before the "no month" check the same way
// render.test.mjs's byte-level check does — a commented-out Gantt renderer
// would otherwise pass this dishonestly.
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

// The binding user decision: agentic mode is not priced, and the page must
// never present a bare zero as if it were a quote. R50 keys this off
// computed.price.p50 === 0, which every agentic estimate hits today (no
// feature ever carries a score under this model).
async function assertUnpriced(page) {
  assert.deepEqual(page.errors, []);
  assert.match(await page.eval(`document.querySelector('#summary .lead')?.textContent`), /not priced/i);
  assert.match(await page.eval(`document.querySelector('#summary .figures')?.textContent`), /\d+(\.\d+)? h$/);
  const body = await page.eval(`document.body.textContent`);
  assert.doesNotMatch(body, /\$0\b/);
  assert.doesNotMatch(stripComments(body), /month/i);
}

test('the agentic page renders measured hours and states plainly it is not priced', skip, async () => {
  const page = await openPage(buildPage());
  try { await assertUnpriced(page); } finally { page.close(); }
});

test('the --client-only agentic page renders the same unpriced state without throwing', skip, async () => {
  const page = await openPage(buildPage(['--client-only']));
  try { await assertUnpriced(page); } finally { page.close(); }
});

// redact.mjs strips a task's provenance/assumptions (R49) and an evidence
// entry's description (R48) from the client render — taskRow/renderEvidence
// must not throw or print "undefined" once those keys are gone.
test('the client-only page tolerates redacted task fields without throwing', skip, async () => {
  const page = await openPage(buildPage(['--client-only']));
  try {
    assert.deepEqual(page.errors, []);
    assert.ok(await page.eval(`document.querySelectorAll('#detail tbody tr').length > 0`));
    assert.doesNotMatch(await page.eval(`document.getElementById('detail').textContent`), /undefined/);
    assert.doesNotMatch(await page.eval(`document.getElementById('evidence').textContent`), /undefined/);
  } finally { page.close(); }
});

// Milestone-tagged features do exist for agentic estimations even though the
// shared fixture carries none — the roadmap must draw the same share-of-effort
// bars the team page does, not the retired month Gantt.
const ROADMAP_MD = `
### Roadmap

Bands are relative shares of total effort, not durations.

| Milestone | Share |
| --- | --- |
| M1 - Plan | 50% |
| M2 - Swap | 50% |
`;

test('a milestone-tagged agentic estimate draws share-based roadmap bars, not months', skip, async () => {
  const page = await openPage(buildPage([], (inputs) => {
    inputs.features[0].milestone = 'M1 - Plan';
    inputs.features[1].milestone = 'M2 - Swap';
  }, ROADMAP_MD));
  try {
    assert.deepEqual(page.errors, []);
    const shares = await page.eval(`[...document.querySelectorAll('#roadmap .roadmap-share')].map((s) => s.textContent)`);
    assert.equal(shares.length, 2);
    assert.ok(shares.every((s) => /%$/.test(s)), `expected percentages, got ${shares}`);
    assert.equal(await page.eval(`document.querySelector('#roadmap .roadmap-months')`), null);
    assert.doesNotMatch(await page.eval(`document.getElementById('roadmap').textContent`), /\bmo\b/);
  } finally { page.close(); }
});
