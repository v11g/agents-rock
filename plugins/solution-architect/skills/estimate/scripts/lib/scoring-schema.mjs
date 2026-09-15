// Score rules for estimation-inputs.json. Scores exist only at STANDARD and
// DEEP depth (QUICK uses them for a tier and does not persist them), so the
// rules run by depth. Anchors must be the guide's own sentence for that
// factor and score, which is what stops a reason from drifting away from
// the rubric the way derived scores drifted away from the hours.
import { SCORE_FACTORS, loadGuide } from './scoring.mjs';

const DEPTHS = ['QUICK', 'STANDARD', 'DEEP'];
const SCORE_FIELDS = ['scores', 'scoreNote', 'scoreProvenance'];
// A client-facing sentence: no factor names, no file names, no section marks.
const NOTE_BANNED = /\.md\b|§|\b(tech|size|deps|unc|risk)\b/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

function checkScore({ id, key, score, guide }, out) {
  const n = score?.n;
  if (!(Number.isInteger(n) && n >= 1 && n <= 5)) { out.push(`feature ${id}: scores.${key}.n must be an integer 1–5`); return; }
  if (score.anchor !== guide[key][n - 1]) out.push(`feature ${id}: scores.${key}.anchor is not the guide's sentence for ${key} = ${n}`);
  if (!nonEmpty(score.cite)) out.push(`feature ${id}: scores.${key}.cite is required`);
}

function checkScoredFeature(feature, guide, out) {
  const s = feature.scores;
  if (typeof s !== 'object' || s === null) { out.push(`feature ${feature.id}: scores object is required at STANDARD/DEEP depth`); return; }
  if (Object.keys(s).sort().join() !== [...SCORE_FACTORS].sort().join()) {
    out.push(`feature ${feature.id}: scores must have exactly ${SCORE_FACTORS.join(', ')}`);
  }
  for (const key of SCORE_FACTORS) if (s[key] !== undefined) checkScore({ id: feature.id, key, score: s[key], guide }, out);
  if (!nonEmpty(feature.scoreNote) || NOTE_BANNED.test(feature.scoreNote)) {
    out.push(`feature ${feature.id}: scoreNote must be one plain sentence (no file names, factor names or section marks)`);
  }
  if (!['stated', 'proposed'].includes(feature.scoreProvenance)) out.push(`feature ${feature.id}: scoreProvenance must be stated|proposed`);
}

function checkQuickFeature(feature, out) {
  for (const key of SCORE_FIELDS) {
    if (key in feature) out.push(`feature ${feature.id}: ${key} is not persisted at QUICK depth`);
  }
}

export function checkScoring(inputs, out) {
  if (!DEPTHS.includes(inputs.depth)) { out.push('depth must be QUICK|STANDARD|DEEP'); return; }
  if (inputs.deliveryMode === 'agentic') return;
  const guide = inputs.depth === 'QUICK' ? null : loadGuide();
  for (const feature of inputs.features ?? []) {
    if (guide) checkScoredFeature(feature, guide, out);
    else checkQuickFeature(feature, out);
  }
}
