// The Feature breakdown's spreadsheet export: an internal-only button that
// clones the v2 estimator workbook in the browser, fills the Ballpark
// Estimator tab with every feature (never just the filtered view) and the Project Roll-up tab
// with the interviewed context levels, and leaves every one of the template's
// own formulas untouched so the workbook keeps repricing when a human edits a
// score.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../../analyze-requirements/scripts/lib/cdp.mjs';
import { loadGuide } from '../../../shared/lib/scoring.mjs';
import { readZip } from './zip.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };
const fixture = new URL('./fixtures/booking-inputs.json', import.meta.url).pathname;

const scriptsDir = new URL('..', import.meta.url).pathname;

// The deliverable gate cross-checks the document's presented range against
// the computed one, so a fixture variant that prices differently needs the
// range it actually priced. The booking fixture's own numbers are unchanged.
function pricedMd(jsonPath) {
  const md = readFileSync(join(scriptsDir, 'test/fixtures/estimation-pass.md'), 'utf8');
  const { presentLow, presentHigh } = JSON.parse(readFileSync(jsonPath, 'utf8')).computed.price;
  return md.replace(/\| Presented range \|[^|]*\|/,
    `| Presented range | $${presentLow.toLocaleString('en-US')} – $${presentHigh.toLocaleString('en-US')} |`);
}

function buildPage(inputsPath = fixture) {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-xlsx-'));
  const json = join(dir, 'estimation.json');
  const md = join(dir, 'estimation.md');
  execFileSync('node', [join(scriptsDir, 'compute.mjs'), '--inputs', inputsPath, '--out', json]);
  writeFileSync(md, pricedMd(json));
  execFileSync('node', [join(scriptsDir, 'render.mjs'), '--json', json, '--md', md, '--out', dir]);
  return pathToFileURL(join(dir, 'estimate.html')).href;
}

// Writes a variant of the booking fixture to a temp file and returns its path.
function variantInputs(tag, edit) {
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  edit(inputs);
  const path = join(mkdtempSync(join(tmpdir(), `estimate-xlsx-${tag}-`)), 'inputs.json');
  writeFileSync(path, JSON.stringify(inputs));
  return path;
}

async function exportedFiles(page) {
  const b64 = await page.eval('window.__buildWorkbook()');
  return readZip(Buffer.from(b64, 'base64'));
}

// v2's tab order: 1 How to Use, 2 Ballpark Estimator, 3 Scoring Guide,
// 4 Tier Reference, 5 Project Roll-up. Our two generated tabs land at 6 and 7.
const sheetXmlFor = (files, part) => files.get(`xl/worksheets/${part}`)?.toString('utf8') ?? '';
const ballpark = (files) => sheetXmlFor(files, 'sheet2.xml');
const rollup = (files) => sheetXmlFor(files, 'sheet5.xml');
const sheetTasks = (files) => sheetXmlFor(files, 'sheet6.xml');
const sheetRationale = (files) => sheetXmlFor(files, 'sheet7.xml');

const cell = (xml, ref) => new RegExp(`<c r="${ref}"[^>]*?(?:/>|>(.*?)</c>)`, 's').exec(xml)?.[1] ?? '';
const inlineText = (frag) => /<t[^>]*>([^<]*)<\/t>/.exec(frag)?.[1];
const cellNumber = (frag) => Number(/<v>([^<]*)<\/v>/.exec(frag)?.[1]);
const cellFormula = (frag) => /<f[^>]*>([^<]*)<\/f>/.exec(frag)?.[1];

// The workbook carries a Task Breakdown sheet and a Score Rationale sheet, so
// the export answers for the whole section rather than for either tab.
test('the section heading carries an internal-only download button', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.ok(await page.eval(
      `!!document.querySelector('#feature-table .sec-head button[data-download][data-internal]')`),
    'expected a data-download button marked data-internal on the section heading');
  } finally { page.close(); }
});

test('the workbook has seven tabs in v2 order', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    for (const part of ['sheet1.xml', 'sheet2.xml', 'sheet3.xml', 'sheet4.xml', 'sheet5.xml',
      'sheet6.xml', 'sheet7.xml']) {
      assert.ok(files.has(`xl/worksheets/${part}`), `${part} missing from the exported archive`);
    }
    for (const name of ['xl/styles.xml', 'xl/sharedStrings.xml', '[Content_Types].xml']) {
      assert.ok(files.has(name), `${name} missing from the exported archive`);
    }
    const wb = files.get('xl/workbook.xml').toString('utf8');
    const names = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(names, ['How to Use', 'Ballpark Estimator', 'Scoring Guide', 'Tier Reference',
      'Project Roll-up', 'Task Breakdown', 'Score Rationale']);
  } finally { page.close(); }
});

