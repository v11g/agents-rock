import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashText, sectionHashes, writeState } from '../lib/state.mjs';

const CLI = 'plugins/solution-architect/skills/analyze-requirements/scripts/drift.mjs';

const GENERATED = `## 1 Goals and Scope

Assign delivery jobs to drivers. \`stated\`

## 7 Runtime Behaviour

Job created → row written ready → worker claims it. \`stated\`
`;

// The bug, end to end: run 1 writes and records, a person edits §7, run 2 must
// see it. Before this feature existed, run 2 overwrote it with no diff and no
// warning, and the edit was unrecoverable unless it had been committed.
test('a hand edit survives the next run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rerun-safety-regression-'));
  const arch = join(dir, 'ARCHITECTURE.md');
  const statePath = join(dir, 'architecture-state.json');

  // Run 1 — the skill writes the package and records what it wrote, last.
  writeFileSync(arch, GENERATED);
  writeState(statePath, {
    revision: 1,
    gitCommit: null,
    files: { 'ARCHITECTURE.md': { hash: hashText(GENERATED), sections: sectionHashes(GENERATED) } },
  });

  // A person rewrites §7 by hand.
  const edited = GENERATED.replace('worker claims it', 'worker claims it under a 60 s lease');
  writeFileSync(arch, edited);

  // Run 2 — the pre-write gate.
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', [CLI, '--state', statePath, '--files', 'ARCHITECTURE.md'], { encoding: 'utf8' });
  } catch (err) {
    code = err.status;
    stdout = err.stdout;
  }

  assert.equal(code, 2, 'run 2 must stop rather than write');
  assert.match(stdout, /changed: §7/);
  assert.equal(readFileSync(arch, 'utf8'), edited, 'the edit must still be on disk');
});
