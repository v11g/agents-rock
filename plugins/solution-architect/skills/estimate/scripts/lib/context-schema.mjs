// The five project-wide context factors from Estimator v2's roll-up. Each
// carries its level plus the provenance the score factors already carry, so
// a derived level arrives as a proposal with its evidence attached and can
// be overridden in review — never as a silent default.
import { CONTEXT_FACTORS } from './project-price.mjs';

const SOURCES = ['derived', 'stated'];
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
const FACTORS = Object.keys(CONTEXT_FACTORS);

function checkOne(key, { level, prov }, out) {
  if (!(Number.isInteger(level) && level >= 1 && level <= 4)) {
    out.push(`contextLevels.${key}: must be an integer 1-4`);
    return;
  }
  if (typeof prov !== 'object' || prov === null) { out.push(`contextProvenance.${key}: required`); return; }
  if (prov.level !== level) {
    out.push(`contextProvenance.${key}: level ${prov.level} disagrees with contextLevels.${key} = ${level}`);
  }
  if (!nonEmpty(prov.anchor)) out.push(`contextProvenance.${key}: anchor is required`);
  if (!nonEmpty(prov.cite)) out.push(`contextProvenance.${key}: cite is required`);
  if (!SOURCES.includes(prov.source)) out.push(`contextProvenance.${key}: source must be derived|stated`);
}

// QUICK never persists scores, and agentic runs carry no feature scores by
// design (scoring-schema.mjs's checkScoring returns early for the same
// deliveryMode). With no score to scale, demanding five levels, anchors and
// cites would make a human justify multipliers applied to zero — one rule
// for "this run is not score-priced", not two that could disagree.
export function checkContext(inputs, out) {
  if (inputs.depth === 'QUICK' || inputs.deliveryMode === 'agentic') return;
  const levels = inputs.contextLevels ?? {};
  const prov = inputs.contextProvenance ?? {};
  for (const key of FACTORS) checkOne(key, { level: levels[key], prov: prov[key] }, out);
}
