import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../../solution-architect/skills/analyze-requirements/scripts/lib/cdp.mjs';
import { pageHtml } from '../lib/review-page.mjs';
import { DATE, decided } from './review-fixture.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };

function open(pkg) {
  const file = join(mkdtempSync(join(tmpdir(), 'ba-review-browser-')), 'review.html');
  writeFileSync(file, pageHtml(pkg, DATE));
  return openPage(pathToFileURL(file).href);
}

test('the page draws with no script, no controls and no ids', skip, async () => {
  const page = await open(decided());
  try {
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('script, button, input, textarea, select').length`), 0);
    assert.equal(await page.eval(`/\\b(?:SYS|WF|FEAT|FR|BR|Q|ASM)-\\d{3}\\b/.test(document.body.innerText)`), false);
    assert.equal(await page.eval(`document.querySelectorAll('tr.new, li.new').length`), 2);
    assert.equal(await page.eval(`document.querySelectorAll('.flow').length`), 3);
  } finally { page.close(); }
});

test('markup in a name shows as text, never as html', skip, async () => {
  const pkg = decided();
  pkg.features[0].name = 'Order <b>pipeline</b> & "stage"';
  const page = await open(pkg);
  try {
    assert.equal(await page.eval(`document.querySelector('td').textContent`), 'Order <b>pipeline</b> & "stage"');
    assert.equal(await page.eval(`document.querySelectorAll('td b').length`), 0);
  } finally { page.close(); }
});

test('a side branch sits under the step it leaves', skip, async () => {
  const page = await open(decided());
  const mid = (t) => `(() => { const e = [...document.querySelectorAll('.step')].find((x) => x.textContent === ${JSON.stringify(t)}); const r = e.getBoundingClientRect(); return r.left + r.width / 2; })()`;
  try {
    assert.ok(Math.abs(await page.eval(mid('Short-pack alert')) - await page.eval(mid('Pack'))) <= 1);
    assert.ok(Math.abs(await page.eval(mid('↺ back to Pack')) - await page.eval(mid('Pack Review'))) <= 1);
  } finally { page.close(); }
});

test('a step box fills its column, so arrows stay next to it', skip, async () => {
  const page = await open(decided());
  const box = (t) => `[...document.querySelectorAll('.step')].find((x) => x.textContent === ${JSON.stringify(t)}).getBoundingClientRect()`;
  const arrow = `document.querySelector('.arrow').getBoundingClientRect()`;
  try {
    assert.ok(Math.abs(await page.eval(`${box('Order In')}.right - ${arrow}.left`)) <= 1);
    assert.ok(Math.abs(await page.eval(`${arrow}.right - ${box('Pack')}.left`)) <= 1);
  } finally { page.close(); }
});

test('main-row arrows and branch connectors are drawn the same way', skip, async () => {
  const page = await open(decided());
  const css = (sel, pseudo, prop) => `getComputedStyle(document.querySelector(${JSON.stringify(sel)}), ${JSON.stringify(pseudo)}).${prop}`;
  try {
    const px = (sel, pseudo, prop) => page.eval(css(sel, pseudo, prop));
    assert.equal(await px('.arrow', '::before', 'height'), '1px');
    assert.equal(await px('.down', '::before', 'width'), '1px');
    const dotted = await px('.down', '::before', 'backgroundImage');
    assert.ok(dotted.includes(await px('.arrow', '::before', 'backgroundColor')));
    assert.ok(dotted.includes('repeating-linear-gradient'));
    assert.equal(await px('.arrow', '::after', 'borderLeftColor'), await px('.down', '::after', 'borderTopColor'));
    assert.equal(await px('.arrow', '::after', 'borderLeftWidth'), '7px');
    assert.equal(await px('.down', '::after', 'borderTopWidth'), '7px');
    assert.equal(await page.eval(`document.querySelector('.arrow').getBoundingClientRect().height < 20`), true);
  } finally { page.close(); }
});

test('two branches from one step sit side by side under it; labels stay in their column', skip, async () => {
  const pkg = decided();
  const flow = pkg.workflows.find((w) => w.name === 'Order pipeline');
  flow.branches[0].label = 'cannot fulfil the whole order from stock';
  flow.branches.push({ from: 'Pack', to: 'Extra box', label: 'customer asked for one more box' });
  const page = await open(pkg);
  const rect = (sel, t) => `(() => { const r = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent === ${JSON.stringify(t)}).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`;
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  try {
    const [pack, one, two] = [await page.eval(rect('.step', 'Pack')), await page.eval(rect('.step', 'Short-pack alert')), await page.eval(rect('.step', 'Extra box'))];
    const [l1, l2] = [await page.eval(rect('.lbl', flow.branches[0].label)), await page.eval(rect('.lbl', 'customer asked for one more box'))];
    assert.ok(Math.abs(one.t - two.t) <= 1, 'siblings share a row');
    assert.ok(!hit(one, two) && !hit(l1, l2) && !hit(l1, two) && !hit(l2, one));
    for (const s of [one, two]) assert.ok((s.l + s.r) / 2 >= pack.l && (s.l + s.r) / 2 <= pack.r);
  } finally { page.close(); }
});

test('a main step fills a column widened by a long branch box, so no arrow has a gap', skip, async () => {
  const pkg = decided();
  const flow = pkg.workflows.find((w) => w.name === 'Order pipeline');
  flow.branches.push({ from: 'Order In', to: 'Escalate to the duty manager for a manual decision', label: 'unclear' });
  const page = await open(pkg);
  const gaps = `(() => { const g = document.querySelector('.grid'); const out = [];
    for (const a of g.querySelectorAll('.arrow')) { const p = a.previousElementSibling.getBoundingClientRect(); const n = a.nextElementSibling.getBoundingClientRect(); const r = a.getBoundingClientRect(); out.push(Math.max(Math.abs(p.right - r.left), Math.abs(r.right - n.left))); }
    return out; })()`;
  try {
    const found = await page.eval(gaps);
    assert.ok(found.length > 0 && found.every((d) => d <= 1), `gaps: ${found}`);
  } finally { page.close(); }
});
