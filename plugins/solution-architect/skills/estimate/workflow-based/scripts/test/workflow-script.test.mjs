import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../../../../../workflows/review-links.js', import.meta.url));

test('review-links.js starts with a literal meta and has the two phases', () => {
  const src = readFileSync(path, 'utf8');
  assert.match(src, /^export const meta = \{/);
  const meta = src.slice(0, src.indexOf('\n}\n') + 2);
  assert.doesNotMatch(meta, /\$\{|\.\.\.|\w+\(/); // pure literal: no interpolation, spread or call
  assert.match(src, /phase\('Review'\)/);
  assert.match(src, /phase\('Verify'\)/);
  assert.match(src, /return verified\.filter\(Boolean\)\.filter\(\(f\) => f\.verdict === 'ACCEPT'\)/);
  assert.doesNotMatch(src, /Date\.now|Math\.random|import\(/);
});

test('review-links keeps the proposer\'s why and survives a skipped reviewer', () => {
  const src = readFileSync(path, 'utf8');
  assert.match(src, /review\?\.findings \?\? \[\]/);
  assert.doesNotMatch(src, /\{ \.\.\.f, \.\.\.v \}/); // a verdict must not overwrite the link's why
  assert.match(src, /verifyWhy: v\.why/);
});