// The template ships cached results next to every formula. Without this flag a
// reader can open a workbook whose scores are ours and whose prices are still
// the sample's — green tests, dead numbers.
test('the workbook asks the reader to recalculate on load', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    assert.match(files.get('xl/workbook.xml').toString('utf8'), /<calcPr[^>]*fullCalcOnLoad="1"/);
    // LibreOffice ignores that flag, so no formula may keep a cached result:
    // then there is nothing to show but the recomputed number.
    for (const n of [1, 2, 3, 4, 5]) {
      const xml = sheetXmlFor(files, `sheet${n}.xml`);
      assert.doesNotMatch(xml, /<\/f><v>/, `sheet${n} keeps a cached formula result`);
    }
    assert.match(cell(ballpark(files), 'G7'), /SUMPRODUCT/, 'the formula itself must survive');
  } finally { page.close(); }
});

// The export writes cells the template already carries. If one ever goes
// missing, a String.replace that finds nothing returns its input unchanged —
// the feature name and its scores would vanish into blank cells and every
// assertion in this file would still pass. Refuse instead.
test('writing a cell the template does not carry is refused, not ignored', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.match(await page.eval(`(() => {
      try { setCell('<c r="A1" s="3"/>', 'ZZ99', (s) => '<c r="ZZ99" s="' + s + '"/>'); }
      catch (e) { return e.message; }
      return 'no throw';
    })()`), /no cell ZZ99/);
    assert.match(await page.eval(`(() => {
      try { appendCells('<row r="1"/>', 99, '<c r="A99"/>'); }
      catch (e) { return e.message; }
      return 'no throw';
    })()`), /no row 99/);
  } finally { page.close(); }
});

test('rows land ordered by milestone with the interview scores verbatim', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = ballpark(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'A7')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'A8')), 'Email reminders');
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => cellNumber(cell(xml, `${c}7`))), [3, 3, 2, 3, 3]);
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => cellNumber(cell(xml, `${c}8`))), [2, 2, 3, 2, 2]);
  } finally { page.close(); }
});

// The template ships five worked sample features in rows 7-11. An export of
// two features must not leave the other three standing next to our prices.
// Their names are shared strings, so searching the sheet XML for one proves
// nothing — the reference has to be resolved through sharedStrings.xml.
test('the template\'s own sample rows are cleared past the exported features', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    const xml = ballpark(files);
    assert.deepEqual(['A7', 'A8', 'A9', 'A10', 'A11'].map((r) => nameAt(files, xml, r)),
      ['User can book appointment', 'Email reminders', '', '', '']);
    for (const ref of ['A9', 'A10', 'A11', 'B9', 'F11']) {
      assert.equal(cell(xml, ref), '', `${ref} must be emptied, not left with sample data`);
    }
    assert.match(xml, /<c r="A9" s="\d+"\/>/, 'the cleared cell must keep the template style');
  } finally { page.close(); }
});

// Row 6 is the template's own header row — the export never writes it, it
// writes scores into B-F underneath. Pin the seam: if the template's score
// columns are ever reordered or renamed, every exported score lands under the
// wrong heading and nothing else would notice.
function sharedText(files, frag) {
  const idx = Number(/<v>(\d+)<\/v>/.exec(frag)?.[1]);
  const items = [...files.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)];
  return [...items[idx][1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
}

const headerText = (files, frag) => inlineText(frag) ?? sharedText(files, frag);

// A name cell is either one of our inline strings or, in the pristine
// template, a shared-string reference. Resolve both; a cleared cell reads ''.
function nameAt(files, xml, ref) {
  const frag = cell(xml, ref);
  return frag ? headerText(files, frag) : '';
}

test('the score columns sit under the template\'s five score headers', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    const xml = ballpark(files);
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => headerText(files, cell(xml, `${c}6`))),
      ['TECH\nCOMPLEXITY\n(1-5)', 'FEATURE\nSIZE\n(1-5)', 'DEPEND-\nENCIES\n(1-5)',
        'UNCER-\nTAINTY\n(1-5)', 'RISK\n(1-5)']);
  } finally { page.close(); }
});

