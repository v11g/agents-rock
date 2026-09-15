// Shape checks for estimation-inputs.json — the agent writes that file, so the
// checks here are the contract that keeps interview output honest before any
// arithmetic happens. Findings are strings with the offending id in them.
import { AI_CATEGORIES } from './estimate-math.mjs';
import { checkScenarios } from './scenario-schema.mjs';
import { TASK_SHAPES } from './measurements.mjs';

const PROVENANCE = ['observed', 'stated', 'researched', 'proposed'];
const CONFIDENCE = ['HIGH', 'MED', 'LOW'];
const DELIVERY_MODES = ['traditional', 'agentic'];
const pct = (v) => typeof v === 'number' && v >= 0 && v < 1;
const isAgentic = (inputs) => inputs.deliveryMode === 'agentic';

// Durations and confidence are script-owned in agentic mode: their absence
// from inputs is the structural guarantee the agent never invents them.
const AGENTIC_BANNED = ['category', 'confidence', 'o', 'm', 'p'];

function checkAgenticTask(task, out) {
  if (!TASK_SHAPES.includes(task.shape)) out.push(`task ${task.id}: unknown shape "${task.shape}"`);
  const s = task.seedMinutes ?? {};
  if (!['o', 'm', 'p'].every((k) => typeof s[k] === 'number' && s[k] > 0)) {
    out.push(`task ${task.id}: seedMinutes o, m, p must be positive numbers`);
  } else if (!(s.o <= s.m && s.m <= s.p)) out.push(`task ${task.id}: seedMinutes expected o <= m <= p`);
  if (typeof task.scope !== 'object' || task.scope === null) out.push(`task ${task.id}: scope object is required`);
  for (const key of AGENTIC_BANNED) {
    if (Object.hasOwn(task, key)) out.push(`task ${task.id}: "${key}" is not an agentic input — the script computes it`);
  }
  if (task.model !== undefined && !(typeof task.model === 'string' && task.model.trim())) {
    out.push(`task ${task.id}: model must be a non-empty string`);
  }
  if (!Array.isArray(task.assumptions)) out.push(`task ${task.id}: assumptions array is required`);
  if (!PROVENANCE.includes(task.provenance)) out.push(`task ${task.id}: provenance not in vocabulary`);
}

function checkTask(task, out) {
  if (!['o', 'm', 'p'].every((k) => typeof task[k] === 'number')) out.push(`task ${task.id}: o, m, p must be numbers`);
  if (!(task.o > 0 && task.m > 0 && task.p > 0)) out.push(`task ${task.id}: estimates are never 0`);
  if (!(task.o <= task.m && task.m <= task.p)) out.push(`task ${task.id}: expected o <= m <= p`);
  // Object.hasOwn, never `in`: "toString" is `in` every object, and an inherited
  // key here becomes a NaN three tasks later in compute.
  if (!Object.hasOwn(AI_CATEGORIES, task.category)) out.push(`task ${task.id}: unknown category "${task.category}"`);
  if (!CONFIDENCE.includes(task.confidence)) out.push(`task ${task.id}: confidence must be HIGH|MED|LOW`);
  if (!Array.isArray(task.assumptions)) out.push(`task ${task.id}: assumptions array is required`);
  if (!PROVENANCE.includes(task.provenance)) out.push(`task ${task.id}: provenance not in vocabulary`);
}

function checkFeature(feature, out, agentic) {
  // Scope items are the clear-vs-assumed split itself: only stated|proposed.
  // (Task rows keep the full four-word vocabulary for their src column.)
  if (!['stated', 'proposed'].includes(feature.provenance)) {
    out.push(`feature ${feature.id}: scope provenance must be stated|proposed`);
  }
  if (!(feature.tasks?.length > 0)) out.push(`feature ${feature.id}: must have at least one task`);
  for (const task of feature.tasks ?? []) (agentic ? checkAgenticTask(task, out) : checkTask(task, out));
}

// Roadmap is all-or-nothing: a half-labeled feature list would render a
// half-roadmap that silently drops scope, so partial labeling is refused.
function checkMilestones(features, out) {
  const withMs = features.filter((f) => f.milestone !== undefined);
  if (withMs.length === 0) return;
  for (const f of features) {
    if (f.milestone === undefined) {
      out.push(`feature ${f.id}: milestone missing (all features must carry one when any does)`);
    } else if (!(typeof f.milestone === 'string' && f.milestone.trim())) {
      out.push(`feature ${f.id}: milestone must be a non-empty string`);
    }
  }
}

