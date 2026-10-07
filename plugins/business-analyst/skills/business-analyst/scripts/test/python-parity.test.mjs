import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, loadWorkflow } from './scope-cases.mjs';

const py = fileURLToPath(new URL('../validate.py', import.meta.url));
const js = fileURLToPath(new URL('../validate.mjs', import.meta.url));
const fx = (f) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url));

function run(cmd, script, jsonPath, mdPath) {
  try {
    const out = execFileSync(cmd, [script, '--json', jsonPath, '--md', mdPath], { encoding: 'utf8' });
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? '', err: e.stderr ?? '' };
  }
}

test('python validator accepts the pass pair like node', () => {
  const p = run('python3', py, fx('requirements-pass.json'), fx('requirements-pass.md'));
  assert.equal(p.code, 0);
  assert.match(p.out, /requirements package valid/);
});

test('python validator reports identical findings on the fail fixture', () => {
  const n = run('node', js, fx('requirements-fail.json'), fx('requirements-pass.md'));
  const p = run('python3', py, fx('requirements-fail.json'), fx('requirements-pass.md'));
  assert.equal(p.code, 1);
  assert.equal(p.err.trim(), n.err.trim());
});

test('python and node agree on a mutated package (status + blocker + md sync)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-parity-'));
  const pkg = JSON.parse(readFileSync(fx('requirements-pass.json'), 'utf8'));
  pkg.status = 'READY_FOR_ARCHITECTURE';
  pkg.requirements[0].text = 'The system must be fast.';
  const jsonPath = join(dir, 'requirements.json');
  writeFileSync(jsonPath, JSON.stringify(pkg));
  const md = readFileSync(fx('requirements-pass.md'), 'utf8').replaceAll('ASM-001', 'ASM-009');
  const mdPath = join(dir, 'requirements.md');
  writeFileSync(mdPath, md);
  const n = run('node', js, jsonPath, mdPath);
  const p = run('python3', py, jsonPath, mdPath);
  assert.equal(n.code, 1);
  assert.equal(p.code, 1);
  assert.equal(p.err.trim(), n.err.trim());
});

const pyScope = fileURLToPath(new URL('../scope.py', import.meta.url));
const jsScope = fileURLToPath(new URL('../scope.mjs', import.meta.url));

function writePair(pkg, md) {
  const dir = mkdtempSync(join(tmpdir(), 'ba-parity-'));
  const jsonPath = join(dir, 'requirements.json');
  const mdPath = join(dir, 'requirements.md');
  writeFileSync(jsonPath, JSON.stringify(pkg));
  writeFileSync(mdPath, md);
  return { jsonPath, mdPath };
}

test('python validator accepts the workflow pass pair like node', () => {
  const p = run('python3', py, fx('requirements-workflow-pass.json'), fx('requirements-workflow-pass.md'));
  assert.equal(p.code, 0);
});

for (const c of CASES) {
  test(`python and node agree on scope rule: ${c.name}`, () => {
    const { pkg, md } = c.edit(loadWorkflow());
    const { jsonPath, mdPath } = writePair(pkg, md);
    const n = run('node', js, jsonPath, mdPath);
    const p = run('python3', py, jsonPath, mdPath);
    assert.equal(n.code, 1);
    assert.equal(p.code, 1);
    assert.equal(p.err.trim(), n.err.trim());
  });
}

test('scope.py writes the same bytes as scope.mjs', () => {
  const { pkg, md } = loadWorkflow();
  const bare = md.replace(/<!-- scope:start -->[\s\S]*?<!-- scope:end -->\n*/, '');
  const a = writePair(pkg, bare);
  const b = writePair(pkg, bare);
  assert.equal(run('node', jsScope, a.jsonPath, a.mdPath).code, 0);
  assert.equal(run('python3', pyScope, b.jsonPath, b.mdPath).code, 0);
  assert.equal(readFileSync(b.mdPath, 'utf8'), readFileSync(a.mdPath, 'utf8'));
  assert.equal(readFileSync(a.mdPath, 'utf8'), md);
});

test('scope.py and scope.mjs agree on escaped pipes and a colon step', () => {
  const { pkg, md } = loadWorkflow();
  pkg.features[0].does = 'Moves an order | shows each stage';
  pkg.workflows[1].steps[1] = 'Pack: scan';
  pkg.workflows[1].branches = [{ from: 'Pack: scan', to: 'Short-pack alert' }];
  pkg.features[0].steps[1] = 'WF-002:Pack: scan';
  const a = writePair(pkg, md);
  const b = writePair(pkg, md);
  assert.equal(run('node', jsScope, a.jsonPath, a.mdPath).code, 0);
  assert.equal(run('python3', pyScope, b.jsonPath, b.mdPath).code, 0);
  assert.equal(readFileSync(b.mdPath, 'utf8'), readFileSync(a.mdPath, 'utf8'));
});
