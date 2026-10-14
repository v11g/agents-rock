import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('..', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.py'));

// A function runs from its `def` line to the next top-level line.
function functions(src) {
  const lines = src.split('\n');
  const out = [];
  lines.forEach((l, i) => {
    const m = /^def (\w+)\(([^)]*)\)/.exec(l);
    if (!m) return;
    let end = i + 1;
    while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end += 1;
    while (lines[end - 1] === '') end -= 1;
    out.push({ name: m[1], params: m[2].split(',').filter((p) => p.trim()).length, lines: end - i });
  });
  return out;
}

test('there are Python scripts to gate', () => {
  assert.ok(files.length >= 8, files.join(', '));
});

for (const f of files) {
  test(`gates: ${f}`, () => {
    const src = readFileSync(dir + f, 'utf8');
    const fns = functions(src);
    assert.ok(src.split('\n').length <= 200, `${f}: over 200 lines`);
    assert.ok(fns.length <= 10, `${f}: ${fns.length} functions`);
    for (const fn of fns) {
      assert.ok(fn.lines <= 20, `${f} ${fn.name}: ${fn.lines} lines`);
      assert.ok(fn.params <= 3, `${f} ${fn.name}: ${fn.params} params`);
    }
  });
}
