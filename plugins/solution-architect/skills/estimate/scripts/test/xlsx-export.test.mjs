// The Feature breakdown's spreadsheet export: an internal-only button that
// clones the sample estimator workbook in the browser, fills tab 1 with the
// currently visible rows, and keeps every tier/price formula live in-cell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';
import { readZip } from './zip.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };
const fixture = new URL('./fixtures/booking-inputs.json', import.meta.url).pathname;

function buildPage(inputsPath = fixture) {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-xlsx-'));
  const scripts = new URL('..', import.meta.url).pathname;
  const passMd = join(scripts, 'test/fixtures/estimation-pass.md');
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', inputsPath, '--out', join(dir, 'estimation.json')]);
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', join(dir, 'estimation.json'), '--md', passMd, '--out', dir]);
  return pathToFileURL(join(dir, 'estimate.html')).href;
}

async function exportedFiles(page) {
  const b64 = await page.eval('window.__buildWorkbook()');
  return readZip(Buffer.from(b64, 'base64'));
}

const sheet1 = (files) => files.get('xl/worksheets/sheet1.xml').toString('utf8');
const cell = (xml, ref) => new RegExp(`<c r="${ref}"[^>]*?(?:/>|>(.*?)</c>)`, 's').exec(xml)?.[1] ?? '';
const inlineText = (frag) => /<t[^>]*>([^<]*)<\/t>/.exec(frag)?.[1];
const cellNumber = (frag) => Number(/<v>([^<]*)<\/v>/.exec(frag)?.[1]);
const cellFormula = (frag) => /<f>([^<]*)<\/f>/.exec(frag)?.[1];

test('the breakdown filter bar carries an internal-only download button', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.ok(await page.eval(
      `!!document.querySelector('#feature-table .bd-filters button[data-download][data-internal]')`),
    'expected a data-download button marked data-internal in the filter bar');
  } finally { page.close(); }
});

test('the export clones the sample workbook with its guide tabs intact', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    for (const name of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
      'xl/worksheets/sheet3.xml', 'xl/styles.xml', '[Content_Types].xml']) {
      assert.ok(files.has(name), `${name} missing from the exported archive`);
    }
    const workbook = files.get('xl/workbook.xml').toString('utf8');
    assert.match(workbook, /Scoring Guide/);
    assert.match(workbook, /Tier Reference/);
  } finally { page.close(); }
});

test('rows land ordered by milestone with the interview scores verbatim', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = sheet1(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'A7')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'A8')), 'Email reminders');
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => cellNumber(cell(xml, `${c}7`))), [3, 3, 2, 3, 3]);
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => cellNumber(cell(xml, `${c}8`))), [2, 2, 3, 2, 2]);
  } finally { page.close(); }
});

test('column N carries the plain-words note for sales readers', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = sheet1(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'N6')), 'WHY THIS TIER');
    assert.match(inlineText(cell(xml, 'N7')) ?? '', /open questions/);
    assert.match(xml, /<autoFilter ref="A6:N26"\/>/);
  } finally { page.close(); }
});

const sheetRationale = (files) => files.get('xl/worksheets/sheet5.xml')?.toString('utf8') ?? '';

test('a Score Rationale tab lists anchor, evidence and provenance per factor', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    assert.match(files.get('xl/workbook.xml').toString('utf8'), /name="Score Rationale"/);
    assert.match(files.get('xl/_rels/workbook.xml.rels').toString('utf8'), /Target="worksheets\/sheet5\.xml"/);
    assert.match(files.get('[Content_Types].xml').toString('utf8'), /PartName="\/xl\/worksheets\/sheet5\.xml"/);
    const xml = sheetRationale(files);
    assert.deepEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1'].map((r) => inlineText(cell(xml, r))),
      ['FEATURE', 'FACTOR', 'SCORE', 'ANCHOR', 'EVIDENCE', 'PROVENANCE']);
    assert.equal(inlineText(cell(xml, 'A2')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'B2')), 'Tech');
    assert.equal(cellNumber(cell(xml, 'C2')), 3);
    assert.equal(inlineText(cell(xml, 'D2')), 'Custom business logic, moderate algorithm complexity, multiple states');
    assert.equal(inlineText(cell(xml, 'E2')), 'slot conflict + cancellation rules');
    assert.equal(inlineText(cell(xml, 'F2')), 'stated');
    assert.match(xml, /<autoFilter ref="A1:F11"\/>/); // 2 features × 5 factors
  } finally { page.close(); }
});

