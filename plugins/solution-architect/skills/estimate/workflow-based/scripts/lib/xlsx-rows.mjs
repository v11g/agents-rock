// Feeds the shared v2 workbook export (shared/assets/xlsx-export.js) rows in
// the shape the classic page passes it: one per feature, its tasks under it.
// Workflow tasks live on components, so each component's tasks go under the
// first feature it builds — listed once, never dropped. Rows come grouped by
// system, for the workbook's SYSTEM / MODULE column.
import { mainBuilder } from './rollup.mjs';
import { featureProvenance } from './requirements.mjs';

// The pages' order: systems as requirements.json lists them, each system's
// features in its own order, then any feature no system claims.
function systemOrder(inputs, req) {
  const placed = req.systems.flatMap((s) => (s.features ?? []).map((id) => [id, s.name]));
  const ids = new Set(inputs.features.map((f) => f.id));
  const loose = inputs.features.filter((f) => !placed.some(([id]) => id === f.id)).map((f) => [f.id, '']);
  const seen = new Set(); // a feature two systems list is priced once, under the first
  return [...placed.filter(([id]) => ids.has(id) && !seen.has(id) && seen.add(id)), ...loose];
}

function containerName(c, components) {
  if (!c) return '';
  return (c.parent && components.find((x) => x.id === c.parent))?.name ?? c.name;
}

function taskOwners(inputs) {
  const owners = {};
  for (const c of inputs.components) {
    const first = inputs.features.find((f) => (c.builds ?? []).some((b) => b.feature === f.id));
    if (first && c.tasks?.length) (owners[first.id] ??= []).push(c);
  }
  return owners;
}

function taskRows(c, computed) {
  const done = computed.components[c.id].tasks;
  return c.tasks.map((t) => ({
    name: t.name, category: t.shape, o: done[t.id].low, m: done[t.id].e, p: done[t.id].high,
    confidence: done[t.id].confidence, assumptions: t.assumptions ?? [],
  }));
}

export function xlsxRows(est, req) {
  const { inputs, computed } = est;
  const owners = taskOwners(inputs);
  const byId = Object.fromEntries(inputs.features.map((f) => [f.id, f]));
  return systemOrder(inputs, req).map(([id, system]) => [byId[id], system]).map(([f, system]) => ({
    id: f.id, system, name: req.features[f.id].name, scores: f.scores, scoreNote: f.scoreNote ?? '',
    scoreProvenance: f.scoreProvenance, provenance: featureProvenance(req.features[f.id]),
    milestone: computed.features[f.id].milestone ?? '', container: containerName(mainBuilder(f.id, inputs.components), inputs.components),
    tasks: (owners[f.id] ?? []).flatMap((c) => taskRows(c, computed)),
  }));
}
