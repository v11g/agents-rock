// The BA package is the source of names, systems and workflow steps in
// workflow mode; estimation-inputs.json carries only ids and scores. This
// module loads and indexes it so no other module re-derives the shape.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const byId = (list) => Object.fromEntries((list ?? []).map((x) => [x.id, x]));

export function resolveRequirementsPath(inputsPath, inputs) {
  if (typeof inputs.requirements !== 'string' || !inputs.requirements) return null;
  return resolve(dirname(inputsPath), inputs.requirements);
}

export function loadRequirements(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const systems = raw.systems ?? [];
  const systemOf = {};
  for (const s of systems) for (const f of s.features ?? []) systemOf[f] = s.id;
  return {
    raw, project: raw.lead ?? raw.project ?? 'Estimate', mapLabel: raw.mapLabel ?? null,
    features: byId(raw.features), systems, systemById: byId(systems), workflows: byId(raw.workflows), systemOf,
  };
}

export function loadPair(inputsPath) {
  const inputs = JSON.parse(readFileSync(inputsPath, 'utf8'));
  const reqPath = resolveRequirementsPath(inputsPath, inputs);
  const req = reqPath && existsSync(reqPath) ? loadRequirements(reqPath) : null;
  return { inputs, req };
}

// Scope provenance in workflow mode is the BA label, not a field of our own.
export const featureProvenance = (feature) => (feature.label === 'confirmed' ? 'stated' : 'proposed');
