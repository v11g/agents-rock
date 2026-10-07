import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const builder = fileURLToPath(new URL('../build-template.mjs', import.meta.url));
const committed = fileURLToPath(new URL('../../assets/score-review.html', import.meta.url));

// Every edit to the template lives in the builder, so a rebuild from the
// mockup never silently undoes one.
test('build-template.mjs reproduces assets/score-review.html byte for byte', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'wf-tpl-')), 'score-review.html');
  execFileSync('node', [builder, '--out', out], { cwd: tmpdir() });
  assert.equal(readFileSync(out, 'utf8'), readFileSync(committed, 'utf8'));
});
