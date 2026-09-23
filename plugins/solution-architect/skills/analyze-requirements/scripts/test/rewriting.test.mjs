import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ref = (f) => readFileSync(new URL(`../../references/${f}`, import.meta.url), 'utf8');
const skill = () => readFileSync(new URL('../../SKILL.md', import.meta.url), 'utf8');

// The guarantee is the ordering: the question is asked before the first write,
// or not at all. A half-written package waiting on an answer is the failure
// this whole feature exists to prevent.
test('the discipline puts the question before the first write', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /before the first write/i);
  assert.match(doc, /drift\.mjs/, 'the reference must name the script that reports drift');
  assert.match(doc, /written last|write it last/i, 'the state file ordering must be stated');
});

// Nothing writes the state file on its own. Without an instruction naming the
// tool, run 1 records nothing and run 2 has nothing to compare disk against —
// the gate reports a first run and the hand edit goes.
test('the discipline tells the run to record what it wrote', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /record\.mjs/, 'the reference must name the script that writes the state');
  assert.match(doc, /--files/, 'and say which files go into it');
  assert.match(doc, /"revision"/, 'the state file shape belongs in the reference once');
});

test('the skill runs the recorder at the end of step 5', () => {
  assert.match(skill(), /record\.mjs/);
});

// The first run is the one where `untracked` matters — it is what stops a run
// pointed at a hand-written package from overwriting it. Prose that makes the
// gate conditional on a state file existing puts that verdict back out of
// reach, whatever the code does.
test('the gate is never conditional on a state file existing', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /gate[^.]*\bevery run\b/i, 'the reference must say the gate runs every run');
  assert.doesNotMatch(doc, /gate[^.]*after\s+the\s+first/i, 'never "the gate runs after the first run"');
  assert.doesNotMatch(skill(), /after\s+the\s+first[^.]*drift\.mjs|drift\.mjs[^.]*after\s+the\s+first/i);
});

// A hash cannot identify an author, and a message that claims it can is a lie
// the reader will believe.
test('the discipline never claims to know who edited a file', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /changed since|not.*who/i);
  assert.doesNotMatch(doc, /you edited|the user edited/i);
});

// Every verdict the gate can print needs a row, or the agent meets one with no
// instruction. `new` is the one that lets run 2 add a document at all.
test('the verdict table covers a file that does not exist yet', () => {
  assert.match(ref('rewriting.md'), /\|\s*`new`\s*\|/);
});

test('an accepted ADR is named as exempt', () => {
  const doc = ref('rewriting.md');
  assert.match(doc, /accepted/);
  assert.match(doc, /supersed/i);
});

test('the skill runs the gate before writing', () => {
  assert.match(skill(), /drift\.mjs/, 'SKILL.md must call the gate in its flow');
});

test('the reference stays inside the file-length limit', () => {
  assert.ok(ref('rewriting.md').split('\n').length <= 200);
});
