import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toCsv, parseCsv, fromCsv, CSV_HEADERS } from '../lib/score-csv.mjs';
import { diffScores, applyDiff } from '../lib/score-diff.mjs';
import { loadGuide } from '../lib/scoring.mjs';

const inputs = () => JSON.parse(readFileSync(new URL('./fixtures/booking-inputs.json', import.meta.url), 'utf8'));
const draft = () => {
  const { project, features } = inputs();
  return { project, features: features.map(({ id, name, scores, scoreNote, scoreProvenance }) => ({ id, name, scores, scoreNote, scoreProvenance })) };
};

test('toCsv writes one row per feature with anchor and cite beside every score', () => {
  const csv = toCsv(draft());
  const [head, booking] = csv.trim().split('\n');
  assert.equal(head, CSV_HEADERS.join(','));
  assert.equal(CSV_HEADERS.length, 2 + 5 * 3 + 4); // id, feature, 5×(n, why, cite), sum, tier, why_this_tier, note
  assert.match(booking, /^booking,User can book appointment,3,"Custom business logic, moderate algorithm complexity, multiple states",slot conflict \+ cancellation rules,3,/);
  // the plain note has no comma, so it is not quoted; the trailing empty field is the free "note" column
  assert.match(booking, /,14,M,Core booking rules with a few open questions; touches every customer if it breaks,$/);
});

test('parseCsv handles quoted commas, doubled quotes and CRLF', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi""",d\r\n1,2,3,4\n'), [['a', 'b, c', 'say "hi"', 'd'], ['1', '2', '3', '4']]);
});

test('fromCsv reads numbers, the plain note and the free-text note back', () => {
  const csv = toCsv(draft())
    .replace(/^(booking,[^,]*,)3,/m, (m, head) => `${head}4,`)
    .replace(/,14,M,([^,\n]*),$/m, (m, note) => `,15,L,${note},move risk up`);
  const edited = fromCsv(csv);
  assert.equal(edited.features[0].id, 'booking');
  assert.equal(edited.features[0].scores.tech, 4);
  assert.equal(edited.features[0].note, 'move risk up');
  assert.equal(edited.features[1].scores.deps, 3);
});

test('diffScores names exactly the cells the human changed', () => {
  const d = draft();
  const edited = { features: [
    { id: 'booking', scores: { tech: 4, size: 3, deps: 2, unc: 3, risk: 3 }, scoreNote: d.features[0].scoreNote, note: 'algorithm is fuzzy matching' },
    { id: 'reminders', scores: { tech: 2, size: 2, deps: 3, unc: 2, risk: 2 }, scoreNote: 'Reminder emails via an outside provider', note: '' },
  ] };
  assert.deepEqual(diffScores(d, edited), [
    { id: 'booking', field: 'tech', from: 3, to: 4 },
    { id: 'booking', field: 'note', to: 'algorithm is fuzzy matching' },
    { id: 'reminders', field: 'scoreNote', from: d.features[1].scoreNote, to: 'Reminder emails via an outside provider' },
  ]);
});

test('applyDiff re-anchors a changed score from the guide and marks the feature stated', () => {
  const d = draft();
  const guide = loadGuide();
  const diff = [{ id: 'reminders', field: 'tech', from: 2, to: 4 }];
  const features = applyDiff({ draft: d, diff, guide });
  assert.equal(features[1].scores.tech.n, 4);
  assert.equal(features[1].scores.tech.anchor, guide.tech[3]);
  assert.equal(features[1].scores.tech.cite, 'scheduled job + template', 'cite is kept for the agent to revisit');
  assert.equal(features[1].scoreProvenance, 'stated');
  assert.equal(features[0].scoreProvenance, 'stated', 'untouched features keep their provenance');
  assert.deepEqual(d.features[1].scores.tech.n, 2, 'draft is not mutated');
});
