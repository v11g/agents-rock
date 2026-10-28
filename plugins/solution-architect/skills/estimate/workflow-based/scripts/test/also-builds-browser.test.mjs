import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';
import { reviewPage, componentsPage } from './stage.mjs';

const skip = !findChrome();
const settle = () => new Promise((r) => setTimeout(r, 1500));
// office builds FEAT-001, 003, 005; adding 002 and 004 gives FEAT-001's row 4 others
const wide = (i) => {
  const office = i.components.find((c) => c.id === 'office');
  office.builds.push({ feature: 'FEAT-002', why: 'a' }, { feature: 'FEAT-004', why: 'b' });
  office.tasks[0].features.push('FEAT-002', 'FEAT-004');
};

const one = (i) => i.components.find((c) => c.id === 'office').builds.push({ feature: 'FEAT-002', why: 'a' });

const ROW = `document.querySelector('[data-builtby="FEAT-001"] [data-comp-chip="office"] .calso')`;
const shown = (page) => page.eval(`[...${ROW}.querySelectorAll('.cmini')].filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.dataset.capChip)`);
const button = (page) => page.eval(`(() => { const b = ${ROW}.querySelector('[data-also-more]'); return b && { text: b.textContent, open: b.getAttribute('aria-expanded') }; })()`);
const toggle = (page) => page.eval(`${ROW}.querySelector('[data-also-more]').click()`);
const pinned = (page) => page.eval(`!document.getElementById('pinbar').classList.contains('hide')`);

async function foldsAndUnfolds(url) {
  const page = await openPage(url);
  try {
    await settle();
    assert.deepEqual(await shown(page), ['FEAT-003']);
    assert.deepEqual(await button(page), { text: '…3 more', open: 'false' });
    await toggle(page);
    assert.deepEqual(await shown(page), ['FEAT-003', 'FEAT-005', 'FEAT-002', 'FEAT-004']);
    assert.deepEqual(await button(page), { text: 'show less', open: 'true' });
    assert.equal(await pinned(page), false);
    await toggle(page);
    assert.deepEqual(await shown(page), ['FEAT-003']);
    assert.deepEqual(await button(page), { text: '…3 more', open: 'false' });
    assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
}

test('score review: 3+ other features fold behind "…N more" and unfold', { skip }, () => foldsAndUnfolds(reviewPage(wide)));

test('estimate (component-based): the same fold', { skip }, () => foldsAndUnfolds(componentsPage(wide)));

test('two other features show both chips and no button', { skip }, async () => {
  const page = await openPage(reviewPage());
  try {
    await settle();
    assert.deepEqual(await shown(page), ['FEAT-003', 'FEAT-005']);
    assert.equal(await button(page), null);
    assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
});

test('exactly three other features: one chip and "…2 more"', { skip }, async () => {
  const page = await openPage(reviewPage(one));
  try {
    await settle();
    assert.deepEqual(await shown(page), ['FEAT-003']);
    assert.deepEqual(await button(page), { text: '…2 more', open: 'false' });
    assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
});
