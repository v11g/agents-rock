import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs';
const FRONT = '---\nelectedDocs: [{"name":"threat-model","elected":false,"reason":"r"},{"name":"interface-contract","elected":false,"reason":"r"},{"name":"estimation","elected":false,"reason":"r"},{"name":"domain-overview","elected":false,"reason":"r"}]\n---\n\n';
const GOALS = '## 13 Quality Requirements and SLOs\n\n| Goal | Target | Brief says | src |\n| --- | --- | --- | --- |\n| Uptime | 99.9% | "q" | stated |\n| Integration | 5 min | "q" | stated |\n| Speed (gives way first) | 2s | "q" | stated |\n';

function validate(body) {
  const dir = mkdtempSync(join(tmpdir(), 'strategy-cli-'));
  writeFileSync(join(dir, 'ARCHITECTURE.md'), FRONT + body);
  writeFileSync(join(dir, 'model.json'), JSON.stringify({ elements: {} }));
  return spawnSync('node', [CLI, '--root', dir,
    '--arch', join(dir, 'ARCHITECTURE.md'), '--model', join(dir, 'model.json')], { encoding: 'utf8' });
}

test('§4 bullets: WARN printed, exit 0', () => {
  const r = validate('## 4 Solution Strategy\n\n- Single app → ADR-001\n\n' + GOALS);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^WARN \[strategy\] §4 is a list/m);
  assert.match(r.stdout, /all checks passed/);
});

test('unserved goal: FAIL printed, exit 1', () => {
  const strategy = '## 4 Solution Strategy\n\n| Decision | Serves | ADR | src |\n| --- | --- | --- | --- |\n| Single app | Uptime, Integration | ADR-001 | proposed |\n\n';
  const r = validate(strategy + GOALS);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL \[strategy\] §13 goal "speed"/m);
});
