import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';
import { readZip } from '../../../classic/scripts/test/zip.mjs';
import { staged } from './stage.mjs';

const skip = !findChrome();
const settle = () => new Promise((r) => setTimeout(r, 1500));
const renderer = fileURLToPath(new URL('../render.mjs', import.meta.url));
function pages(mutate, edit) {
  const dir = staged(mutate);
  if (edit) edit(dir);
  execFileSync('node', [renderer, '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json'), '--out', join(dir, 'dist')]);
  return (name) => pathToFileURL(join(dir, 'dist', name)).href;
}
const text = (page, sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).textContent`);

test('Workflow-based page: price, milestones, register, Method visible, no errors', { skip }, async () => {
  const page = await openPage(pages()('estimate.html'));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.match(await text(page, '#headline'), /\$39,000 – \$48,500/);
    assert.equal(await page.eval(`document.querySelectorAll('#ms .m').length`), 3);
    assert.equal(await page.eval(`document.querySelectorAll('#exclude li').length`), 2);
    assert.notEqual(await page.eval(`getComputedStyle(document.getElementById('method')).display`), 'none');
    assert.match(await text(page, '#subline'), /2 systems · 5 features/);
  } finally { await page.close(); }
});

test('prices carry the currency code when it is not USD', { skip }, async () => {
  const page = await openPage(pages((i) => { i.currency = 'SGD'; })('estimate.html'));
  try {
    await settle();
    assert.match(await text(page, '#headline'), /SGD 39,000 – SGD 48,500/);
  } finally { await page.close(); }
});

test('Component-based page: read-only, tasks with hours, no errors', { skip }, async () => {
  const page = await openPage(pages()('estimate-components.html'));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('.pick button').length`), 0);
    assert.equal(await page.eval(`getComputedStyle(document.querySelector('.bar')).display`), 'none');
    assert.match(await text(page, '#headline'), /\$39,000 – \$48,500/);
    assert.match(await page.eval(`document.body.textContent`), /Three-way match/);
  } finally { await page.close(); }
});

async function exportedWorkbook(url) {
  const page = await openPage(url);
  try {
    await settle();
    return Buffer.from(await page.eval('window.__buildWorkbook()'), 'base64');
  } finally { await page.close(); }
}

test('the workbook export: rows grouped by system, SYSTEM / MODULE in A, 8 tasks, familiarity level 1', { skip }, async () => {
  const files = readZip(await exportedWorkbook(pages()('estimate-components.html')));
  const sheet = (n) => files.get(`xl/worksheets/${n}`).toString('utf8');
  const inline = (ref, text) => new RegExp(`<c r="${ref}"[^>]*t="inlineStr"><is><t>${text}</t>`);
  assert.match(sheet('sheet2.xml'), inline('A7', 'Warehouse operations'));
  assert.match(sheet('sheet2.xml'), inline('B7', 'Order pipeline &amp; stage engine'));
  assert.match(sheet('sheet2.xml'), inline('B8', 'Short-pack alert'));
  assert.match(sheet('sheet2.xml'), inline('A9', 'Orders &amp; invoicing'));
  assert.match(sheet('sheet2.xml'), /<c r="H7"[^>]*><f[^>]*>[^<]*SUMPRODUCT/); // the export keeps a live formula
  ['MILESTONE', 'CONTAINER', 'WHY THIS TIER'].forEach((h, i) => assert.match(sheet('sheet2.xml'), inline(`${'OPQ'[i]}6`, h)));
  assert.equal((sheet('sheet6.xml').match(/<row r=/g) ?? []).length, 9); // header + 8 tasks
  assert.match(sheet('sheet5.xml'), /<c r="C12"[^>]*><v>1<\/v>/); // stackFamiliarity
  assert.match(files.get('xl/workbook.xml').toString('utf8'), /Task Breakdown[\s\S]*Score Rationale|Score Rationale[\s\S]*Task Breakdown/);
});