test('the five dimension weights still sum to one in the shipped template', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = ballpark(await exportedFiles(page));
    const weights = ['B5', 'C5', 'D5', 'E5', 'F5'].map((ref) => cellNumber(cell(xml, ref)));
    assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-9, weights.join(','));
    assert.match(cellFormula(cell(xml, 'G5')) ?? '', /SUM\(\$B\$5:\$F\$5\)/);
  } finally { page.close(); }
});

test('column P carries the plain-words note for sales readers', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = ballpark(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'P6')), 'WHY THIS TIER');
    assert.match(inlineText(cell(xml, 'P7')) ?? '', /open questions/);
  } finally { page.close(); }
});

test('a Score Rationale tab lists anchor, evidence and both sources per factor', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    assert.match(files.get('xl/workbook.xml').toString('utf8'), /name="Score Rationale"/);
    assert.match(files.get('xl/_rels/workbook.xml.rels').toString('utf8'), /Target="worksheets\/sheet7\.xml"/);
    assert.match(files.get('[Content_Types].xml').toString('utf8'), /PartName="\/xl\/worksheets\/sheet7\.xml"/);
    const xml = sheetRationale(files);
    assert.deepEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'].map((r) => inlineText(cell(xml, r))),
      ['FEATURE', 'FACTOR', 'SCORE', 'ANCHOR', 'EVIDENCE', 'FEATURE SOURCE', 'SCORE ORIGIN']);
    assert.equal(inlineText(cell(xml, 'A2')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'B2')), 'Tech');
    assert.equal(cellNumber(cell(xml, 'C2')), 3);
    assert.equal(inlineText(cell(xml, 'D2')), 'Custom business logic, moderate algorithm complexity, multiple states');
    assert.equal(inlineText(cell(xml, 'E2')), 'slot conflict + cancellation rules');
    assert.equal(inlineText(cell(xml, 'F2')), 'stated'); // the client asked for the feature
    assert.equal(inlineText(cell(xml, 'G2')), 'reviewer changed'); // and a human edited its score
    assert.match(xml, /<autoFilter ref="A1:G11"\/>/); // 2 features × 5 factors
  } finally { page.close(); }
});

// The two columns answer different questions about different people — whether
// the client asked for the feature, and whether a reviewer overrode the
// agent's score. The booking fixture happens to agree on both, so this pins
// them apart: one feature the client asked for, whose score nobody touched.
test('feature source and score origin are read from separate fields', skip, async () => {
  const inputsPath = variantInputs('sources', (inputs) => {
    inputs.features[0].provenance = 'stated';
    inputs.features[0].scoreProvenance = 'proposed';
  });
  const page = await openPage(buildPage(inputsPath));
  try {
    const xml = sheetRationale(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'F2')), 'stated');
    assert.equal(inlineText(cell(xml, 'G2')), 'agent proposed');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

const quickInputs = () => variantInputs('quick', (inputs) => {
  inputs.depth = 'QUICK';
  for (const f of inputs.features) {
    delete f.scores; delete f.scoreNote; delete f.scoreProvenance;
    f.tasks = [{ ...f.tasks[0], id: `${f.id}-band`, o: 60, m: 110, p: 160 }];
  }
});

test('QUICK inputs export blank score cells and an empty rationale tab', skip, async () => {
  const page = await openPage(buildPage(quickInputs()));
  try {
    const files = await exportedFiles(page);
    const xml = ballpark(files);
    assert.equal(cell(xml, 'B7'), '', 'no score value at QUICK');
    assert.match(xml, /<c r="B7" s="\d+"\/>/);
    assert.match(sheetRationale(files), /<autoFilter ref="A1:G1"\/>/);
  } finally { page.close(); }
});

// A QUICK estimate has no scores, and this workbook prices only from scores.
// The template's G7 is IF($A7="",0,SUMPRODUCT(...)), so a named feature with
// blank B:F weighs 0 — not blank, which is what v1's COUNTA guard returned.
// That 0 runs I7 -> I37 -> Project Roll-up C6 -> C20 and every figure under
// it. Nothing about the sheet looks broken; it reads a confident, formatted
// $0. Verified in LibreOffice: I37 = 0, C20 = 0, D34 = 0. So the sheet says
// so beside the subtotal, and this pins the behaviour as a decision.
test('a QUICK export says on the roll-up that its figures read zero', skip, async () => {
  const page = await openPage(buildPage(quickInputs()));
  try {
    const files = await exportedFiles(page);
    const note = inlineText(cell(rollup(files), 'D6')) ?? '';
    assert.match(note, /NOT A PRICE/);
    assert.match(note, /2 of 2 features carry no scores/);
    assert.match(note, /read 0/);
    assert.match(note, /Score the features on the Ballpark tab/); // 0 is recoverable in-sheet
    // The formulas that produce that 0 are still the template's own, so typing
    // scores in really does reprice the sheet.
    assert.match(cellFormula(cell(ballpark(files), 'I37')) ?? '', /SUM\(\$I\$7:\$I\$36\)/);
    assert.match(cellFormula(cell(rollup(files), 'C20')) ?? '', /\$C\$6\*\$D\$16/);
  } finally { page.close(); }
});

// The note is warranted, not unconditional: a fully scored export must not
// cry wolf on a tab a client may well read.
test('a fully scored export leaves the roll-up unannotated', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.equal(cell(rollup(await exportedFiles(page)), 'D6'), '');
  } finally { page.close(); }
});

