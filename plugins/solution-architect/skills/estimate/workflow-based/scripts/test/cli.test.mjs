import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = (n) => fileURLToPath(new URL(`../${n}.mjs`, import.meta.url));
const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

function stage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-'));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  inputs.measurementsPath = fx('measurements.jsonl');
  if (mutate) mutate(inputs);
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  return dir;
}

test('compute writes estimation.json with features, components and price', () => {
  const dir = stage();
  execFileSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  const out = JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8'));
  assert.deepEqual(Object.keys(out.computed).sort(), ['components', 'features', 'price']);
  assert.equal(Object.keys(out.computed.features).length, 5);
});

test('compute refuses invalid inputs and names the finding', () => {
  const dir = stage((i) => { i.features[0].tasks = []; });
  const r = spawnSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  assert.equal(r.status, 1);
  assert.match(String(r.stderr), /"tasks" belongs on components/);
});

test('validate exits 0 on a clean pair and 1 when estimation.json is stale', () => {
  const dir = stage();
  execFileSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  const ok = spawnSync('node', [script('validate'), '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json')]);
  assert.equal(ok.status, 0, String(ok.stderr));
  const est = JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8'));
  est.computed.features['FEAT-001'].point += 1;
  writeFileSync(join(dir, 'estimation.json'), JSON.stringify(est));
  const stale = spawnSync('node', [script('validate'), '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json')]);
  assert.equal(stale.status, 1);
  assert.match(String(stale.stderr), /computed block differs from a fresh recompute/);
});

test('render refuses in workflow mode until spec 3', () => {
  const dir = stage();
  const r = spawnSync('node', [script('render'), '--json', join(dir, 'estimation.json'), '--out', dir]);
  assert.equal(r.status, 2);
  assert.match(String(r.stderr), /pages come in spec 3/);
});
