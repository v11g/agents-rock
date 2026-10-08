// Python twin of review.mjs: same bytes, same refusals, same exit codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noFlows } from './scope-cases.mjs';
import { DATE, decided, drafted } from './review-fixture.mjs';

const SCRIPT = {
  node: fileURLToPath(new URL('../review.mjs', import.meta.url)),
  python3: fileURLToPath(new URL('../review.py', import.meta.url)),
};

// Runs one review command in a fresh dir; `rest` builds the flags after the script.
function runIn(cmd, pkg, rest) {
  const dir = mkdtempSync(join(tmpdir(), 'ba-review-parity-'));
  const json = join(dir, 'r.json');
  const out = join(dir, 'p.html');
  writeFileSync(json, JSON.stringify(pkg));
  const r = spawnSync(cmd, [SCRIPT[cmd], ...rest(json, out)], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout.replace(out, 'OUT'), err: r.stderr, html: existsSync(out) ? readFileSync(out, 'utf8') : null };
}

const page = (json, out) => ['page', '--json', json, '--out', out, '--date', DATE];
const both = (pkg, rest = page) => ['node', 'python3'].map((cmd) => runIn(cmd, pkg, rest));

const unicode = () => {
  const pkg = decided();
  pkg.features[0].name = 'Café order — <stage> & "pack"';
  return pkg;
};
const classic = () => {
  const pkg = decided();
  for (const k of ['systems', 'features', 'scopeMode', 'mapLabel']) delete pkg[k];
  return pkg;
};
const leak = () => {
  const pkg = decided();
  pkg.features[3].source = 'PO in interview, see FR-004';
  return pkg;
};

const pipeline = (pkg) => pkg.workflows.find((w) => w.name === 'Order pipeline');
const branchy = () => {
  const pkg = decided();
  pipeline(pkg).branches.unshift({ from: 'Extra box', to: 'Courier' });
  pipeline(pkg).branches.push({ from: 'Pack', to: 'Extra box', label: 'needs a box' },
    { from: 'Loop B', to: 'Loop A' }, { from: 'Loop A', to: 'Loop B' });
  return pkg;
};

export const PAGE_CASES = [
  ['siblings, a child before its parent, a cycle', branchy, 0],
  ['a decided package', decided, 0],
  ['markup and non-ascii text', unicode, 0],
  ['undecided drafts', drafted, 1],
  ['an id in a ★ New source', leak, 1],
  ['a system with no workflow', () => noFlows().pkg, 0],
  ['classic mode', classic, 0],
];

for (const [name, make, code] of PAGE_CASES) {
  test(`review.py page matches review.mjs: ${name}`, () => {
    const [n, p] = both(make());
    assert.deepEqual(p, n);
    assert.equal(n.code, code);
  });
}

test('review.py refuses apply and a bare flag like review.mjs', () => {
  for (const rest of [(json) => ['apply', '--json', json], (json) => ['page', '--json', json, '--out']]) {
    const [n, p] = both(decided(), rest);
    assert.deepEqual(p, n);
    assert.equal(n.code, 1);
  }
});