// Components are all-or-nothing like milestones, and coverage is the point:
// a §6 component nobody planned work for is a scope hole, refused here unless
// the roster excuses it with an explicit notEstimated reason. Two levels max —
// C4 container → component — so rollups never walk a chain.
function checkRoster(components, out) {
  const byId = new Map(components.map((c) => [c.id, c]));
  if (byId.size !== components.length) out.push('component roster: duplicate ids');
  for (const c of components) {
    if (!(typeof c.id === 'string' && c.id.trim())) out.push('component roster: every entry needs a non-empty id');
    if (!(typeof c.name === 'string' && c.name.trim())) out.push(`component ${c.id}: name must be a non-empty string`);
    if (c.notEstimated !== undefined && !(typeof c.notEstimated === 'string' && c.notEstimated.trim())) {
      out.push(`component ${c.id}: notEstimated must carry a reason`);
    }
    if (c.parent === undefined) continue;
    const parent = byId.get(c.parent);
    if (!parent) out.push(`component ${c.id}: parent "${c.parent}" not in roster`);
    else if (parent.parent !== undefined) out.push(`component ${c.id}: parent "${c.parent}" is not top-level (two levels max)`);
  }
}

function checkComponentCoverage(components, features, out) {
  const covered = new Set(features.map((f) => f.component));
  const parents = new Set(components.map((c) => c.parent).filter(Boolean));
  for (const c of components) {
    if (!parents.has(c.id) && !covered.has(c.id) && c.notEstimated === undefined) {
      out.push(`component ${c.id}: no feature covers it — tag a feature or set notEstimated with a reason`);
    }
  }
}

function checkComponents(inputs, out) {
  const features = inputs.features ?? [];
  if (inputs.components === undefined) {
    for (const f of features) {
      if (f.component !== undefined) out.push(`feature ${f.id}: component set but no top-level components roster`);
    }
    return;
  }
  checkRoster(inputs.components, out);
  const ids = new Set(inputs.components.map((c) => c.id));
  for (const f of features) {
    if (f.component === undefined) out.push(`feature ${f.id}: component missing (all features must carry one when a roster exists)`);
    else if (!ids.has(f.component)) out.push(`feature ${f.id}: component "${f.component}" not in roster`);
  }
  checkComponentCoverage(inputs.components, features, out);
}

// Anything compute.mjs would turn into NaN gets refused here instead: the
// "computed truth" contract holds only if every operand is a sane number.
// Risks carry hours in team mode and minutes in agentic mode — the unit the
// rest of that mode's math already runs on. `agentContext.repository` is
// optional (rollup.mjs falls back to `project`) but must be a real value
// when set — rung 1 of the retrieval ladder needs it to mean something.
function checkGlobals(inputs, out, agentic) {
  if (!pct(inputs.overheadPct)) out.push('overheadPct must be a number in [0, 1)');
  if (!agentic && !pct(inputs.verificationPct)) out.push('verificationPct must be a number in [0, 1)');
  const ctx = inputs.agentContext;
  if (agentic && typeof ctx === 'object' && ctx !== null && 'repository' in ctx
    && !(typeof ctx.repository === 'string' && ctx.repository.trim())) {
    out.push('agentContext.repository must be a non-empty string when present');
  }
  for (const r of inputs.risks ?? []) {
    if (!(typeof r.probability === 'number' && r.probability >= 0 && r.probability <= 1)) out.push(`risk "${r.name}": probability must be in [0, 1]`);
    if (agentic) {
      if (!(typeof r.impactMinutes === 'number' && r.impactMinutes > 0)) out.push(`risk "${r.name}": impactMinutes must be positive`);
      if (!(typeof r.reason === 'string' && r.reason.trim())) out.push(`risk "${r.name}": reason is required`);
    } else if (!(typeof r.impactHours === 'number' && r.impactHours > 0)) out.push(`risk "${r.name}": impactHours must be positive`);
  }
}

export function checkInputs(inputs) {
  const out = [];
  const agentic = isAgentic(inputs);
  if (inputs.deliveryMode !== undefined && !DELIVERY_MODES.includes(inputs.deliveryMode)) out.push('deliveryMode must be traditional|agentic');
  for (const key of ['project', 'technique', 'features', 'risks', 'assumptions', 'scenarios']) {
    if (!(key in inputs)) out.push(`missing top-level "${key}"`);
  }
  if (agentic) {
    const ctx = inputs.agentContext;
    if (typeof ctx !== 'object' || ctx === null) out.push('agentic mode requires top-level agentContext');
    else for (const key of ['agent', 'model']) {
      if (!(typeof ctx[key] === 'string' && ctx[key].trim())) out.push(`agentContext.${key} must be a non-empty string`);
    }
  }
  for (const feature of inputs.features ?? []) checkFeature(feature, out, agentic);
  checkMilestones(inputs.features ?? [], out);
  checkComponents(inputs, out);
  checkScenarios(inputs, out);
  checkGlobals(inputs, out, agentic);
  return out;
}
