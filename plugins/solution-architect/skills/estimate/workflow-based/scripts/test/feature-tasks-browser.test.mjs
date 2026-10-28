import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';
import { componentsPage } from './stage.mjs';

const skip = !findChrome();
const settle = () => new Promise((r) => setTimeout(r, 1500));
// stage-engine serves FEAT-001 and FEAT-002; stage-tests moves to FEAT-002 only
const split = (i) => { i.components.find((c) => c.id === 'api.stage').tasks[1].features = ['FEAT-002']; };

const STAGE = (cap) => `[...document.querySelectorAll('#c-${cap} details.tasks')].find((d) => d.querySelector('summary').textContent.startsWith('Stage Engine'))`;
const taskNames = (page, cap) => page.eval(`[...${STAGE(cap)}.querySelectorAll('tr td:first-child')].map((td) => td.firstChild.textContent)`);
const firstRow = (page, cap) => page.eval(`${STAGE(cap)}.querySelector('tr td:first-child').textContent`);
const hrs = (s) => Number(s.replace(/[,h]/g, ''));
const cardSum = (page) => page.eval(`[...document.querySelectorAll('[data-hrs]')].map((b) => b.textContent)`);
const total = (page) => page.eval(`[...document.querySelectorAll('#strip div')].find((d) => d.textContent.includes('expected effort')).querySelector('b').textContent`);

test('a feature card lists only the tasks that serve it; card hours add up to the total', { skip }, async () => {
  const page = await openPage(componentsPage(split));
  try {
    await settle();
    assert.deepEqual(await taskNames(page, 'FEAT-001'), ['Stage transitions with audit']);
    assert.deepEqual(await taskNames(page, 'FEAT-002'), ['Stage transitions with audit', 'Transition tests']);
    assert.match(await firstRow(page, 'FEAT-002'), /shared with FEAT-001/);
    const sum = (await cardSum(page)).reduce((n, s) => n + hrs(s), 0);
    assert.ok(Math.abs(sum - hrs(await total(page))) <= 5, `cards ${sum}h vs total ${await total(page)}`);
    assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
});
