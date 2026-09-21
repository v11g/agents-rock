import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SKILLS_DIR = path.join(process.cwd(), 'plugins', 'reasoning', 'skills');

function contractCopies() {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_DIR, entry.name, 'references', 'contract.md'))
    .filter((file) => existsSync(file));
}

test('every reasoning skill carries a contract copy', () => {
  const copies = contractCopies();
  assert.ok(
    copies.length >= 2,
    `expected at least 2 contract.md copies, found ${copies.length}`,
  );
});

test('contract copies are byte-identical', () => {
  const copies = contractCopies();
  const digests = copies.map((file) => ({
    file: path.relative(process.cwd(), file),
    hash: createHash('sha256').update(readFileSync(file)).digest('hex'),
  }));
  const [first, ...rest] = digests;
  for (const other of rest) {
    assert.equal(
      other.hash,
      first.hash,
      `${other.file} has drifted from ${first.file} — copy the canonical file to all skills`,
    );
  }
});
