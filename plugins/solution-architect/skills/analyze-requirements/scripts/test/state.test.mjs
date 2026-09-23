import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, hashText } from '../lib/state.mjs';

// Line endings, trailing spaces and how many newlines a file ends with are
// editor artefacts. If they changed the hash, every run would report drift on
// files nobody touched, and people would learn to answer "overwrite" without
// reading — which is worse than having no guard at all.
test('editor artefacts hash the same', () => {
  const base = '# Title\n\nbody\n';
  for (const variant of ['# Title\r\n\r\nbody\r\n', '# Title\n\nbody   \n', '# Title\n\nbody\n\n\n']) {
    assert.equal(hashText(variant), hashText(base), JSON.stringify(variant));
  }
});

// The other half of the same rule: normalisation must not be so eager that a
// real edit hashes as unchanged. That is the failure that loses data silently.
test('a real edit hashes differently', () => {
  assert.notEqual(hashText('# Title\n\nbody\n'), hashText('# Title\n\nBody\n'));
  assert.notEqual(hashText('| a | b |\n'), hashText('| a  | b |\n'));
});

test('normalise leaves exactly one trailing newline', () => {
  assert.equal(normalise('a'), 'a\n');
  assert.equal(normalise('a\n\n\n'), 'a\n');
});

test('a hash is labelled with its algorithm', () => {
  assert.match(hashText('x'), /^sha256:[0-9a-f]{64}$/);
});
