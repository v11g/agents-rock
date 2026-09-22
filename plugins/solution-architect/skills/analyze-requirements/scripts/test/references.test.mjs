import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPINE_TITLES } from '../lib/section-help.mjs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const ALL = ['interview.md', 'likec4.md', 'project-types.md', 'research.md', 'viewer.md',
  'writing.md', 'patterns.md', 'decision-rules.md'];

test('no reference doc carries placeholders', () => {
  for (const f of ALL) assert.doesNotMatch(ref(f), /\bTBD\b|\bTODO\b/, f);
});

// These two are working knowledge restated in our own words. A chapter number, a
// book title or an author's name turns them into a quotation we have no licence
// to ship, and the skill's output voice forbids citing one either way.
test('the knowledge references carry no borrowed attribution', () => {
  for (const f of ['patterns.md', 'decision-rules.md']) {
    assert.doesNotMatch(ref(f), /First Law|Second Law|Weirich|the authors\b/i, f);
  }
});

// writing.md owns the ADR contract (mattpocock's format, Considered Options always
// present). A second template anywhere in references/ gives the writer two shapes
// to follow and no rule for picking one.
test('patterns.md does not prescribe a competing ADR template', () => {
  const doc = ref('patterns.md');
  assert.doesNotMatch(doc, /Superseded\)|Compliance \(manual/i, 'ADR template must live only in writing.md');
});

test('patterns.md covers the techniques the spine sections need', () => {
  const doc = ref('patterns.md');
  for (const needle of ['Trade-Off Analysis', 'Architecture Quantum', 'Fitness Functions',
    'Event Storming', 'Saga Pattern', 'Risk Matrix']) {
    assert.ok(doc.includes(needle), `patterns.md missing: ${needle}`);
  }
});

test('decision-rules.md scores every style the selection tree can reach', () => {
  const doc = ref('decision-rules.md');
  for (const style of ['Layered', 'Pipeline', 'Microkernel', 'Service-Based', 'Space-Based',
    'Microservices']) {
    assert.ok(doc.includes(style), `decision-rules.md missing style: ${style}`);
  }
});

// The scorecard ranks styles in the general case. Cited as a measurement of the
// project being documented it is a fabricated fact, so the caveat ships with it.
test('decision-rules.md disclaims the scorecard', () => {
  assert.match(ref('decision-rules.md'), /not\*{0,2}\s+measurements of your system/i);
});

// Neither file may grow a spine heading of its own — writing.md is the only home
// for the 16, and a second list is how they drift apart.
test('the knowledge references do not restate the spine', () => {
  for (const f of ['patterns.md', 'decision-rules.md']) {
    const doc = ref(f);
    const echoed = SPINE_TITLES.filter((t) => doc.includes(`## ${t}`));
    assert.deepEqual(echoed, [], `${f} restates spine headings: ${echoed.join(', ')}`);
  }
});

// Scoped to the two files this suite introduces. The older references predate the
// limit and viewer.md is legitimately long; holding them to it here would be a
// rewrite disguised as a test.
test('the knowledge references stay inside the file-length limit', () => {
  for (const f of ['patterns.md', 'decision-rules.md']) {
    const lines = ref(f).split('\n').length;
    assert.ok(lines <= 200, `${f} is ${lines} lines, limit is 200`);
  }
});