// The whole point of shipping a workbook rather than a PDF: G-M are the
// template's own tier/price chain and the export must never rewrite them.
test('score math stays the template\'s: G-M are live formulas the export never touches', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = ballpark(await exportedFiles(page));
    assert.match(cellFormula(cell(xml, 'G7')) ?? '', /SUMPRODUCT\(\$B7:\$F7,\$B\$5:\$F\$5\)/);
    for (const col of ['H', 'I', 'J', 'K', 'L', 'M']) {
      assert.ok(/<f/.test(cell(xml, `${col}7`)), `${col}7 must hold a formula, not a baked value`);
    }
    assert.match(cell(xml, 'H7'), /Tier Reference/, 'the tier lookup must stay cross-sheet');
    // ...and the blank slots below keep theirs, so a typed-in feature prices itself.
    assert.ok(/<f/.test(cell(xml, 'I36')), 'the last spare row lost its formula');
  } finally { page.close(); }
});

test('the template\'s FEATURE SUBTOTAL row survives the fill', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = ballpark(await exportedFiles(page));
    assert.match(cellFormula(cell(xml, 'G37')) ?? '', /COUNTIF\(\$A\$7:\$A\$36/);
    for (const ref of ['I37', 'K37', 'L37']) {
      assert.match(cellFormula(cell(xml, ref)) ?? '', /SUM\(\$[IKL]\$7:\$[IKL]\$36\)/);
    }
  } finally { page.close(); }
});

test('milestone and container fill N/O beside the template columns', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = ballpark(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'N6')), 'MILESTONE');
    assert.equal(inlineText(cell(xml, 'O6')), 'CONTAINER');
    assert.equal(inlineText(cell(xml, 'N7')), 'M1 - Booking core');
    assert.equal(inlineText(cell(xml, 'O7')), 'Booking API');
    assert.equal(inlineText(cell(xml, 'O8')), 'Notification Service');
  } finally { page.close(); }
});

// R60: the workbook prices the project from whatever rows it gets, so a
// filtered subset would quote a different total than the page and the
// proposal. The export ignores the breakdown filter.
test('the export carries every feature even with a source filter on', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`(() => {
      const sel = document.querySelector('#feature-table select[data-select="prov"]');
      sel.value = 'stated';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const files = await exportedFiles(page);
    const xml = ballpark(files);
    assert.deepEqual(['A7', 'A8'].map((r) => nameAt(files, xml, r)),
      ['User can book appointment', 'Email reminders'], 'a filtered-out feature must still export');
  } finally { page.close(); }
});

// --- Project Roll-up: the five context levels the interview captured. The
// multiplier beside each one stays a live INDEX formula, so an edited level
// reprices the whole project inside the workbook.
test('the roll-up context cells are filled from inputs in the sheet\'s own order', skip, async () => {
  // Levels cap at 4, so five distinct values are impossible; 1,2,3,4,1 leaves
  // codebaseMaturity/clientDecisions as the only pair a swap could hide.
  const inputsPath = variantInputs('levels', (inputs) => {
    inputs.contextLevels = { codebaseMaturity: 1, stackFamiliarity: 2, specQuality: 3, compliance: 4, clientDecisions: 1 };
    for (const [key, prov] of Object.entries(inputs.contextProvenance ?? {})) {
      prov.level = inputs.contextLevels[key];
    }
  });
  const page = await openPage(buildPage(inputsPath));
  try {
    const xml = rollup(await exportedFiles(page));
    assert.deepEqual(['C11', 'C12', 'C13', 'C14', 'C15'].map((r) => cellNumber(cell(xml, r))),
      [1, 2, 3, 4, 1]);
    for (const ref of ['D11', 'D12', 'D13', 'D14', 'D15']) {
      assert.ok(/<f/.test(cell(xml, ref)), `${ref} must stay the template's INDEX formula`);
    }
    assert.match(cellFormula(cell(xml, 'C6')) ?? '', /Ballpark Estimator'!\$I\$37/);
  } finally { page.close(); }
});

