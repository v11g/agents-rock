import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';
import { reviewPage, componentsPage } from './stage.mjs';

const skip = !findChrome();
const settle = () => new Promise((r) => setTimeout(r, 1500));
const BOX = `document.querySelector('[data-lpick="FEAT-001"]')`;
const type = (page, q) => page.eval(`(() => { const i = ${BOX}.querySelector('input'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const key = (page, k) => page.eval(`${BOX}.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true }))`);
const options = (page) => page.eval(`[...${BOX}.querySelectorAll('.lpick-o')].map((o) => o.dataset.lpickId)`);
const current = (page) => page.eval(`${BOX}.querySelector('.lpick-o.lpick-cur')?.dataset.lpickId ?? null`);
const isOpen = (page) => page.eval(`!${BOX}.querySelector('.lpick-list').classList.contains('hide')`);
const builders = (page) => page.eval(`[...document.querySelectorAll('[data-builtby="FEAT-001"] [data-comp-chip]')].map((r) => r.dataset.compChip).sort()`);
const pinned = (page) => page.eval(`!document.getElementById('pinbar').classList.contains('hide')`);

async function onReview(fn) {
  const page = await openPage(reviewPage());
  try { await settle(); await fn(page); assert.deepEqual(page.errors, []); } finally { await page.close(); }
}

test('typing filters by component or container name; builders are left out', { skip }, () => onReview(async (page) => {
  assert.equal(await page.eval(`${BOX}.querySelector('input').placeholder`), '+ Link a component… type to filter');
  await type(page, 'BILL');
  assert.deepEqual(await options(page), ['api.billing']);
  assert.equal(await isOpen(page), true);
  await type(page, 'worker');
  assert.deepEqual((await options(page)).sort(), ['worker.drafter', 'worker.notify']);
  await type(page, 'stage');
  assert.deepEqual(await options(page), []);
  assert.match(await page.eval(`${BOX}.querySelector('.lpick-list').textContent`), /No component matches/);
  await type(page, '');
  assert.deepEqual((await options(page)).sort(), ['api.billing', 'api.orders', 'ops', 'worker.drafter', 'worker.notify']);
  assert.match(await page.eval(`${BOX}.querySelector('[data-lpick-id="ops"]').textContent`), /builds nothing yet/);
}));

test('arrows move the highlight, Enter links it, nothing gets pinned', { skip }, () => onReview(async (page) => {
  await type(page, 'worker');
  const [first, second] = await options(page);
  assert.equal(await current(page), first);
  await key(page, 'ArrowDown');
  assert.equal(await current(page), second);
  await key(page, 'ArrowUp');
  assert.equal(await current(page), first);
  await key(page, 'Enter');
  assert.deepEqual(await builders(page), ['api.stage', first, 'office'].sort());
  assert.equal(await pinned(page), false);
}));

const over = (page, sel) => page.eval(`${BOX}.querySelector('${sel}').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`);

test('hovering the card keeps the keyboard highlight; hovering an option moves it', { skip }, () => onReview(async (page) => {
  await type(page, 'worker');
  const [first, second] = await options(page);
  await over(page, 'input');
  await over(page, '.lpick-g');
  assert.equal(await current(page), first);
  await over(page, `[data-lpick-id="${second}"]`);
  assert.equal(await current(page), second);
  await key(page, 'Enter');
  assert.deepEqual(await builders(page), ['api.stage', second, 'office'].sort());
}));

test('a mouse pick links it and does not pin; Esc clears and closes', { skip }, () => onReview(async (page) => {
  await type(page, 'drafter');
  await page.eval(`${BOX}.querySelector('[data-lpick-id="worker.drafter"]').click()`);
  assert.deepEqual(await builders(page), ['api.stage', 'office', 'worker.drafter']);
  assert.equal(await pinned(page), false);
  await type(page, 'bill');
  await key(page, 'Escape');
  assert.equal(await isOpen(page), false);
  assert.equal(await page.eval(`${BOX}.querySelector('input').value`), '');
}));

test('the read-only Component-based page has no picker', { skip }, async () => {
  const page = await openPage(componentsPage());
  try {
    await settle();
    assert.equal(await page.eval(`document.querySelectorAll('.lpick, select[data-link]').length`), 0);
    assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
});