test('download xlsx starts the download, then reminds to review the Project Roll-up tab', { skip }, async () => {
  const page = await openPage(pages()('estimate-components.html'));
  try {
    await settle();
    await page.eval('window.__downloadXlsx = () => { window.__dl = 1; }');
    await page.eval(`document.getElementById('xlsx').click()`);
    assert.equal(await page.eval('window.__dl'), 1);
    assert.equal(await page.eval(`document.getElementById('xlsx-remind').open`), true);
    assert.equal(await page.eval(`document.getElementById('xlsx-remind').getAttribute('aria-labelledby')`), 'xlsx-remind-title');
    assert.equal(await text(page, '#xlsx-remind-title'), 'Review the Project Roll-up tab');
    assert.match(await text(page, '#xlsx-remind'), /Review the Project Roll-up tab[\s\S]*Project Roll-up, sets the project context levels/);
    await page.eval(`[...document.querySelectorAll('#xlsx-remind button')].find((b) => b.textContent === 'Got it').click()`);
    assert.equal(await page.eval(`document.getElementById('xlsx-remind').open`), false);
    assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
});

// The template's own sample register text sits in shared strings; once our
// rows replace it, no Roll-up cell may still point at one of those strings.
function rollupOf(files) {
  const strings = [...files.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1]);
  const xml = files.get('xl/worksheets/sheet5.xml').toString('utf8');
  const cell = (ref) => new RegExp(`<c r="${ref}"[^>]*?(?:/>|>([\\s\\S]*?)</c>)`).exec(xml)?.[1] ?? '';
  const shared = (needle) => strings.findIndex((x) => x.includes(needle));
  return { xml, cell, shared };
}

test('the workbook carries the project name, assumptions and exclusions', { skip }, async () => {
  const files = readZip(await exportedWorkbook(pages()('estimate-components.html')));
  assert.match(files.get('xl/worksheets/sheet2.xml').toString('utf8'), /<c r="C3"[^>]*t="inlineStr"><is><t>sin-kowa-mini<\/t>/);
  const { xml, cell, shared } = rollupOf(files);
  assert.equal(cell('B61'), '<is><t>InvoiceNow is a data model only, with no live connection</t></is>');
  assert.equal(cell('B63'), '');
  assert.equal(cell('B70'), '<is><t>last-mile delivery tracking</t></is>');
  assert.equal(cell('B71'), '<is><t>Hosting and third-party subscription fees</t></is>');
  assert.equal(cell('B72'), '');
  const sample = shared('Native mobile applications');
  assert.ok(sample >= 0, 'the template sample text moved; update this test');
  assert.doesNotMatch(xml, new RegExp(`t="s"[^>]*><v>${sample}</v>`));
});

test('more exclusions than slots: the last slot holds the rest', { skip }, async () => {
  const more = (i) => { i.exclusions = Array.from({ length: 9 }, (_, n) => `extra ${n + 1}`); };
  const { cell } = rollupOf(readZip(await exportedWorkbook(pages(more)('estimate-components.html'))));
  assert.equal(cell('B77'), '<is><t>extra 7</t></is>');
  assert.equal(cell('B78'), '<is><t>Also: extra 8; extra 9</t></is>');
});

// LibreOffice recalculates the exported workbook (it carries no cached
// values); the Roll-up's range to present must be the page's price.
const noOffice = spawnSync('soffice', ['--version'], { stdio: 'ignore' }).status !== 0;
function recalculated(bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-recalc-'));
  writeFileSync(join(dir, 'in.xlsx'), bytes);
  execFileSync('soffice', [`-env:UserInstallation=${pathToFileURL(join(dir, 'profile')).href}`, '--headless',
    '--convert-to', 'xlsx', '--outdir', join(dir, 'out'), join(dir, 'in.xlsx')], { stdio: 'ignore', timeout: 120000 });
  return readZip(readFileSync(join(dir, 'out', 'in.xlsx')));
}

test('recalculated in LibreOffice, the Roll-up range to present equals estimation.json', { skip: skip || noOffice }, async () => {
  const dir = staged();
  execFileSync('node', [renderer, '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json'), '--out', join(dir, 'dist')]);
  const rollup = recalculated(await exportedWorkbook(pathToFileURL(join(dir, 'dist', 'estimate-components.html')).href))
    .get('xl/worksheets/sheet5.xml').toString('utf8');
  const value = (ref) => Number(new RegExp(`<c r="${ref}"[^>]*>(?:<f[^>]*>[^<]*</f>)?<v>([^<]*)</v>`).exec(rollup)?.[1]);
  const { presentLow, presentHigh } = JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8')).computed.price;
  assert.deepEqual([value('C56'), value('D56')], [presentLow, presentHigh]);
});

test('a milestone chip whose feature is in no system hovers without errors', { skip }, async () => {
  const unsystem = (dir) => {
    const file = join(dir, 'requirements.json');
    const req = JSON.parse(readFileSync(file, 'utf8'));
    req.systems.forEach((s) => { s.features = s.features.filter((f) => f !== 'FEAT-005'); });
    writeFileSync(file, JSON.stringify(req));
    execFileSync('node', [fileURLToPath(new URL('../compute.mjs', import.meta.url)), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  };
  const page = await openPage(pages(null, unsystem)('estimate.html'));
  try {
    await settle();
    assert.equal(await page.eval(`document.querySelectorAll('.chip[data-f="FEAT-005"]').length`), 1);
    await page.eval(`document.querySelector('.chip[data-f="FEAT-005"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`);
    assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
});
