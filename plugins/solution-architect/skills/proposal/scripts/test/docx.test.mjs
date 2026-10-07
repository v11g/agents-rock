import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLead } from '../lib/workflow-lead.mjs';
import { proposalView } from '../lib/workflow-view.mjs';
import { buildDocx } from '../lib/docx-package.mjs';
import { readZip } from '../../../estimate/classic/scripts/test/zip.mjs';
import { lead, passInputs } from './workflow-stage.mjs';

const { est, req } = loadLead(lead().estimation);
const view = proposalView({ est, req, inputs: passInputs() });
// A real 1x1 PNG, standing in for a drawn diagram.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const drawn = { bytes: PNG, width: 1200, height: 300 };
// Three workflows in page order; the second one was not drawn.
const docx = () => readZip(Buffer.from(buildDocx(view, [drawn, null, drawn])));
const count = (xml, re) => (xml.match(re) ?? []).length;

test('the package has every part Word needs, and one PNG per drawn workflow', () => {
  const files = docx();
  assert.deepEqual([...files.keys()], ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels',
    'word/styles.xml', 'word/numbering.xml', 'word/media/image1.png', 'word/media/image3.png']);
  const rels = files.get('word/_rels/document.xml.rels').toString('utf8');
  assert.match(rels, /Id="rIdImg1"[^>]*Target="media\/image1\.png"/);
  assert.doesNotMatch(rels, /rIdImg2/);
});

test('document.xml follows the page: headings, tables, lists, in order', () => {
  const xml = docx().get('word/document.xml').toString('utf8');
  assert.equal(count(xml, /<w:pStyle w:val="Heading1"\/>/g), 6); // scope, 2 systems, milestones, register, cost
  assert.equal(count(xml, /<w:tbl>/g), 5); // scope, 2 feature tables, milestones, cost
  assert.equal(count(xml, /<w:numId w:val="1"\/>/g), 4); // 2 assumptions + 2 exclusions
  const order = ['Scope: what this proposal covers', 'System 1: Warehouse operations', 'System 2: Orders &amp; invoicing', 'Milestones', 'Cost estimate'];
  const at = order.map((h) => xml.indexOf(`<w:t xml:space="preserve">${h}</w:t>`));
  assert.ok(at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1])), JSON.stringify(at));
});

test('drawn workflows become images; an undrawn one falls back to its steps', () => {
  const xml = docx().get('word/document.xml').toString('utf8');
  assert.deepEqual([...xml.matchAll(/r:embed="(\w+)"/g)].map((m) => m[1]), ['rIdImg1', 'rIdImg3']);
  assert.match(xml, /Order received → Quote → Invoice → Paid/);
  const [, cx] = /<wp:extent cx="(\d+)"/.exec(xml);
  assert.equal(Number(cx), 9638 * 635); // 1200 px is wider than the page: scaled to the text width
});

test('the price, no IDs, no undefined, and text is escaped', () => {
  const xml = docx().get('word/document.xml').toString('utf8');
  assert.match(xml, /\$39,000 – \$48,500/);
  assert.doesNotMatch(xml, /undefined|\b(?:FEAT|FR|SYS|WF|ASM)-\d|M\d - /);
  const v = structuredClone(view);
  v.systems[0].features[0].name = 'A <b> & "c"\u0007';
  const odd = readZip(Buffer.from(buildDocx(v, [null, null, null]))).get('word/document.xml').toString('utf8');
  assert.match(odd, /A &lt;b&gt; &amp; "c"<\/w:t>/);
});

const soffice = spawnSync('soffice', ['--version']).status === 0;
test('LibreOffice opens the file and reads the text back', { skip: soffice ? false : 'no soffice on PATH' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-docx-'));
  writeFileSync(join(dir, 'p.docx'), buildDocx(view, [drawn, null, drawn]));
  execFileSync('soffice', ['--headless', `-env:UserInstallation=file://${dir}/lo`, '--convert-to', 'txt:Text', '--outdir', dir, join(dir, 'p.docx')], { stdio: 'ignore' });
  const text = readFileSync(join(dir, 'p.txt'), 'utf8');
  for (const s of ['Systems & Workflows Proposal', 'System 2: Orders & invoicing', 'Short-pack alert', 'Invoice from the floor', '$39,000 – $48,500']) {
    assert.ok(text.includes(s), s);
  }
});
