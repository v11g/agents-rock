// Scenario-shape checks for estimation-inputs.json: team roster, AI
// assistance, and the per-seat tooling price. Split from schema.mjs so each
// module stays under the ten-function gate; findings follow the same
// "scenario <id>: ..." form.
import { SENIORITY_FACTOR } from './estimate-math.mjs';

// A seat price may be skipped (the client may mandate a vendor) but only as
// a recorded gap: an AI-assisted scenario with a null seat cost needs an
// assumption that names it, or the total would silently miss a line item.
const seatCostOk = (v) => v === null || (typeof v === 'number' && v > 0);
const toolingAssumed = (inputs) => (inputs.assumptions ?? [])
  .some((a) => /tooling/i.test(typeof a === 'string' ? a : a?.text ?? ''));

function checkScenarioAi(s, inputs, out) {
  if ('plan' in s) out.push(`scenario ${s.id}: "plan" was removed — use aiAssisted + toolingCostPerSeat`);
  if (typeof s.aiAssisted !== 'boolean') out.push(`scenario ${s.id}: aiAssisted must be true|false`);
  if (!('toolingCostPerSeat' in s) || !seatCostOk(s.toolingCostPerSeat)) {
    out.push(`scenario ${s.id}: toolingCostPerSeat must be a positive number or null`);
  }
  if (s.aiAssisted === true && s.toolingCostPerSeat === null && !toolingAssumed(inputs)) {
    out.push(`scenario ${s.id}: null toolingCostPerSeat needs an assumption naming the tooling cost gap`);
  }
}

export function checkScenarios(inputs, out) {
  const ids = (inputs.scenarios ?? []).map((s) => s.id);
  if (!ids.includes(inputs.recommendedScenario)) out.push('recommendedScenario names no scenario');
  for (const s of inputs.scenarios ?? []) {
    if (!s.team?.length) out.push(`scenario ${s.id}: empty team`);
    checkScenarioAi(s, inputs, out);
    for (const member of s.team ?? []) {
      if (!Object.hasOwn(SENIORITY_FACTOR, member.seniority)) out.push(`scenario ${s.id}: unknown seniority "${member.seniority}"`);
      if (!(typeof member.rate === 'number' && member.rate > 0)) out.push(`scenario ${s.id}: rate must be a positive number`);
    }
  }
}
