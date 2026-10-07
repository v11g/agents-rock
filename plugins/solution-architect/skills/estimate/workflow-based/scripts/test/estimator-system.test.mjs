// The workflow-mode workbook template: Estimator_v2 with a SYSTEM / MODULE
// column before the Ballpark tab's FEATURE column, built by LibreOffice
// (build-xlsx-template.py) so every formula and the Roll-up's links shift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip } from '../../../classic/scripts/test/zip.mjs';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const TEMPLATE = at('../../assets/estimator-system.xlsx');
const BALLPARK = 'xl/worksheets/sheet2.xml';
const ROLLUP = 'xl/worksheets/sheet5.xml';

function sheets(file) {
  const files = readZip(readFileSync(file));
  const strings = [...files.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join(''));
  const text = (part, ref) => {
    const m = new RegExp(`<c r="${ref}"[^>]*t="s"[^>]*><v>(\\d+)</v>`).exec(files.get(part).toString('utf8'));
    return m ? strings[Number(m[1])] : undefined;
  };
  return { xml: (part) => files.get(part).toString('utf8'), text };
}

test('Ballpark: SYSTEM / MODULE in A, FEATURE / WORK ITEM in B, A7..A36 are real cells', () => {
  const { xml, text } = sheets(TEMPLATE);
  assert.equal(text(BALLPARK, 'A6'), 'SYSTEM / MODULE');
  assert.equal(text(BALLPARK, 'B6'), 'FEATURE / WORK ITEM');
  for (let r = 7; r <= 36; r += 1) assert.match(xml(BALLPARK), new RegExp(`<c r="A${r}" s="\\d+"`), `no cell A${r}`);
});

test('Ballpark: formulas, merges, pane and validation follow the shift', () => {
  const ballpark = sheets(TEMPLATE).xml(BALLPARK);
  assert.match(ballpark, /<c r="H7"[^>]*><f[^>]*>[^<]*SUMPRODUCT\(\$C7:\$G7/);
  assert.match(ballpark, /<pane xSplit="2" ySplit="6" topLeftCell="C7"/);
  for (const ref of ['A1:N1', 'A2:N2', 'A39:N39']) assert.match(ballpark, new RegExp(`<mergeCell ref="${ref}"/>`));
  assert.match(ballpark, /<dataValidation [^>]*sqref="C7:G36"/);
});

test("Roll-up's subtotal link points at the shifted Ballpark subtotal", () => {
  assert.match(sheets(TEMPLATE).xml(ROLLUP), /<c r="C6"[^>]*><f[^>]*>(?:'|&apos;)Ballpark Estimator(?:'|&apos;)!\$J\$37</);
});

const canRebuild = spawnSync('/usr/bin/python3', ['-c', 'import uno'], { stdio: 'ignore' }).status === 0
  && spawnSync('soffice', ['--version'], { stdio: 'ignore' }).status === 0;

test('build-xlsx-template.py rebuilds the committed template', { skip: !canRebuild && 'no LibreOffice / uno' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-template-'));
  try {
    const out = join(dir, 'rebuilt.xlsx');
    execFileSync('/usr/bin/python3', [at('../build-xlsx-template.py'), '--out', out], { stdio: 'ignore', timeout: 120000 });
    const [built, committed] = [sheets(out), sheets(TEMPLATE)];
    for (const part of [BALLPARK, ROLLUP]) assert.equal(built.xml(part), committed.xml(part), `${part} differs`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('build-xlsx-template.py: a bare --out fails with a usage message', { skip: !canRebuild && 'no LibreOffice / uno' }, () => {
  const run = spawnSync('/usr/bin/python3', [at('../build-xlsx-template.py'), '--out'], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /usage: .*build-xlsx-template\.py \[--out <file>\]/);
  assert.doesNotMatch(run.stderr, /Traceback/);
});