// 2 fixture features + 31 clones = 33, three more than the 30 wired rows.
// The clones score 1/2/3/4/5, five distinct values, so B-F can only line up
// under the right headers one way — the booking fixture's 3,3,2,3,3 would
// survive a B/C or E/F swap in SCORE_KEYS.
// compute.mjs refuses a score whose anchor is not the guide's own sentence
// for that number, so the rescored clones take theirs from the guide.
const GUIDE = loadGuide();
const SCORE_ORDER = ['tech', 'size', 'deps', 'unc', 'risk'];

const overflowInputs = () => variantInputs('overflow', (inputs) => {
  const base = inputs.features[0];
  inputs.features.push(...Array.from({ length: 31 }, (_, i) => {
    const f = { ...structuredClone(base), id: `extra${i}`, name: `Extra feature ${i}` };
    f.tasks = base.tasks.map((t, j) => ({ ...structuredClone(t), id: `extra${i}-t${j}` }));
    SCORE_ORDER.forEach((key, n) => { f.scores[key] = { ...f.scores[key], n: n + 1, anchor: GUIDE[key][n] }; });
    return f;
  }));
});

test('each score lands in its own column: five distinct values, one ordering', skip, async () => {
  const page = await openPage(buildPage(overflowInputs()));
  try {
    const xml = ballpark(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'A8')), 'Extra feature 0');
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => cellNumber(cell(xml, `${c}8`))), [1, 2, 3, 4, 5]);
  } finally { page.close(); }
});

// Patching the template in place means the Ballpark tab can hold only the
// rows the template wired: 7-36. Anything past that must be loud, because a
// silently truncated FEATURE SUBTOTAL is a wrong price on a client's desk.
test('features past the template\'s 30 scored rows are called out in the sheet', skip, async () => {
  const page = await openPage(buildPage(overflowInputs()));
  try {
    const files = await exportedFiles(page);
    const xml = ballpark(files);
    assert.ok(inlineText(cell(xml, 'A36')), 'the last wired slot must be used');
    const note = inlineText(cell(xml, 'A38')) ?? '';
    assert.match(note, /3 more features/);
    assert.match(note, /not in the subtotal/i);
    assert.match(note, /Email reminders/); // the M2 feature sorts last, so it is dropped
    // Nothing is lost from the workbook — the overflow still rides the other tabs.
    assert.match(sheetTasks(files), /Email reminders/);
    assert.match(sheetRationale(files), /Email reminders/);
    // ...and the roll-up, where every figure derives from that subtotal, says so too.
    assert.match(inlineText(cell(rollup(files), 'D6')) ?? '', /INCOMPLETE: 3 features did not fit/);
  } finally { page.close(); }
});

test('the export adds a registered Task Breakdown tab', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    assert.ok(files.has('xl/worksheets/sheet6.xml'), 'sheet6.xml missing');
    assert.match(files.get('xl/workbook.xml').toString('utf8'), /name="Task Breakdown"/);
    assert.match(files.get('xl/_rels/workbook.xml.rels').toString('utf8'), /Target="worksheets\/sheet6\.xml"/);
    assert.match(files.get('[Content_Types].xml').toString('utf8'), /PartName="\/xl\/worksheets\/sheet6\.xml"/);
  } finally { page.close(); }
});

test('task rows carry the PERT formula in-cell and ignore the feature filter', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`(() => {
      const sel = document.querySelector('#feature-table select[data-select="prov"]');
      sel.value = 'stated';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const xml = sheetTasks(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'A2')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'B2')), 'Booking CRUD API');
    assert.deepEqual(['D2', 'E2', 'F2'].map((r) => cellNumber(cell(xml, r))), [16, 24, 40]);
    assert.match(cellFormula(cell(xml, 'G2')) ?? '', /\(D2\+4\*E2\+F2\)\/6/);
    assert.equal(inlineText(cell(xml, 'H2')), 'HIGH');
    assert.equal(inlineText(cell(xml, 'K2')), 'Booking API');
    assert.match(xml, /Scheduled reminder jobs/, 'a filtered-out feature\'s tasks must still export');
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
