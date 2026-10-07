// Components carry the work in workflow mode: builds[] (which features, why),
// a milestone and agentic tasks. A container that has components is structure
// only; a leaf container (no components) may build features itself.
import { checkAgenticTask } from '../../../shared/lib/agentic-task-schema.mjs';

const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

function checkRoster(components, out) {
  const byId = new Map(components.map((c) => [c.id, c]));
  if (byId.size !== components.length) out.push('component roster: duplicate ids');
  for (const c of components) {
    if (!nonEmpty(c.id)) out.push('component roster: every entry needs a non-empty id');
    if (!nonEmpty(c.name)) out.push(`component ${c.id}: name must be a non-empty string`);
    if (c.notEstimated !== undefined && !nonEmpty(c.notEstimated)) out.push(`component ${c.id}: notEstimated must carry a reason`);
    if (c.parent === undefined) continue;
    const parent = byId.get(c.parent);
    if (!parent) out.push(`component ${c.id}: parent "${c.parent}" not in roster`);
    else if (parent.parent !== undefined) out.push(`component ${c.id}: parent "${c.parent}" is not top-level (two levels max)`);
  }
}

function checkBuilds(c, featureIds, out) {
  const seen = new Set();
  for (const b of c.builds ?? []) {
    if (!featureIds.has(b.feature)) out.push(`component ${c.id}: builds ${b.feature} unknown`);
    if (!nonEmpty(b.why)) out.push(`component ${c.id}: builds ${b.feature} without a why`);
    if (seen.has(b.feature)) out.push(`component ${c.id}: builds ${b.feature} twice`);
    seen.add(b.feature);
  }
}

// Only a component that builds something carries work: tasks anywhere else
// would be priced without ever being validated.
function checkIdle(c, out) {
  if (c.tasks?.length) out.push(`component ${c.id}: tasks need a builds entry — link a feature or move the tasks`);
}

function checkWork(c, parents, out) {
  const builds = c.builds ?? [];
  if (parents.has(c.id)) {
    if (builds.length) out.push(`component ${c.id}: a container with components cannot build features — link the component`);
    checkIdle(c, out);
    return;
  }
  if (!builds.length) {
    checkIdle(c, out);
    if (c.notEstimated === undefined) out.push(`component ${c.id}: no feature covers it — add a builds entry or set notEstimated with a reason`);
    return;
  }
  if (c.notEstimated !== undefined) out.push(`component ${c.id}: notEstimated but builds features — drop one`);
  if (!nonEmpty(c.milestone)) out.push(`component ${c.id}: builds features but has no milestone`);
  if (!(c.tasks?.length > 0)) out.push(`component ${c.id}: builds features but has no tasks`);
  for (const t of c.tasks ?? []) checkAgenticTask(t, out);
}

export function checkComponents(inputs, out) {
  const components = inputs.components;
  if (!Array.isArray(components) || !components.length) { out.push('components roster is required in workflow mode'); return; }
  checkRoster(components, out);
  const featureIds = new Set((inputs.features ?? []).map((f) => f.id));
  const parents = new Set(components.map((c) => c.parent).filter(Boolean));
  const built = new Set();
  for (const c of components) {
    checkBuilds(c, featureIds, out);
    checkWork(c, parents, out);
    for (const b of c.builds ?? []) built.add(b.feature);
  }
  for (const id of featureIds) if (!built.has(id)) out.push(`feature ${id}: no component builds it`);
}
