import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };
const fixture = new URL('./fixtures/booking-inputs.json', import.meta.url).pathname;

function buildPage() {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-url-'));
  const scripts = new URL('..', import.meta.url).pathname;
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', fixture, '--out', join(dir, 'estimation.json')]);
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', join(dir, 'estimation.json'),
    '--md', join(scripts, 'test/fixtures/estimation-pass.md'), '--out', dir]);
  return pathToFileURL(join(dir, 'estimate.html')).href;
}

const pickOption = (key, value) => `(() => {
  const sel = document.querySelector('#feature-table select[data-select="${key}"]');
  sel.value = ${JSON.stringify(value)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
})()`;
const clickTab = (tab) => `document.querySelector('#feature-table [role="tab"][data-tab="${tab}"]').click()`;
const click = (sel) => `document.querySelector(${JSON.stringify(sel)}).click()`;
const featIds = `[...document.querySelectorAll('#panel-estimate tr.feat-row')].map((r) => r.dataset.id)`;
const params = async (page) => Object.fromEntries(
  new URLSearchParams(await page.eval('location.hash.slice(1)')));

test('an untouched breakdown leaves the URL clean', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.equal(await page.eval('location.hash'), '');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('every breakdown control writes itself into the URL', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(clickTab('scoring'));
    assert.deepEqual(await params(page), { tab: 'scoring' });
    await page.eval(pickOption('milestone', 'M2 - Notifications'));
    await page.eval(click('#feature-table button[data-expand="all"]'));
    await page.eval(click('#panel-scoring th button[data-sort="tier"]'));
    assert.deepEqual(await params(page), {
      tab: 'scoring', ms: 'M2 - Notifications', open: 'all', sort: 'scoring:tier:1',
    });
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('a shared URL reopens the same filtered breakdown', skip, async () => {
  const url = `${buildPage()}#tab=scoring&ms=M2%20-%20Notifications&open=all&guide=0`;
  const page = await openPage(url);
  try {
    assert.equal(await page.eval(`document.querySelector('#panel-scoring').hidden`), false);
    assert.equal(await page.eval(
      `document.querySelector('#feature-table select[data-select="milestone"]').value`), 'M2 - Notifications');
    assert.deepEqual(await page.eval(
      `[...document.querySelectorAll('#panel-scoring tr.feat-row')].map((r) => r.dataset.id)`), ['reminders']);
    assert.equal(await page.eval(`document.querySelectorAll('#panel-scoring tr.rat-row').length`), 1);
    assert.equal(await page.eval(`document.querySelector('#feature-table details.guide').open`), false);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('a shared URL carries the grouping, the source and one named feature', skip, async () => {
  const url = `${buildPage()}#src=stated&group=1&open=booking&sort=estimate:name:1`;
  const page = await openPage(url);
  try {
    assert.deepEqual(await page.eval(featIds), ['booking']);
    assert.equal(await page.eval(
      `document.querySelector('#feature-table select[data-select="prov"]').value`), 'stated');
    assert.equal(await page.eval(
      `document.querySelectorAll('#panel-estimate tr.feat-row[data-id="booking"] + tr.task-row').length >= 1`), true);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

// A colleague's copy can hold different features. A filter naming something
// that copy has never heard of would empty the table with no hint why, so an
// unknown value is dropped rather than applied.
test('values the data does not know are dropped, not applied', skip, async () => {
  const url = `${buildPage()}#tab=nope&ms=M7%20-%20Ghost&ct=nowhere&open=missing&sort=estimate:bogus:1`;
  const page = await openPage(url);
  try {
    assert.equal(await page.eval(`document.querySelector('#panel-estimate').hidden`), false);
    assert.deepEqual(await page.eval(featIds), ['booking', 'reminders']);
    assert.equal(await page.eval(`document.querySelectorAll('#panel-estimate tr.task-row').length`), 0);
    // nothing survived, so the page is at its defaults — and says so
    assert.equal(await page.eval('location.hash'), '');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('clearing the filters clears the URL with them', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(pickOption('milestone', 'M2 - Notifications'));
    assert.deepEqual(await params(page), { ms: 'M2 - Notifications' });
    await page.eval(click('#feature-table button[data-clear]'));
    assert.equal(await page.eval('location.hash'), '');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

// Each tab owns its sort, so the URL has to carry them apart.
test('the two tabs keep separate sorts in the URL', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(click('#panel-estimate th button[data-sort="name"]'));
    await page.eval(clickTab('scoring'));
    await page.eval(click('#panel-scoring th button[data-sort="unc"]'));
    const hash = await page.eval('location.hash.slice(1)');
    const sorts = new URLSearchParams(hash).getAll('sort');
    assert.deepEqual(sorts.sort(), ['estimate:name:1', 'scoring:unc:1']);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

// Pasting a different hash into the address bar, and the back button, both
// arrive as a hashchange — the breakdown follows it.
test('the breakdown follows the URL when the hash changes', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`location.hash = 'ms=M1%20-%20Booking%20core'`);
    await page.eval(`new Promise((r) => setTimeout(r, 50))`);
    assert.deepEqual(await page.eval(featIds), ['booking']);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});
