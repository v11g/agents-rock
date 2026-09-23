import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const skill = () => readFileSync(new URL('../../SKILL.md', import.meta.url), 'utf8');
const fixture = (f) => readFileSync(new URL(`../../evals/fixtures/${f}`, import.meta.url), 'utf8');

// Two eval agents read "never re-report what validate.mjs enforces" as an
// instruction to run it, and this skill does not ship it. Both places that name
// the script have to say whose it is and that the reviewer only assumes it ran.
test('the reviewer says whose validate.mjs it is and that it never runs it', () => {
  for (const [name, doc] of [['SKILL.md', skill()], ['gates.md', ref('gates.md')]]) {
    assert.match(doc, /validate\.mjs/, `${name} should still name the script`);
    assert.match(doc, /ships with `analyze-requirements`|lives in `analyze-requirements`/,
      `${name} must say where validate.mjs lives`);
    assert.match(doc, /never invokes it|does not invoke it/i,
      `${name} must say the reviewer does not run it`);
    assert.match(doc, /assumes (that gate|it) ran/i,
      `${name} must state the assumption it reviews under`);
  }
});

// G4 judges whether an applicable section was left empty, which is unanswerable
// without knowing what the sections are. Both eval agents left the file to go
// find the list, so the pointer belongs here.
test('G4 points at the spine list rather than assuming it is known', () => {
  const doc = ref('gates.md');
  const g4 = doc.slice(doc.indexOf('## G4'), doc.indexOf('## G5'));
  assert.match(g4, /16/, 'G4 must say how many sections the spine has');
  assert.match(g4, /`analyze-requirements`[\s\S]{0,40}`references\/writing\.md`/,
    'G4 must point at the one home for the spine headings');
});

// The skeleton had a home for a gate that could not run and none for a gate that
// ran and found nothing, so an agent invented a table to record the difference.
test('the report skeleton separates a clean gate from an unrunnable one', () => {
  const doc = ref('reporting.md');
  const md = doc.slice(doc.indexOf('```markdown'), doc.lastIndexOf('```'));
  assert.match(md, /## Checked, nothing found/, 'clean gates need a home in the skeleton');
  assert.match(md, /## Nothing to check/, 'unrunnable gates keep theirs');
  assert.match(doc, /ran and found nothing/i,
    'the prose must say which heading a clean gate goes under');
});

// The block that says "may carry any severity" gave no shape, so it could not
// be written in the finding format the rest of the section mandates.
test('the invalidating assumption has a shape of its own', () => {
  const doc = ref('reporting.md');
  const tail = doc.slice(doc.indexOf('invalidates the design if wrong'));
  assert.match(tail, /```[\s\S]*invalidating assumption[\s\S]*```/,
    'the block needs its own fenced shape');
  assert.match(tail, /— if wrong:/, 'the shape must carry what breaks when it is wrong');
});

// coverage.mjs distinguishes a genuinely empty section from one it could not
// read. Nothing told the reporter to carry that distinction into the report.
test('reporting.md routes the script notes into the report', () => {
  const doc = ref('reporting.md');
  assert.match(doc, /`notes`/, 'the notes array must be named');
  assert.match(doc, /`notes`[\s\S]{0,400}## Nothing to check|## Nothing to check[\s\S]{0,400}`notes`/,
    'notes must be routed to a named heading');
  assert.match(doc, /not applicable[\s\S]{0,200}note/i,
    'a not-applicable ratio with no note must be called out');
});

// Three bare values separated by dots is a stamp only its author can read.
test('the revision stamp labels its values', () => {
  const doc = ref('reporting.md');
  const md = doc.slice(doc.indexOf('```markdown'), doc.lastIndexOf('```'));
  const stamp = md.split('\n').find((l) => l.startsWith('Reviewed'));
  assert.ok(stamp, 'the skeleton must carry a stamp line');
  assert.match(stamp, /docVersion/, 'the document version must be labelled');
  assert.match(stamp, /updated/, 'the document date must be labelled');
  assert.match(stamp, /review(ed)? (run|on)/i, 'the review date must be labelled as such');
});

// The negative control has to be clean on every gate, not only the ones it was
// built to exercise. Eleven sections neither written nor dispositioned is a real
// G4 finding, which makes a correct review of this fixture look like a failure.
test('the clean fixture dispositions all 16 spine sections', () => {
  const doc = fixture('clean-harborline/ARCHITECTURE.md');
  const numbered = doc.split('\n')
    .filter((l) => /^##\s+\d+\s/.test(l))
    .map((l) => Number(l.match(/^##\s+(\d+)\s/)[1]));
  const missing = [];
  for (let n = 1; n <= 16; n += 1) if (!numbered.includes(n)) missing.push(n);
  assert.deepEqual(missing, [], `clean fixture is missing sections: ${missing.join(', ')}`);
});

// A section carrying neither content nor a reason is the G4 defect itself, so
// the fixture's empty ones have to say why they are empty — and a bare "Not
// applicable" is the same defect with a label on it.
test('the clean fixture gives every empty section a reason', () => {
  const doc = fixture('clean-harborline/ARCHITECTURE.md');
  const blocks = doc.split(/^##\s+/m).slice(1);
  for (const block of blocks) {
    const [heading, ...rest] = block.split('\n');
    const body = rest.join('\n').trim();
    assert.ok(body.length > 0, `section "${heading}" is empty`);
    for (const line of body.split('\n')) {
      if (!/Not applicable/.test(line)) continue;
      assert.match(line, /Not applicable — \S.{14,}/,
        `section "${heading}" dispositioned with no reason behind it`);
    }
  }
});
