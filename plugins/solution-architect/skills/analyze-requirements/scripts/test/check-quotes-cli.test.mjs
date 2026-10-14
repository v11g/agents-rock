import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/check-quotes.mjs';

function check(facts) {
  const dir = mkdtempSync(join(tmpdir(), 'check-quotes-'));
  const call = join(dir, 'C1.txt');
  writeFileSync(call, 'Maya: We pay for Azure already, so it has to run there.\n');
  const withPath = facts.map((f) => ({ section: 'constraints', src: 'C1', date: '2026-09-10', path: call, ...f }));
  writeFileSync(join(dir, 'in.json'), JSON.stringify({ facts: withPath }));
  const r = spawnSync('node', [CLI, '--facts', join(dir, 'in.json'), '--out', join(dir, 'out.json')], { encoding: 'utf8' });
  return { r, out: JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8')) };
}

test('all quotes found: exit 0, every fact kept', () => {
  const { r, out } = check([{ fact: 'must run on Azure', quote: 'it has to run there' }]);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(out.facts.length, 1);
  assert.deepEqual(out.misses, []);
});

test('a reworded quote is a miss with the closest sentence; the rest are kept', () => {
  const { r, out } = check([
    { fact: 'Azure', quote: 'it has to run there' },
    { fact: 'Azure', quote: 'it must run on Azure' },
  ]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^MISS \[C1\] "it must run on Azure" — closest: "Maya: We pay for Azure/m);
  assert.equal(out.facts.length, 1);
  assert.equal(out.misses[0].closest.startsWith('Maya: We pay'), true);
});

test('an unreadable input file is a miss, not a crash', () => {
  const { r, out } = check([{ fact: 'x', quote: 'y', path: '/nonexistent/C9.txt', src: 'C9' }]);
  assert.equal(r.status, 1);
  assert.match(out.misses[0].closest, /file not readable/);
});

test('an empty or missing quote is a miss, not a pass or a crash', () => {
  const { r, out } = check([{ fact: 'a', quote: '' }, { fact: 'b' }]);
  assert.equal(r.status, 1);
  assert.equal(out.misses.length, 2);
  assert.equal(out.misses.every((m) => m.closest === 'empty quote'), true);
});
