import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from '../../../analyze-requirements/scripts/serve.mjs';
import { findFreePort } from '../../../analyze-requirements/scripts/lib/port.mjs';
import { computeEstimation } from '../lib/rollup.mjs';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';

const scripts = new URL('..', import.meta.url).pathname;
const fixture = join(scripts, 'test/fixtures/booking-inputs.json');
const passMd = join(scripts, 'test/fixtures/estimation-pass.md');
const skip = { skip: !findChrome() && 'no chrome on PATH' };

test('SKILL.md exists with hard rules and auto-trigger description', () => {
  const skill = readFileSync(new URL('../../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /^name: estimate$/m);
  assert.match(skill, /^description: .*(estimate|effort|quote)/m);
  assert.match(skill, /never `?0`?/);            // honesty rule stated
  assert.match(skill, /blanket/i);               // per-task multiplier rule stated
});

test('fixture flows compute → validate → render → serve', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-e2e-'));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', fixture, '--out', json]);
  execFileSync('node', [join(scripts, 'validate.mjs'), '--md', passMd, '--json', json]); // exit 0 or throws
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', json, '--md', passMd, '--out', dir]);
  const srv = await createServer({ dir, port: await findFreePort(4173) });
  try {
    const res = await fetch(`http://127.0.0.1:${srv.port}/estimate.html`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Booking App/);
  } finally { srv.close(); }
});

// Agentic fixture flows the same pipeline, plus the honesty gate: a vague
// range in the md must fail validate.mjs before it can ever reach render.mjs.
const agenticFixture = join(scripts, 'test/fixtures/agentic-inputs.json');
const agenticPassMd = join(scripts, 'test/fixtures/agentic-estimation-pass.md');
const measurementsFixture = join(scripts, 'test/fixtures/measurements.jsonl');

test('agentic fixture flows compute → validate → render, and a vague range is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-e2e-agentic-'));
  const inputs = JSON.parse(readFileSync(agenticFixture, 'utf8'));
  inputs.measurementsPath = measurementsFixture;
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));

  const json = join(dir, 'estimation.json');
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', inputsPath, '--out', json]);
  execFileSync('node', [join(scripts, 'validate.mjs'), '--md', agenticPassMd, '--json', json]); // exit 0 or throws
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', json, '--md', agenticPassMd, '--out', dir]);
  const html = readFileSync(join(dir, 'estimate.html'), 'utf8');
  assert.match(html, /Delivery: agentic/);

  const vagueMd = readFileSync(agenticPassMd, 'utf8')
    .replace(/(Delivery: agentic.*\n)/, '$1This will take 1–2 hours depending on complexity.\n');
  const vagueMdPath = join(dir, 'vague.md');
  writeFileSync(vagueMdPath, vagueMd);
  assert.throws(() => execFileSync('node', [join(scripts, 'validate.mjs'), '--md', vagueMdPath, '--json', json]));
});

// The workbook export (assets/estimate-template.html's __buildWorkbook) is
// deliberately left out of this check: it only runs inside a real page (it
// reads live DOM/table state), and the price cells it writes are formulas
// with their cached values stripped (dropCachedValues + recalcOnLoad) so
// Excel recomputes on open — there is no computed presentLow/presentHigh to
// read back from the raw xlsx bytes in Node.
test('the page and the proposal quote the same range', skip, async () => {
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  const estimation = computeEstimation(inputs);
  const { presentLow, presentHigh } = estimation.computed.price;

  const dir = mkdtempSync(join(tmpdir(), 'estimate-e2e-figures-'));
  const json = join(dir, 'estimation.json');
  writeFileSync(json, JSON.stringify(estimation));
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', json, '--md', passMd, '--out', dir]);

  // The presented range is formatted by the page's own client-side script,
  // not baked into the static file, so this must run the page in a browser
  // rather than grep the html text.
  const page = await openPage(pathToFileURL(join(dir, 'estimate.html')).href);
  try {
    const body = await page.eval('document.body.textContent');
    assert.ok(body.includes(presentLow.toLocaleString('en-US')), 'page range');
  } finally { page.close(); }

  const { deriveFigures } = await import(
    '../../../proposal/scripts/lib/figures.mjs'
  );
  const figures = deriveFigures(estimation);
  assert.equal(figures.cost.low, presentLow);
  assert.equal(figures.cost.high, presentHigh);
});

test('no duration survives anywhere in the pipeline', () => {
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  const json = JSON.stringify(computeEstimation(inputs));
  for (const gone of ['months', 'laborCost', 'toolingCost', 'totalCost', 'seniority', 'rate']) {
    assert.ok(!json.includes(`"${gone}"`), `${gone} still present in estimation.json`);
  }
});
