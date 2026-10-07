import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { staged, script } from './stage.mjs';

const pageOf = (html) => JSON.parse(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const render = (dir, out = join(dir, 'dist')) => spawnSync('node', [script('render'), '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json'), '--out', out]);

test('render writes both pages and warns when the viewer is missing', () => {
  const dir = staged();
  const r = render(dir);
  assert.equal(r.status, 0, String(r.stderr));
  assert.match(String(r.stdout), /Architecture viewer not found in dist\//);
  const wf = readFileSync(join(dir, 'dist', 'estimate.html'), 'utf8');
  assert.ok(!wf.includes('<!-- slot:'));
  const p = pageOf(wf);
  assert.equal(p.data.systems.length, 2);
  assert.deepEqual(p.register.exclusions, ['last-mile delivery tracking', 'Hosting and third-party subscription fees']);
  assert.equal(p.view.price.presentLow, JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8')).computed.price.presentLow);
  const cp = pageOf(readFileSync(join(dir, 'dist', 'estimate-components.html'), 'utf8'));
  assert.deepEqual(cp.tasks['api.billing'][0], ['Three-way match', 1, 2.17, 4, 'UNCALIBRATED', '']);
  assert.equal(cp.xlsx.rows.length, 5);
  assert.equal(cp.arch, 'index.html');
});

test('no warning when the architecture viewer sits in dist/', () => {
  const dir = staged();
  execFileSync('mkdir', ['-p', join(dir, 'dist')]);
  writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html>');
  const r = render(dir);
  assert.equal(r.status, 0);
  assert.doesNotMatch(String(r.stdout), /viewer not found/);
});

test('render refuses a stale estimation.json and writes nothing', () => {
  const dir = staged();
  const est = JSON.parse(readFileSync(join(dir, 'estimation.json'), 'utf8'));
  est.computed.features['FEAT-001'].point += 1;
  writeFileSync(join(dir, 'estimation.json'), JSON.stringify(est));
  const r = render(dir);
  assert.equal(r.status, 1);
  assert.match(String(r.stderr), /computed block differs/);
  assert.equal(existsSync(join(dir, 'dist', 'estimate.html')), false);
});

test('render refuses invalid inputs', () => {
  const dir = staged();
  const inputs = JSON.parse(readFileSync(join(dir, 'estimation-inputs.json'), 'utf8'));
  inputs.exclusions = [''];
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  assert.equal(render(dir).status, 1);
});
