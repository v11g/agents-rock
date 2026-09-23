import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPINE_TITLES, normTitle, sectionHelp, serialiseHelp } from '../lib/section-help.mjs';

const help = sectionHelp();

// references/writing.md states the spine headings never change, which is what
// makes the heading text a usable key. If a heading is renamed there, this test
// is the thing that says the explainer no longer reaches it.
test('every canonical spine heading has an explainer', () => {
  assert.equal(SPINE_TITLES.length, 16);
  for (const title of SPINE_TITLES) {
    assert.ok(help.spine[title], `no explainer for "${title}"`);
  }
});

// An entry keyed on a heading that does not exist is dead weight that looks
// like coverage.
test('no explainer is keyed on a heading that does not exist', () => {
  assert.deepEqual(Object.keys(help.spine).sort(), [...SPINE_TITLES].sort());
});

test('the elected companions have an explainer and nothing else does', () => {
  assert.deepEqual(Object.keys(help.companions).sort(),
    ['domain-overview', 'estimation', 'threat-model', 'validation-plan']);
});

// An empty field renders as a blank row in the panel, which reads as a bug
// rather than as an absence.
test('every explainer states all three fields', () => {
  const all = [...Object.entries(help.spine), ...Object.entries(help.companions)];
  assert.equal(all.length, SPINE_TITLES.length + 4);
  for (const [key, entry] of all) {
    for (const field of ['what', 'why', 'good']) {
      assert.equal(typeof entry[field], 'string', `${key}.${field} is not a string`);
      assert.ok(entry[field].trim().length > 20, `${key}.${field} is too short to help`);
    }
  }
});

// The JSON is embedded into an inline <script> the same way THEME is. Prose is
// author-written and may legitimately contain "<", so an unescaped "</script"
// anywhere in it would end the element early and inject the rest as markup.
// themeJson gets away with a raw splice because a palette file is hex and keys;
// this is sentences.
test('serialising escapes every < so it cannot close the script element', () => {
  const out = serialiseHelp({ spine: { X: { what: 'a </script> b', why: 'c', good: 'd' } } });
  assert.doesNotMatch(out, /</);
  assert.match(out, /\\u003c/);
  assert.deepEqual(JSON.parse(out).spine.X.what, 'a </script> b');
});

// The keys came from references/writing.md, which tables the spine with the
// section number in its own column and an "&" in the title. The generator does
// not write headings that way: a real set (NoveonProposal/ARCHITECTURE.md) emits
// "## 1 Goals and Scope" — number folded into the heading, "and" spelled out. So
// every one of the 16 exact-match lookups missed and the viewer drew no buttons
// at all, while the hand-written fixture agreed with the mistake and 415 tests
// passed. These are the headings as a generator actually writes them.
const REAL_HEADINGS = [
  '1 Goals and Scope', '2 Constraints', '3 Project Structure', '4 Solution Strategy',
  '5 Architecture Model', '6 Core Components', '7 Runtime Behaviour', '8 Data Stores',
  '9 External Integrations', '10 Deployment and Infrastructure', '11 Crosscutting Concepts',
  '12 Security', '13 Quality Requirements and SLOs', '14 Decisions',
  '15 Risks and Technical Debt', '16 Glossary',
];

test('every heading a generator really writes resolves to an explainer', () => {
  const byNorm = new Map(SPINE_TITLES.map((t) => [normTitle(t), t]));
  for (const heading of REAL_HEADINGS) {
    assert.ok(byNorm.has(normTitle(heading)), `"${heading}" resolves to no explainer`);
  }
});

// Both spellings have to land on the same entry, or fixing one set of documents
// breaks the other. The fixture writes "Goals & Scope"; real sets write
// "1 Goals and Scope".
test('the numbered and the ampersand spelling reach the same entry', () => {
  assert.equal(normTitle('1 Goals and Scope'), normTitle('Goals & Scope'));
  assert.equal(normTitle('10 Deployment and Infrastructure'), normTitle('Deployment & Infrastructure'));
  assert.equal(normTitle('13 Quality Requirements and SLOs'), normTitle('Quality Requirements & SLOs'));
});

test('normalisation absorbs a trailing dot, odd casing and extra spaces', () => {
  assert.equal(normTitle('4. Solution Strategy'), normTitle('Solution Strategy'));
  assert.equal(normTitle('6)  CORE   Components'), normTitle('Core Components'));
});

// A number is stripped only when it leads the heading. "16 Glossary" loses its
// number; a heading that is genuinely about a quantity must not.
test('normalisation does not eat a number that is part of the title', () => {
  assert.equal(normTitle('C4 Model Levels'), 'c4 model levels');
  assert.notEqual(normTitle('2 Constraints'), normTitle('Constraints 2'));
});

// The 16 normalised keys must stay distinct, or one section silently shows
// another's explainer — worse than showing none.
test('no two spine titles collide once normalised', () => {
  const seen = new Set(SPINE_TITLES.map(normTitle));
  assert.equal(seen.size, 16, 'two spine titles normalise to the same key');
});
