import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');

// Both eval runs stalled in the same place: the target came from the client and
// the priority came from the agent, and one `src` cell cannot say both. One run
// reasoned that an unsupplied priority makes the tag `assumed`, which under the
// blocker rule would have failed every row in its §13.
test('drivers.md says which cell the src tag describes', () => {
  const doc = ref('drivers.md');
  assert.match(doc, /`src`[^.]*target|target[^.]*`src`/,
    'the reference must tie src to the target cell');
  assert.match(doc, /priority/i, 'and say what a priority nobody assigned does to the row');
});

// A quality the user rules out — "n/a, it's a CLI, there is nothing to keep up"
// — is an answered question, not an unasked one. The five columns have no legal
// shape for it, because `priority` is must | should | could, and one run moved
// it to prose while the honest-absence rule pointed at a table cell.
test('drivers.md gives a ruled-out quality somewhere to go', () => {
  const doc = ref('drivers.md');
  assert.match(doc, /ruled out|does not apply|Not applicable/,
    'a quality the user rules out needs a defined rendering');
});
