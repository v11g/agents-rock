import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/ba-facts.mjs';
const PKG = {
  schemaVersion: '1.0', updated: '2026-10-01',
  requirements: [
    { id: 'FR-001', text: 'Members book up to 4 courts per week.', label: 'confirmed', source: 'kickoff call 2026-09-20' },
    { id: 'FR-002', text: 'Members pay a deposit online.', label: 'recommended' },
  ],
};

function run(content) {
  const dir = mkdtempSync(join(tmpdir(), 'ba-facts-'));
  writeFileSync(join(dir, 'requirements.json'), content);
  const out = join(dir, 'ba.json');
  const r = spawnSync('node', [CLI, '--json', join(dir, 'requirements.json'), '--out', out], { encoding: 'utf8' });
  return { r, out, dir };
}

test('splits confirmed facts from proposed rows', () => {
  const { r, out, dir } = run(JSON.stringify(PKG));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^ok 1 confirmed facts, 1 not confirmed/m);
  const { facts, proposed } = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(facts.map((f) => [f.id, f.cite, f.path]), [
    ['FR-001', 'FR-001 · kickoff call 2026-09-20', join(dir, 'requirements.json')],
  ]);
  assert.deepEqual(proposed.map((f) => [f.id, f.label]), [['FR-002', 'recommended']]);
});

test('a file that is not a package fails', () => {
  const { r } = run('{"port": 8080}');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL .* is not a requirements package/m);
});

test('invalid JSON fails the same way', () => {
  const { r } = run('{"port": ');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /is not a requirements package/);
});

test('a missing --json or --out prints usage and exits 1', () => {
  const usage = 'FAIL usage: ba-facts.mjs --json <requirements.json> --out <file>';
  for (const args of [[], ['--json', 'x.json'], ['--out', 'o.json']]) {
    const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(r.stdout.trim(), usage);
  }
});
