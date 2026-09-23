import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');

function bankRows() {
  const doc = ref('interview.md');
  const bank = doc.slice(doc.indexOf('## Question bank'), doc.indexOf('## Card batching'));
  return bank.split('\n')
    .filter((l) => l.startsWith('| ') && !/^\|\s*-+/.test(l))
    .slice(1)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .map(([section, question, mode, skip]) => ({ section, question, mode, skip }));
}

// The cap is prose and the bank is a table; nothing held them to each other.
test('the question bank stays inside the interview cap', () => {
  const rows = bankRows();
  assert.ok(rows.length <= 12, `bank has ${rows.length} questions, cap is 12`);
});

// A never-skippable question that only makes sense after another one has been
// answered is skippable by ordering: an eval run stalled on the cull probe and
// asked neither of the two rows behind it. Each never-skippable row has to
// stand on its own.
test('every never-skippable question stands alone', () => {
  for (const row of bankRows()) {
    if (!/^never/i.test(row.skip)) continue;
    assert.doesNotMatch(row.question,
      /you kept|that quality|the quality you|from above|previous answer/i,
      `never-skippable question depends on another answer: ${row.question}`);
  }
});

// The top-three/drop-one probe is the one §13 question whose signal the cap may
// buy out. Marked never-skippable it competes with the two rows that carry the
// measurable target, which is how it came to gate them.
test('the cull probe is optional, and the target question is not', () => {
  const rows = bankRows().filter((r) => r.section.includes('13'));
  const cull = rows.find((r) => /drop one/i.test(r.question));
  assert.ok(cull, '§13 cull probe not found');
  assert.match(cull.skip, /optional/i, 'the cull probe must be skippable under the cap');
  const target = rows.find((r) => /measurable target/i.test(r.question));
  assert.ok(target, '§13 measurable-target question not found');
  assert.match(target.skip, /^never/i, 'the measurable target must stay never-skippable');
  assert.doesNotMatch(target.question, /^For the quality/i, 'it must name its own subject');
});
