// Factor scores are human judgments recorded in estimation-inputs.json.
// This module owns their vocabulary, the rubric loader (references/
// scoring-guide.md is the single source of anchor text), and the two
// derived facts compute copies into estimation.json: Σ and tier.
import { readFileSync } from 'node:fs';
import { escapeHtml } from '../../../analyze-requirements/scripts/lib/md-inline.mjs';
import { tierFor } from './estimate-math.mjs';

export const SCORE_FACTORS = ['tech', 'size', 'deps', 'unc', 'risk'];
export const FACTOR_LABELS = {
  tech: 'Tech complexity', size: 'Feature size', deps: 'Dependencies', unc: 'Uncertainty', risk: 'Risk',
};
const GUIDE_PATH = new URL('../../references/scoring-guide.md', import.meta.url);

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());

// Returns { tech: [a1..a5], ... } from the guide's one table. Rows are found
// by their label, so the doc may reorder them; anchors may not contain `|`.
// A renamed, short or deleted row is named here, not left to surface as an
// undefined anchor halfway through a render.
export function loadGuide(path = GUIDE_PATH) {
  const rows = readFileSync(path, 'utf8').split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l));
  const byLabel = Object.fromEntries(rows.map(cells).map((c) => [c[0], c.slice(1)]));
  const guide = Object.fromEntries(SCORE_FACTORS.map((k) => [k, byLabel[FACTOR_LABELS[k]]]));
  const missing = SCORE_FACTORS.filter((k) => !(guide[k]?.length === 5));
  if (missing.length) throw new Error(`scoring-guide.md: no 5-anchor row for ${missing.join(', ')}`);
  return guide;
}

export function guideTableHtml(guide) {
  const head = `<tr><th>Dimension</th>${[1, 2, 3, 4, 5].map((n) => `<th class="score">${n}</th>`).join('')}</tr>`;
  const body = SCORE_FACTORS.map((k) => `<tr><td class="dim">${FACTOR_LABELS[k]}</td>${
    guide[k].map((a) => `<td>${escapeHtml(a)}</td>`).join('')}</tr>`).join('');
  return `<table class="guide-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export const scoreNumbers = (scores) => Object.fromEntries(SCORE_FACTORS.map((k) => [k, scores[k].n]));

// Copied into computed.features[id] at STANDARD/DEEP so page, checks and
// xlsx read one object; QUICK features carry no scores and get nothing.
export function scoreSummary(feature) {
  if (!feature.scores) return {};
  const { total, tier } = tierFor(scoreNumbers(feature.scores));
  return { scoreTotal: total, tier };
}

export const bandFor = (tier, calibration) => (tier ? calibration?.[tier] : undefined);
