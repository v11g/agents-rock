import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPINE_TITLES } from '../lib/section-help.mjs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const KNOWLEDGE = ['patterns.md', 'decision-rules.md', 'decisions.md'];
const ALL = ['interview.md', 'likec4.md', 'project-types.md', 'research.md', 'viewer.md',
  'writing.md', 'patterns.md', 'decision-rules.md', 'decisions.md'];

test('no reference doc carries placeholders', () => {
  for (const f of ALL) assert.doesNotMatch(ref(f), /\bTBD\b|\bTODO\b/, f);
});

// The knowledge references are restated in our own words. A chapter number, a
// book title or an author's name turns them into a quotation we have no licence
// to ship, and the skill's output voice forbids citing one either way.
test('the knowledge references carry no borrowed attribution', () => {
  for (const f of KNOWLEDGE) {
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

// mattpocock's three-part gate decides whether an ADR is written at all. The
// significance tests say how to answer it without guessing, so the gate has to
// still be there — a second gate is two rules and no way to choose between them.
test('the ADR gate stays single and becomes answerable', () => {
  assert.match(ref('writing.md'), /three-part gate/, 'mattpocock gate must remain the one gate');
  const doc = ref('decisions.md');
  assert.match(doc, /only gate/, 'decisions.md must defer to that gate, not add one');
  for (const test of ['boundaries', 'data ownership', 'contracts between parts',
    'operational dependency', 'cost of future change']) {
    assert.ok(doc.includes(test), `decisions.md missing significance test: ${test}`);
  }
});

// One blended number hides which cost the reader can actually act on, and the
// three that are not build effort are the ones estimate never sees.
test('decisions.md keeps the four technology costs apart', () => {
  const doc = ref('decisions.md');
  for (const cost of ['Build', 'Operate', 'Infrastructure', 'Switching']) {
    assert.match(doc, new RegExp(`\\|\\s*${cost}\\s*\\|`), `decisions.md missing cost row: ${cost}`);
  }
  assert.match(doc, /class of choice|class, not the product/i, 'class-over-product rule missing');
});

// A rendered document looks equally authoritative whether or not anyone agreed
// with it, so the record has to carry who agreed and when.
test('decisions.md requires a named acceptance', () => {
  const doc = ref('decisions.md');
  assert.match(doc, /named decision-maker/i);
  assert.match(doc, /silence/i, 'the never-read-silence-as-agreement rule must be stated');
});

// writing.md already mandates a Considered Options section. Nothing said the
// options had to be real, which is the cheaper way to fill one in.
test('decisions.md bans the strawman option', () => {
  const doc = ref('decisions.md');
  assert.match(doc, /strawman/i, 'the strawman ban must be explicit');
  assert.match(doc, /two credible|at least two/i);
  assert.match(doc, /hard constraint/i, 'hard constraints must filter before comparison');
  assert.match(doc, /current approach|keep the current/i, 'the do-nothing option must be considered');
});

// A slogan reads like analysis and costs nothing to write. Each row names the
// mechanism the claim is worthless without.
test('decision-rules.md makes slogan claims show their mechanism', () => {
  const doc = ref('decision-rules.md');
  for (const claim of ['Async', 'cache', 'eventually consistent']) {
    assert.ok(doc.includes(claim), `decision-rules.md missing mechanism row: ${claim}`);
  }
  assert.match(doc, /invalidation/i, 'the cache row must demand an invalidation path');
});

// One home applies to these files too. The communication defaults live in
// decision-rules.md; a second copy in decisions.md is how the two drift.
test('the coupling defaults have exactly one home', () => {
  const homes = KNOWLEDGE.filter((f) => /Reuse is coupling/i.test(ref(f)));
  assert.deepEqual(homes, ['decision-rules.md'], `coupling defaults duplicated in: ${homes.join(', ')}`);
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

// None of them may grow a spine heading of its own — writing.md is the only home
// for the 16, and a second list is how they drift apart.
test('the knowledge references do not restate the spine', () => {
  for (const f of KNOWLEDGE) {
    const doc = ref(f);
    const echoed = SPINE_TITLES.filter((t) => doc.includes(`## ${t}`));
    assert.deepEqual(echoed, [], `${f} restates spine headings: ${echoed.join(', ')}`);
  }
});

// Scoped to the files this suite introduces. The older references predate the
// limit and viewer.md is legitimately long; holding them to it here would be a
// rewrite disguised as a test.
test('the knowledge references stay inside the file-length limit', () => {
  for (const f of KNOWLEDGE) {
    const lines = ref(f).split('\n').length;
    assert.ok(lines <= 200, `${f} is ${lines} lines, limit is 200`);
  }
});
