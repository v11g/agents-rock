import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPINE_TITLES } from '../lib/section-help.mjs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const KNOWLEDGE = ['patterns.md', 'decision-rules.md', 'decisions.md', 'drivers.md',
  'validation.md'];
const ALL = ['interview.md', 'likec4.md', 'project-types.md', 'research.md', 'viewer.md',
  'writing.md', 'patterns.md', 'decision-rules.md', 'decisions.md', 'drivers.md',
  'validation.md'];

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

// §13 renders five columns, so the scenario's six fields have to survive inside
// them — the conditions and the element cannot quietly drop out of the cell.
test('drivers.md defines the scenario the five-column shape carries', () => {
  const doc = ref('drivers.md');
  for (const field of ['stimulus', 'environment', 'element', 'response', 'measure', 'target']) {
    assert.ok(doc.includes(field), `drivers.md missing scenario field: ${field}`);
  }
  assert.match(doc, /must.*should.*could/i, 'priority scale missing');
});

// The whole point of the fifth provenance word. Without this rule `assumed` is
// just a quieter `proposed`.
test('drivers.md blocks on an assumed must-target', () => {
  const doc = ref('drivers.md');
  assert.match(doc, /assumed/, 'the rule must name the tag');
  assert.match(doc, /blocker/i);
});

// "Fast" is not a driver. Converting what a stakeholder says into something the
// architecture can be measured against is the step that gets skipped.
test('drivers.md converts domain language into characteristics', () => {
  const doc = ref('drivers.md');
  assert.match(doc, /time to market|user satisfaction/i, 'translation examples missing');
  assert.match(doc, /top three/i, 'the top-three rule must be present');
});

// writing.md §1 tables the per-section column contract. §13 was the one row with
// no columns named, which is how it stayed a list of adjectives.
test('writing.md names the section 13 columns', () => {
  const row = ref('writing.md').split('\n')
    .find((l) => l.includes('Quality Requirements & SLOs') && l.trim().startsWith('13'));
  assert.ok(row, 'spine row for 13 not found');
  for (const col of ['scenario', 'measure', 'target', 'priority']) {
    assert.ok(row.includes(col), `spine row 13 missing column: ${col}`);
  }
});

// A plan and a result read the same once they are both on the page, and the
// plan is the one that is free to write.
test('validation.md separates planned from evidenced', () => {
  const doc = ref('validation.md');
  assert.match(doc, /planned/i);
  assert.match(doc, /never .*passed|not .*passed/i, 'a planned check must never be reported as passed');
  for (const field of ['result', 'environment', 'date', 'artifact']) {
    assert.ok(doc.includes(field), `validation.md missing evidence field: ${field}`);
  }
});

// The plan's rows are work someone has to do. Left unpriced they are the part of
// the estimate that surfaces after the contract is signed.
test('validation.md says its checks are estimable work', () => {
  assert.match(ref('validation.md'), /estimate/i);
});

// The interview bank's own contracts — the cap and the never-skippable rows —
// live in interview.test.mjs, which keeps this file inside the length limit.