test('QUICK inputs export blank score cells and an empty rationale tab', skip, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-xlsx-quick-'));
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  inputs.depth = 'QUICK';
  for (const f of inputs.features) {
    delete f.scores; delete f.scoreNote; delete f.scoreProvenance;
    f.tasks = [{ ...f.tasks[0], id: `${f.id}-band`, o: 60, m: 110, p: 160 }];
  }
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));
  const page = await openPage(buildPage(inputsPath));
  try {
    const files = await exportedFiles(page);
    const xml = sheet1(files);
    assert.equal(cell(xml, 'B7'), '', 'no score value at QUICK');
    assert.match(xml, /<c r="B7" s="\d+"\/>/);
    assert.match(sheetRationale(files), /<autoFilter ref="A1:F1"\/>/);
  } finally { page.close(); }
});

test('score math stays in the sheet: G-K are formulas, total row uses SUMIF', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = sheet1(await exportedFiles(page));
    assert.match(cellFormula(cell(xml, 'G7')) ?? '', /SUM\(B7:F7\)/);
    assert.match(cellFormula(cell(xml, 'H7')) ?? '', /IF\(/);
    for (const ref of ['I7', 'J7', 'K7']) {
      assert.ok(cellFormula(cell(xml, ref)), `${ref} must hold a formula, not a baked value`);
    }
    assert.equal(inlineText(cell(xml, 'A27')), 'PROJECT TOTAL');
    assert.match(cellFormula(cell(xml, 'G27')) ?? '', /SUMIF\(G7:G26/);
  } finally { page.close(); }
});

test('milestone and container fill L/M under an autofiltered header', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = sheet1(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'L6')), 'MILESTONE');
    assert.equal(inlineText(cell(xml, 'M6')), 'CONTAINER');
    assert.equal(inlineText(cell(xml, 'L7')), 'M1 - Booking core');
    assert.equal(inlineText(cell(xml, 'M7')), 'Booking API');
    assert.equal(inlineText(cell(xml, 'M8')), 'Notification Service');
    assert.match(xml, /<autoFilter ref="A6:N26"\/>/);
  } finally { page.close(); }
});

test('the export honours the active source filter', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`document.querySelector('#feature-table [data-prov="stated"]').click()`);
    const xml = sheet1(await exportedFiles(page));
    assert.match(xml, /User can book appointment/);
    assert.doesNotMatch(xml, /Email reminders/);
    assert.equal(inlineText(cell(xml, 'A27')), 'PROJECT TOTAL', 'total row must survive filtering');
  } finally { page.close(); }
});

const sheetTasks = (files) => files.get('xl/worksheets/sheet4.xml')?.toString('utf8') ?? '';

test('the export adds a registered Task Breakdown tab', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    assert.ok(files.has('xl/worksheets/sheet4.xml'), 'sheet4.xml missing');
    assert.match(files.get('xl/workbook.xml').toString('utf8'), /name="Task Breakdown"/);
    assert.match(files.get('xl/_rels/workbook.xml.rels').toString('utf8'), /Target="worksheets\/sheet4\.xml"/);
    assert.match(files.get('[Content_Types].xml').toString('utf8'), /PartName="\/xl\/worksheets\/sheet4\.xml"/);
  } finally { page.close(); }
});

test('task rows carry the PERT formula in-cell and ride the feature filter', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`document.querySelector('#feature-table [data-prov="stated"]').click()`);
    const xml = sheetTasks(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'A2')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'B2')), 'Booking CRUD API');
    assert.deepEqual(['D2', 'E2', 'F2'].map((r) => cellNumber(cell(xml, r))), [16, 24, 40]);
    assert.match(cellFormula(cell(xml, 'G2')) ?? '', /\(D2\+4\*E2\+F2\)\/6/);
    assert.equal(inlineText(cell(xml, 'H2')), 'HIGH');
    assert.equal(inlineText(cell(xml, 'K2')), 'Booking API');
    assert.doesNotMatch(xml, /Scheduled reminder jobs/, 'filtered-out feature tasks must not export');
  } finally { page.close(); }
});

test('the task tab is filterable and sortable: autofilter over a frozen header', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = sheetTasks(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'A1')), 'FEATURE');
    // 3 fixture tasks under rows 2-4
    assert.match(xml, /<autoFilter ref="A1:K4"\/>/);
    assert.match(xml, /<pane ySplit="1"[^>]*state="frozen"/);
  } finally { page.close(); }
});
