import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { py, stage } from './helpers.mjs';

const READ = 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); print("\\n".join(z.namelist())); print("@@"); print(z.read("word/document.xml").decode())';

function built(mutate) {
  const dir = stage(mutate);
  const out = join(dir, 'draft-scope.docx');
  const r = py('build_docx.py', ['--draft', join(dir, 'draft.json'), '--out', out]);
  assert.equal(r.code, 0, r.err);
  const [names, xml] = execFileSync('python3', ['-c', READ, out], { encoding: 'utf8' }).split('@@\n');
  return { names: names.trim().split('\n'), xml, text: xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
}

test('the package holds the Word parts, content types first', () => {
  const { names } = built();
  assert.equal(names[0], '[Content_Types].xml');
  for (const p of ['_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml']) {
    assert.ok(names.includes(p), p);
  }
});

test('sections come in the document order of the spec', () => {
  const { text } = built();
  const order = ['Riverside Bakery — Scope draft', 'Sources', 'Problems we heard', 'Scope', 'Exclusions',
    'System 1: Orders', 'System 2: Stock', 'Assumptions', 'Questions for the client'];
  let at = -1;
  for (const h of order) {
    const i = text.indexOf(h, at + 1);
    assert.ok(i > at, `${h} missing or out of order`);
    at = i;
  }
});

test('step lines are table boxes', () => {
  const { text, xml } = built();
  assert.match(text, /Main workflow Order In → Bake → Pack → Courier Handoff/);
  assert.match(text, /Custom cake: starts at Order In, rejoins at Bake, ~30% of orders Quote → Confirm Design/);
  assert.equal((xml.match(/<w:tcBorders>/g) ?? []).length, 6, 'one bordered cell per step');
  const long = built((d) => {
    d.systems[0].workflows = [{ kind: 'side', steps: ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7'], returnsTo: 'Order In', source: 'C1' }];
  });
  assert.match(long.text, /Side path, back to Order In A1 → B2 → C3 → D4 → E5 F6 → G7/);
  const flow = long.xml.split('Side path, back to Order In')[1].split('</w:tbl>')[0];
  assert.equal((flow.match(/<w:cantSplit\/>/g) ?? []).length, 2, '7 steps wrap onto 2 rows');
});

test('tables carry their columns and rows', () => {
  const { text } = built();
  assert.match(text, /Feature What it does From Order board Shows every order/);
  assert.match(text, /Exclusion Reason From Delivery routes Owned by someone else C1/);
  assert.match(text, /Question Why it matters If no answer, assume About Last time you ran out of flour/);
  assert.match(text, /"Last month we ran out twice on a Saturday and had to close the cake counter by noon\." \(E1\)/);
});

test('empty sections say None', () => {
  const { text } = built((d) => { d.scope.exclusions = []; d.assumptions = []; d.systems[1].features = []; });
  assert.match(text, /Exclusions None\./);
  assert.match(text, /System 2: Stock Keeps flour on hand for weekend baking; closes P1 None\./);
  assert.match(text, /Assumptions None\./);
});

test('special characters are escaped', () => {
  const { xml } = built((d) => { d.client = 'Bread & <Butter>\u0001'; });
  assert.match(xml, /Bread &amp; &lt;Butter&gt; — Scope draft/);
  assert.doesNotMatch(xml, /\u0001/);
});

test('wrong arguments print usage and exit 2', () => {
  const r = py('build_docx.py', ['--draft']);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage: build_docx\.py --draft <draft\.json> --out <draft-scope\.docx>/);
});
