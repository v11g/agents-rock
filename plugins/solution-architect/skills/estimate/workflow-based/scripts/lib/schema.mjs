// Shape checks for estimation-inputs.json in workflow mode (spec §6). Features
// are ids + scores; their names live in requirements.json; components carry
// the work. Findings are strings with the offending id in them.
import { loadGuide } from '../../../shared/lib/scoring.mjs';
import { checkScoredFeature } from '../../../shared/lib/scoring-schema.mjs';
import { checkContext } from '../../../shared/lib/context-schema.mjs';
import { checkComponents } from './schema-components.mjs';

const FEATURE_BANNED = ['tasks', 'component', 'milestone', 'provenance'];
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

function checkMode(inputs, req, out) {
  if (inputs.scopeMode !== 'workflow') out.push('scopeMode must be "workflow"');
  if (!req) { out.push('requirements: file not found'); return; }
  if (req.raw.scopeMode !== 'workflow') out.push('requirements: is not in workflow mode');
  if (inputs.deliveryMode !== 'agentic' || inputs.depth !== 'STANDARD') out.push('workflow mode is agentic + STANDARD only');
  const ctx = inputs.agentContext ?? {};
  if (!(nonEmpty(ctx.agent) && nonEmpty(ctx.model))) out.push('agentContext.agent and .model are required');
}

function checkFeatureIds(inputs, req, out) {
  const ids = (inputs.features ?? []).map((f) => f.id);
  const have = new Set(ids);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach((id) => out.push(`feature ${id}: duplicate id`));
  for (const id of have) if (!req.features[id]) out.push(`feature ${id}: not in requirements.json`);
  for (const id of Object.keys(req.features)) if (!have.has(id)) out.push(`requirements ${id}: not scored`);
}

function checkFeatures(inputs, guide, out) {
  for (const f of inputs.features ?? []) {
    for (const key of FEATURE_BANNED) {
      if (key in f) out.push(`feature ${f.id}: "${key}" belongs on components in workflow mode`);
    }
    checkScoredFeature(f, guide, out);
  }
}

// Familiarity is fixed at level 1 (spec D12) unless a human stated otherwise.
function checkFamiliarity(inputs, out) {
  const level = inputs.contextLevels?.stackFamiliarity;
  const src = inputs.contextProvenance?.stackFamiliarity?.source;
  if (level !== undefined && level !== 1 && src !== 'stated') out.push(`stackFamiliarity: level ${level} needs a stated provenance`);
}

function checkAssumptions(inputs, out) {
  (inputs.assumptions ?? []).forEach((a, i) => {
    if (!(typeof a.source === 'string' && /^(ASM-\d+|Q-\d+|new)$/.test(a.source))) out.push(`assumption ${i}: source missing`);
  });
}

export function checkWorkflowInputs(inputs, req) {
  const out = [];
  checkMode(inputs, req, out);
  if (!req) return out;
  checkFeatureIds(inputs, req, out);
  checkFeatures(inputs, loadGuide(), out);
  checkComponents(inputs, out);
  checkContext(inputs, out, { required: true });
  checkFamiliarity(inputs, out);
  checkAssumptions(inputs, out);
  return out;
}
