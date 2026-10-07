import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = (p) => new URL(p, import.meta.url).pathname;

test('compute → derive → validate → render runs clean end to end', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-e2e-'));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [script('../../../estimate/classic/scripts/compute.mjs'),
    '--inputs', script('../../../estimate/classic/scripts/test/fixtures/booking-inputs.json'), '--out', json]);
  execFileSync('node', [script('../derive.mjs'),
    '--estimation', json, '--out', join(dir, 'proposal-figures.json')]);
  execFileSync('node', [script('../validate.mjs'),
    '--md', script('./fixtures/proposal-pass.md'), '--estimation', json]);
  const bundle = join(dir, 'mermaid.js');
  writeFileSync(bundle, 'globalThis.mermaid={initialize(){},run(){}};');
  execFileSync('node', [script('../render.mjs'), '--md', script('./fixtures/proposal-pass.md'),
    '--estimation', json, '--mermaid-bundle', bundle, '--out', dir]);
  const html = readFileSync(join(dir, 'proposal.html'), 'utf8');
  assert.match(html, /Proposal — Acme Corp/);
  // The figures file is an authoring aid; the rendered numbers must
  // nevertheless agree with it, because both derive from estimation.json.
  const figures = JSON.parse(readFileSync(join(dir, 'proposal-figures.json'), 'utf8'));
  assert.match(html, new RegExp(figures.cost.low.toLocaleString('en-US')));
  assert.match(html, new RegExp(figures.cost.high.toLocaleString('en-US')));
});
