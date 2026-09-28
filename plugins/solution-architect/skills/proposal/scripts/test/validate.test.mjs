import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = new URL('../validate.mjs', import.meta.url).pathname;
const computeCli = new URL('../../../estimate/scripts/compute.mjs', import.meta.url).pathname;
const inputs = new URL('../../../estimate/scripts/test/fixtures/booking-inputs.json', import.meta.url).pathname;
const passMd = new URL('./fixtures/proposal-pass.md', import.meta.url).pathname;
const failMd = new URL('./fixtures/proposal-fail.md', import.meta.url).pathname;

function estimationPath() {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-validate-'));
  const json = join(dir, 'estimation.json');
  execFileSync('node', [computeCli, '--inputs', inputs, '--out', json]);
  return json;
}

test('the pass fixture validates clean', () => {
  const out = execFileSync('node', [cli, '--md', passMd, '--estimation', estimationPath()], { encoding: 'utf8' });
  assert.match(out, /proposal deliverable valid/);
});

test('the fail fixture exits 1 and names every violation class', () => {
  let err;
  try {
    execFileSync('node', [cli, '--md', failMd, '--estimation', estimationPath()], { encoding: 'utf8' });
  } catch (e) { err = e; }
  assert.ok(err, 'expected non-zero exit');
  const findings = err.stderr.toString();
  assert.match(findings, /scenario.*removed/i);
  assert.match(findings, /Team section was removed/i);
  assert.match(findings, /Duration column/i);
  assert.match(findings, /placeholder/i);
  assert.match(findings, /valid_until/);
  assert.match(findings, /9,999|9999/);
  assert.match(findings, /"src"/);
  assert.match(findings, /jargon/i);
});
