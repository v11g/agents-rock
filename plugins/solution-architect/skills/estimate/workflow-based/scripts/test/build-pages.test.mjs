import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));

// Every edit to a template lives in its builder, so a rebuild from the mockup
// never silently undoes one (as build-template.test.mjs does for the review).
function pinned(builder, asset) {
  const out = join(mkdtempSync(join(tmpdir(), 'wf-pages-')), 'page.html');
  execFileSync('node', [at(builder), '--out', out], { cwd: tmpdir() });
  assert.equal(readFileSync(out, 'utf8'), readFileSync(at(asset), 'utf8'));
}

test('build-workflow-template.mjs reproduces assets/estimate-template.html', () => {
  pinned('../build-workflow-template.mjs', '../../assets/estimate-template.html');
});

test('the Workflow-based template has its slots, no mockup leftovers, internal parts visible', () => {
  const t = readFileSync(at('../../assets/estimate-template.html'), 'utf8');
  assert.deepEqual([...new Set([...t.matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]))].sort(), ['DATA', 'TITLE']);
  for (const gone of ['MOCKUP', 'Sin Kowa', 'estimate-feature-mockup.html', 'estimate-mockup.html', '/*DATA*/', '<body class="client">']) {
    assert.ok(!t.includes(gone), `template still carries ${gone}`);
  }
  assert.ok(t.includes('href="estimate-components.html"'));
});

test('build-components-template.mjs reproduces assets/estimate-components.html', () => {
  pinned('../build-components-template.mjs', '../../assets/estimate-components.html');
});

test('the Component-based template is the review read-only, with tasks, price and export', () => {
  const t = readFileSync(at('../../assets/estimate-components.html'), 'utf8');
  assert.deepEqual([...new Set([...t.matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]))].sort(), ['DATA', 'MATH', 'TITLE', 'XLSX']);
  for (const want of ['const FINAL = true;', 'const TASKS = PAGE.tasks;', 'id="xlsx"', 'href="estimate.html"', 'id="method"', 'const XLSX_SOURCE']) {
    assert.ok(t.includes(want), `template lacks ${want}`);
  }
  assert.ok(!t.includes('architecture.html'));
});
