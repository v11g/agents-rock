import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toCsv, parseCsv, fromCsv, CSV_HEADERS } from '../lib/score-csv.mjs';
import { diffScores, applyDiff } from '../lib/score-diff.mjs';
import { loadGuide } from '../lib/scoring.mjs';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';

const cli = new URL('../score-review.mjs', import.meta.url).pathname;
const skip = { skip: !findChrome() && 'no chrome on PATH' };

const inputs = () => JSON.parse(readFileSync(new URL('./fixtures/booking-inputs.json', import.meta.url), 'utf8'));
const draft = () => {
  const { project, features } = inputs();
  return { project, features: features.map(({ id, name, scores, scoreNote, scoreProvenance }) => ({ id, name, scores, scoreNote, scoreProvenance })) };
};

function writeDraft(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'score-review-'));
  const path = join(dir, 'draft.json');
  const d = draft();
  mutate?.(d);
  writeFileSync(path, JSON.stringify(d));
  return { dir, path };
}

// The CLI runs unattended inside the skill, so a half-written flag set has to
// stop it rather than quietly write the wrong file.
function cliFails(args) {
  try {
    execFileSync('node', [cli, ...args], { encoding: 'utf8', stdio: 'pipe' });
  } catch (err) { return err; }
  throw new Error(`expected a non-zero exit from: ${args.join(' ')}`);
}

test('CLI: an incomplete flag set prints usage and exits 1', () => {
  const { dir, path } = writeDraft();
  for (const args of [
    ['--read', join(dir, 'scores.csv')],
    ['--write', path, '--format', 'pdf', '--out', join(dir, 'out.pdf')],
    ['--write', path, '--format', 'csv'],
  ]) {
    const err = cliFails(args);
    assert.equal(err.status, 1, args.join(' '));
    assert.match(err.stderr, /usage:/, args.join(' '));
  }
});

test('fromCsv refuses a header that lost a score column', () => {
  const csv = toCsv(draft()).replace('deps,deps_why,deps_cite', 'dependencies,deps_why,deps_cite');
  assert.throws(() => fromCsv(csv), /missing score columns: deps/);
});

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

test('CLI: --write csv then --read reports the diff and the re-anchored features', () => {
  const { dir, path } = writeDraft();
  const csvPath = join(dir, 'scores-draft.csv');
  execFileSync('node', [cli, '--write', path, '--format', 'csv', '--out', csvPath]);
  const edited = readFileSync(csvPath, 'utf8').replace(/^(reminders,[^,]*,)2,/m, (m, head) => `${head}4,`);
  writeFileSync(csvPath, edited);
  const out = JSON.parse(execFileSync('node', [cli, '--read', csvPath, '--draft', path], { encoding: 'utf8' }));
  assert.deepEqual(out.diff, [{ id: 'reminders', field: 'tech', from: 2, to: 4 }]);
  assert.equal(out.features[1].scores.tech.anchor, loadGuide().tech[3]);
  assert.equal(out.features[1].scoreProvenance, 'stated');
});

test('CLI: --write html renders one select per score with the anchor as its title', skip, async () => {
  const { dir, path } = writeDraft();
  const htmlPath = join(dir, 'scores-review.html');
  execFileSync('node', [cli, '--write', path, '--format', 'html', '--out', htmlPath]);
  const page = await openPage(pathToFileURL(htmlPath).href);
  try {
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('select[data-id][data-key]').length`), 10);
    assert.equal(await page.eval(`document.querySelector('select[data-id="booking"][data-key="tech"]').value`), '3');
    assert.match(await page.eval(`document.querySelector('select[data-id="booking"][data-key="tech"]').title`), /Custom business logic/);
    assert.equal(await page.eval(`document.querySelector('[data-total="reminders"]').textContent`), '11');
    assert.equal(await page.eval(`document.querySelector('[data-tier="reminders"]').textContent`), 'S');
    assert.match(await page.eval(`document.querySelector('details.guide').textContent`), /Tech complexity/);
  } finally { page.close(); }
});

test('review page: changing a select updates Σ/tier live and the feedback block round-trips', skip, async () => {
  const { dir, path } = writeDraft();
  const htmlPath = join(dir, 'scores-review.html');
  execFileSync('node', [cli, '--write', path, '--format', 'html', '--out', htmlPath]);
  const page = await openPage(pathToFileURL(htmlPath).href);
  try {
    await page.eval(`(() => { const s = document.querySelector('select[data-id="reminders"][data-key="tech"]'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    assert.equal(await page.eval(`document.querySelector('[data-total="reminders"]').textContent`), '13');
    assert.equal(await page.eval(`document.querySelector('[data-tier="reminders"]').textContent`), 'M');
    assert.equal(await page.eval(`document.querySelector('select[data-id="reminders"][data-key="tech"]').value`), '4',
      'the rebuilt select shows the edited score, not the draft one');
    assert.doesNotMatch(await page.eval(`document.querySelector('select[data-id="reminders"][data-key="tech"]').title`),
      /Minor customisation of standard patterns/, 'the anchor for the old score must not explain the new one');
    const feedback = JSON.parse(await page.eval(`document.getElementById('feedback').value`));
    const fbPath = join(dir, 'feedback.json');
    writeFileSync(fbPath, JSON.stringify(feedback));
    const out = JSON.parse(execFileSync('node', [cli, '--read', fbPath, '--draft', path], { encoding: 'utf8' }));
    assert.deepEqual(out.diff, [{ id: 'reminders', field: 'tech', from: 2, to: 4 }]);
    await page.eval(`(() => { const s = document.querySelector('select[data-id="reminders"][data-key="tech"]'); s.value = '5'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    assert.equal(await page.eval(`document.querySelector('select[data-id="reminders"][data-key="tech"]').value`), '5');
    assert.match(await page.eval(`document.querySelector('select[data-id="reminders"][data-key="tech"]').className`), /hot/,
      'a 5 is flagged after the re-render, not only on first paint');
  } finally { page.close(); }
});

test('review page: a feature id with a quote in it cannot inject attributes', skip, async () => {
  const { dir, path } = writeDraft((d) => { d.features[1].id = 'bad" onfocus="window.__pwned=1'; });
  const htmlPath = join(dir, 'scores-review.html');
  execFileSync('node', [cli, '--write', path, '--format', 'html', '--out', htmlPath]);
  const page = await openPage(pathToFileURL(htmlPath).href);
  try {
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('[onfocus]').length`), 0);
    assert.equal(await page.eval(`window.__pwned === undefined`), true);
  } finally { page.close(); }
});
