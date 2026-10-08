import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyScope } from '../lib/scope-md.mjs';
import { mermaid } from '../lib/scope-render.mjs';
import { checkPackage } from '../lib/checks.mjs';
import { loadWorkflow, noFlows } from './scope-cases.mjs';

const script = fileURLToPath(new URL('../scope.mjs', import.meta.url));
const BLOCK = /<!-- scope:start -->[\s\S]*?<!-- scope:end -->\n*/;
const strip = (md) => md.replace(BLOCK, '');
const OLD_HERE = '> **Product owner? Start here:** [To-be scope](#to-be-scope) shows the systems, '
  + 'workflows and features we propose to build. Items marked ⚠ are our draft; tell us in chat what to change.';

test('applyScope rebuilds the fixture from a file without the section', () => {
  const { pkg, md } = loadWorkflow();
  assert.equal(applyScope(strip(md), pkg), md);
});

test('applyScope is idempotent', () => {
  const { pkg, md } = loadWorkflow();
  assert.equal(applyScope(md, pkg), md);
});

test('classic mode removes the section', () => {
  const { pkg, md } = loadWorkflow();
  pkg.scopeMode = 'classic';
  const out = applyScope(md, pkg);
  assert.equal(out, strip(md));
});

test('an old Start-here line is removed on re-run', () => {
  const { pkg, md } = loadWorkflow();
  const old = md.replace(/^(# .*)$/m, `$1\n\n${OLD_HERE}`);
  assert.equal(applyScope(old, pkg), md);
});

test('the section carries ids for engineers', () => {
  const section = loadWorkflow().md.match(BLOCK)[0];
  assert.match(section, /^### SYS-002 Orders & invoicing$/m);
  assert.match(section, /^\*\*Main workflow: WF-003 Order to cash\*\*$/m);
  assert.match(section, /^\| SYS-001 \| Warehouse operations \|/m);
});

test('no draft marks anywhere; features list their requirements', () => {
  const { md } = loadWorkflow();
  assert.doesNotMatch(md, /⚠|please confirm|Start here/);
  assert.match(md, /\| FEAT-004 \| Invoice from packed quantities \| .* \| Shipped \(in Order pipeline\); Invoice → Paid \| FR-004 \|/);
});

test('mermaid: loops back to an existing step and side exits to a new one', () => {
  const out = mermaid({ steps: ['A', 'B'], branches: [{ from: 'B', to: 'A', label: 'retry' }, { from: 'A', to: 'C' }] });
  assert.equal(out, '```mermaid\nflowchart LR\n  n0 --> n1\n  n1 -.->|retry| n0\n  n0 -.-> n2\n  n0["A"]\n  n1["B"]\n  n2["C"]\n```');
});

test('scope.mjs refuses a broken scope and leaves the md alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-scope-'));
  const { pkg, md } = loadWorkflow();
  pkg.features[1].steps = ['WF-002:Nowhere'];
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  writeFileSync(join(dir, 'r.md'), 'untouched');
  assert.throws(() => execFileSync('node', [script, '--json', join(dir, 'r.json'), '--md', join(dir, 'r.md')], { stdio: 'pipe' }));
  assert.equal(readFileSync(join(dir, 'r.md'), 'utf8'), 'untouched');
  assert.ok(md.length > 0);
});

test('a pipe inside feature text is escaped so the table holds', () => {
  const { pkg, md } = loadWorkflow();
  pkg.features[0].does = 'Moves an order | shows each stage';
  const out = applyScope(md, pkg);
  assert.match(out, /\| FEAT-001 \| Order pipeline & stage engine \| Moves an order \\\| shows each stage \|/);
});

test('a step name with a colon resolves and renders', () => {
  const { pkg, md } = loadWorkflow();
  pkg.workflows[1].steps[1] = 'Pack: scan vs order';
  pkg.workflows[1].branches = [{ from: 'Pack: scan vs order', to: 'Short-pack alert' }];
  pkg.features[0].steps[1] = 'WF-002:Pack: scan vs order';
  assert.deepEqual(checkPackage({ pkg, md: applyScope(md, pkg) }), []);
  assert.match(applyScope(md, pkg), /Order In → Pack: scan vs order → Pack Review/);
});

test('markers moved by hand stay where they are on re-run', () => {
  const { pkg, md } = loadWorkflow();
  const section = md.match(BLOCK)[0];
  const moved = md.replace(section, '').replace('## Part 2 — Process & Domain\n\n', `## Part 2 — Process & Domain\n\n${section}`);
  assert.equal(applyScope(moved, pkg), moved);
});

test('a QUICK file (no Part 2) gets the section before Part 3', () => {
  const { pkg, md } = loadWorkflow();
  const quick = strip(md).replace(/## Part 2[\s\S]*?(?=## Part 3)/, '');
  const out = applyScope(quick, pkg);
  assert.ok(out.indexOf('<!-- scope:end -->') < out.indexOf('## Part 3'));
  assert.ok(out.indexOf('## Part 1') < out.indexOf('<!-- scope:start -->'));
});

test('optional fields absent: no map column, no Replaces line', () => {
  const { pkg, md } = loadWorkflow();
  delete pkg.mapLabel;
  for (const w of pkg.workflows) delete w.replaces;
  const section = applyScope(md, pkg).match(BLOCK)[0];
  assert.match(section, /\| ID \| System \| Purpose \|\n\| --- \| --- \| --- \|\n/);
  assert.doesNotMatch(section, /Replaces today's/);
});

test('scope.mjs refuses unbalanced markers and leaves the md alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-scope-'));
  const { pkg, md } = loadWorkflow();
  const broken = md.replace('<!-- scope:end -->', '');
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  writeFileSync(join(dir, 'r.md'), broken);
  assert.throws(() => execFileSync('node', [script, '--json', join(dir, 'r.json'), '--md', join(dir, 'r.md')], { stdio: 'pipe' }));
  assert.equal(readFileSync(join(dir, 'r.md'), 'utf8'), broken);
});

test('a pipe inside a feature name passes the Feature column check', () => {
  const { pkg, md } = loadWorkflow();
  pkg.features[0].name = 'Pack | ship';
  const out = applyScope(md, pkg).replace('| in | Order pipeline & stage engine |', '| in | Pack \\| ship |');
  assert.deepEqual(checkPackage({ pkg, md: out }), []);
});

test('a system with no workflow shows its feature table only; no step reads —', () => {
  const { pkg, md } = noFlows();
  const out = applyScope(md, pkg);
  assert.ok(out.includes('### SYS-002 Orders & invoicing\n\nQuotation through to a paid invoice.\n\n| ID | Feature |'));
  assert.ok(out.includes('| FEAT-003 | Order intake & quotation | Captures email and phone orders and prices them | — | FR-003 |'));
});

test('a system with no workflows key renders like an empty list', () => {
  const { pkg, md } = noFlows();
  const want = applyScope(md, pkg);
  delete pkg.systems[1].workflows;
  assert.equal(applyScope(md, pkg), want);
});
