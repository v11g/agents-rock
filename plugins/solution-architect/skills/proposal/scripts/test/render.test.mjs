import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tpl = () => readFileSync(new URL('../../assets/proposal-template.html', import.meta.url), 'utf8');
const cli = new URL('../render.mjs', import.meta.url).pathname;
const computeCli = new URL('../../../estimate/classic/scripts/compute.mjs', import.meta.url).pathname;
const inputs = new URL('../../../estimate/classic/scripts/test/fixtures/booking-inputs.json', import.meta.url).pathname;
const passMd = new URL('./fixtures/proposal-pass.md', import.meta.url).pathname;
const failMd = new URL('./fixtures/proposal-fail.md', import.meta.url).pathname;

// A stub is enough: the test asserts inlining, not diagram rendering.
const STUB_BUNDLE = 'globalThis.mermaid={initialize(){},run(){}};';

function rendered(md = passMd) {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-render-'));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', inputs, '--out', json]);
  const bundle = join(dir, 'mermaid.js');
  writeFileSync(bundle, STUB_BUNDLE);
  execFileSync('node', [cli, '--md', md, '--estimation', json, '--mermaid-bundle', bundle, '--out', dir]);
  return readFileSync(join(dir, 'proposal.html'), 'utf8');
}

test('template carries exactly the five slots and no external URLs', () => {
  const markers = [...tpl().matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(markers)], ['CONTENT', 'FONTS', 'MERMAID_BUNDLE', 'NAV', 'TITLE']);
  assert.doesNotMatch(tpl(), /https?:\/\/(?!www\.w3\.org)/);
});

test('template is print-ready', () => {
  assert.match(tpl(), /@media print/);
  assert.match(tpl(), /break-inside/);
  assert.match(tpl(), /@page/);
});

test('render refuses a proposal that fails validation', () => {
  assert.throws(() => rendered(failMd));
});

test('rendered page is self-contained with fonts, nav, and all nine sections', () => {
  const html = rendered();
  assert.doesNotMatch(html, /<!-- slot:/);
  assert.match(html, /@font-face/);
  assert.match(html, /globalThis\.mermaid/);
  assert.doesNotMatch(html, /<(link|script|img)[^>]+(href|src)="https?:/);
  for (const name of ['Executive Summary', 'Investment &amp; Timeline', 'Next Steps']) {
    assert.match(html, new RegExp(`<h2[^>]*>${name}</h2>`));
  }
  assert.match(html, /<nav[\s\S]*?Executive Summary[\s\S]*?<\/nav>/);
  assert.match(html, /Proposal — Acme Corp/);
});

test('rendered page carries the mermaid canvas and no internal markers', () => {
  const html = rendered();
  assert.match(html, /class="mermaid-canvas"/);
  assert.doesNotMatch(html, /data-internal|viewer-link/);
});

test('render refuses a bundle carrying a literal script terminator', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-render-'));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', inputs, '--out', json]);
  const bundle = join(dir, 'mermaid.js');
  writeFileSync(bundle, 'var x = "</script>";');
  assert.throws(() => execFileSync('node', [cli, '--md', passMd, '--estimation', json, '--mermaid-bundle', bundle, '--out', dir]));
});
