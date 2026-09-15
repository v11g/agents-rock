import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE_FACTORS, FACTOR_LABELS, loadGuide, guideTableHtml, scoreNumbers, scoreSummary, bandFor,
} from '../lib/scoring.mjs';

test('the guide loads five factors with five anchors each, in factor order', () => {
  const guide = loadGuide();
  assert.deepEqual(Object.keys(guide), SCORE_FACTORS);
  for (const k of SCORE_FACTORS) assert.equal(guide[k].length, 5, `${k} needs 5 anchors`);
  assert.equal(guide.risk[3], 'Payments, auth, data migrations, or PII — high business impact');
  assert.equal(guide.deps[2], '2–3 internal services or one third-party API');
  assert.equal(guide.size[0], 'Single UI element or micro-function, <1 day of work');
});

test('guideTableHtml escapes and labels every row', () => {
  const html = guideTableHtml(loadGuide());
  assert.match(html, /<table class="guide-table">/);
  for (const label of Object.values(FACTOR_LABELS)) assert.ok(html.includes(label), label);
  assert.ok(html.includes('&lt;1 day of work'), 'anchors are HTML-escaped');
  assert.equal((html.match(/<tr>/g) ?? []).length, 6); // header + 5 rows
});

const scored = {
  id: 'f', scores: {
    tech: { n: 3, anchor: 'a', cite: 'c' }, size: { n: 3, anchor: 'a', cite: 'c' },
    deps: { n: 2, anchor: 'a', cite: 'c' }, unc: { n: 3, anchor: 'a', cite: 'c' },
    risk: { n: 3, anchor: 'a', cite: 'c' },
  },
};

test('scoreNumbers strips anchors and cites; scoreSummary sums and tiers', () => {
  assert.deepEqual(scoreNumbers(scored.scores), { tech: 3, size: 3, deps: 2, unc: 3, risk: 3 });
  assert.deepEqual(scoreSummary(scored), { scoreTotal: 14, tier: 'M' });
  assert.deepEqual(scoreSummary({ id: 'q', tasks: [] }), {});
});

test('bandFor reads the calibration table by tier', () => {
  const cal = { S: [20, 60], M: [60, 160], L: [160, 400], XL: [400, 800] };
  assert.deepEqual(bandFor('L', cal), [160, 400]);
  assert.equal(bandFor('XL', { S: [20, 60] }), undefined);
  assert.equal(bandFor(undefined, cal), undefined);
});
