import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';
import { readZip } from '../../../estimate/classic/scripts/test/zip.mjs';
import { noFlowsAt } from '../../../estimate/workflow-based/scripts/test/stage.mjs';
import { lead } from './workflow-stage.mjs';

const skip = findChrome() ? false : 'no chrome on PATH';
const settle = () => new Promise((r) => setTimeout(r, 1500));
// Draws a small SVG into each diagram, as mermaid would, so the PNG path runs for real.
const DRAWING_STUB = 'globalThis.mermaid={initialize(){},async run({querySelector}){for(const el of document.querySelectorAll(querySelector)){'
  + 'el.innerHTML=\'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><rect x="5" y="5" width="120" height="40" fill="#eee" stroke="#333"/><text x="20" y="30">Step</text></svg>\';}}};';

// Fails the second diagram as real mermaid does: an error drawing in its
// place unless suppressErrorRendering is set, then run() rejects.
const FAILING_STUB = 'globalThis.mermaid={cfg:{},initialize(c){this.cfg=c;},async run({querySelector}){let err;'
  + '[...document.querySelectorAll(querySelector)].forEach((el,i)=>{if(i===1){err=new Error("Syntax error in text");'
  + 'if(!this.cfg.suppressErrorRendering)el.innerHTML=\'<svg xmlns="http://www.w3.org/2000/svg" aria-roledescription="error" width="300" height="80"><text x="10" y="40">Syntax error</text></svg>\';return;}'
  + 'el.innerHTML=\'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><rect x="5" y="5" width="120" height="40" fill="#eee"/></svg>\';});if(err)throw err;}};';

function proposalUrl(stub = DRAWING_STUB, edit = null) {
  const l = lead();
  if (edit) edit(l.dir);
  const bundle = join(l.dir, 'mermaid.js');
  writeFileSync(bundle, stub);
  execFileSync('node', [new URL('../render.mjs', import.meta.url).pathname, '--estimation', l.estimation, '--inputs', l.inputs,
    '--mermaid-bundle', bundle, '--out', join(l.dir, 'dist')]);
  return pathToFileURL(join(l.dir, 'dist', 'proposal.html')).href;
}

test('the page renders every section with no console errors', { skip }, async () => {
  const page = await openPage(proposalUrl());
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval('document.querySelectorAll("nav a").length'), 6);
    assert.equal(await page.eval('document.querySelectorAll(".mermaid-canvas svg").length'), 3);
    assert.match(await page.eval('document.getElementById("cost").textContent'), /\$39,000 – \$48,500/);
  } finally { await page.close(); }
});

test('Download DOCX builds a Word file with one PNG per diagram and well-formed XML', { skip }, async () => {
  const page = await openPage(proposalUrl());
  try {
    await settle();
    const files = readZip(Buffer.from(await page.eval('window.__buildDocx()'), 'base64'));
    const pngs = [...files.keys()].filter((k) => k.startsWith('word/media/'));
    assert.deepEqual(pngs, ['word/media/image1.png', 'word/media/image2.png', 'word/media/image3.png']);
    assert.equal(files.get('word/media/image1.png').subarray(1, 4).toString('latin1'), 'PNG');
    for (const part of ['word/document.xml', 'word/styles.xml', 'word/numbering.xml', '[Content_Types].xml']) {
      const xml = JSON.stringify(files.get(part).toString('utf8'));
      const broken = await page.eval(`new DOMParser().parseFromString(${xml}, 'application/xml').getElementsByTagName('parsererror').length`);
      assert.equal(broken, 0, part);
    }
  } finally { await page.close(); }
});

test('the print layout hides the menu and both buttons', { skip }, async () => {
  const page = await openPage(proposalUrl());
  try {
    await page.send('Emulation.setEmulatedMedia', { media: 'print' });
    assert.equal(await page.eval('getComputedStyle(document.querySelector(".tools")).display'), 'none');
    assert.equal(await page.eval('getComputedStyle(document.querySelector("nav")).display'), 'none');
    assert.equal(await page.eval('getComputedStyle(document.getElementById("system-2")).breakBefore'), 'page');
  } finally { await page.close(); }
});

test('a diagram that fails to draw shows its steps on the page and in the DOCX, never an error picture', { skip }, async () => {
  const page = await openPage(proposalUrl(FAILING_STUB));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    const steps = await page.eval('JSON.parse(document.getElementById("proposal-data").textContent).systems.flatMap((s) => s.flows)[1].steps');
    assert.equal(await page.eval('document.querySelectorAll(".mermaid-canvas")[1].querySelector("svg") === null'), true);
    assert.equal(await page.eval('document.querySelectorAll(".mermaid-canvas")[1].textContent'), steps);
    const files = readZip(Buffer.from(await page.eval('window.__buildDocx()'), 'base64'));
    assert.deepEqual([...files.keys()].filter((k) => k.startsWith('word/media/')), ['word/media/image1.png', 'word/media/image3.png']);
    assert.ok(files.get('word/document.xml').toString('utf8').includes(steps.replaceAll('&', '&amp;')));
  } finally { await page.close(); }
});

test('a system with no workflow: one diagram fewer on the page and in the DOCX, no errors', { skip }, async () => {
  const page = await openPage(proposalUrl(DRAWING_STUB, noFlowsAt));
  try {
    await settle();
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval('document.querySelectorAll(".mermaid-canvas svg").length'), 1);
    const files = readZip(Buffer.from(await page.eval('window.__buildDocx()'), 'base64'));
    assert.deepEqual([...files.keys()].filter((k) => k.startsWith('word/media/')), ['word/media/image1.png']);
  } finally { await page.close(); }
});
