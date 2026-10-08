import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { noFlowsAt } from './stage.mjs';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';

const script = fileURLToPath(new URL('../score-review.mjs', import.meta.url));
const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const skip = !findChrome();

function buildPage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-page-'));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  if (mutate) mutate(inputs);
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  execFileSync('node', [script, '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  return pathToFileURL(join(dir, 'review.html')).href;
}

const settle = () => new Promise((r) => setTimeout(r, 1500));
// The lock lives in the Review & send dialog: opening it sets Copy feedback's state.
const sendLocked = (page) => page.eval(`(() => { document.getElementById('preview').click(); const d = document.getElementById('copy').disabled; document.getElementById('dlg').close(); return d; })()`);
const count = (page) => page.eval(`[...document.querySelectorAll('[id^="c-FEAT"]:not(.hide)')].length`);

test('renders five cards, no console errors, send unlocked', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await count(page), 5);
    assert.equal(await sendLocked(page), false);
    assert.match(await page.eval(`document.getElementById('subcount').textContent`), /5 features in 2 systems, built by 7 components/);
  } finally { await page.close(); }
});

test('an unbuilt feature locks send; its ask unlocks it', { skip }, async () => {
  const page = await openPage(buildPage((i) => { i.components.find((c) => c.id === 'worker.drafter').builds = []; }));
  try {
    await settle();
    assert.equal(await sendLocked(page), true);
    await page.eval(`document.querySelector('[data-ask-btn="FEAT-004"]').click()`);
    await page.eval(`(() => { const t = document.querySelector('[data-ask="FEAT-004"]'); t.value = 'add a drafter'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    assert.equal(await sendLocked(page), false);
    const fb = await page.eval(`JSON.stringify(window.__feedback())`);
    assert.deepEqual(JSON.parse(fb).addComponent, [{ feature: 'FEAT-004', note: 'add a drafter' }]);
  } finally { await page.close(); }
});

test('opening a system switches the cards to that system', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    await page.eval(`document.querySelectorAll('details.capsys > summary')[1].click()`);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(await count(page), 3); // SYS-002: FEAT-003, FEAT-004, FEAT-005
    assert.equal(await page.eval(`document.querySelector('[data-cards="wf"]').getAttribute('aria-pressed')`), 'true');
    await page.eval(`document.querySelectorAll('details.capsys > summary')[1].click()`);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(await count(page), 5);
  } finally { await page.close(); }
});

test('a star-step feature and a system without sub-workflows render clean', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('details.capsys').length`), 2);
  } finally { await page.close(); }
});

test('a feature covering every step renders the "every step" chip, no errors', { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-star-'));
  const req = JSON.parse(readFileSync(fx('requirements.json'), 'utf8'));
  req.features[0].steps = ['*'];
  writeFileSync(join(dir, 'requirements.json'), JSON.stringify(req));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  execFileSync('node', [script, '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  const page = await openPage(pathToFileURL(join(dir, 'review.html')).href);
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.match(await page.eval(`document.querySelector('tr[data-cap="FEAT-001"]').textContent`), /every step/);
  } finally { await page.close(); }
});

test('prices are the shared featurePrice, never NaN', { skip }, async () => {
  const { featurePrice } = await import('../../../shared/lib/pricing.mjs');
  const page = await openPage(buildPage());
  try {
    await settle();
    assert.doesNotMatch(await page.eval('document.body.textContent'), /NaN/);
    const point = featurePrice({ tech: 3, size: 3, deps: 2, unc: 3, risk: 3 }).point;
    const want = `$${Math.round(2 * point).toLocaleString('en-US')}`; // SYS-001: FEAT-001 + FEAT-002
    assert.equal(await page.eval(`document.querySelector('[data-sub="SYS-001"] .side-score b').textContent`), want);
  } finally { await page.close(); }
});

test('architecture links come from the roster', { skip }, async () => {
  const page = await openPage(buildPage());
  try {
    await settle();
    const hrefs = await page.eval(`JSON.stringify([...document.querySelectorAll('#c-FEAT-001 a.archlink')].map((a) => a.getAttribute('href')))`);
    assert.deepEqual(JSON.parse(hrefs), ['index.html#panel-components-api', 'index.html#panel-containers']);
  } finally { await page.close(); }
});

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
