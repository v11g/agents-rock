import {
  SCOPE_MODES, modeOf, toBe, scopeIds,
  checkFlows, checkFeatureSteps, checkFeatureFrs, checkNames, checkScopeLabels,
} from './scope-rules.mjs';

const ID_RES = [['systems', /^SYS-\d{3}$/], ['features', /^FEAT-\d{3}$/]];
const FIELDS = [['systems', ['name', 'purpose']], ['features', ['name', 'does']]];

function checkFields(pkg) {
  return FIELDS.flatMap(([k, fields]) =>
    pkg[k].flatMap((r) => fields.filter((f) => !r[f]).map((f) => `${r.id}: missing ${f}`)));
}

function checkShape(pkg) {
  if (!SCOPE_MODES.includes(modeOf(pkg))) return ['scopeMode must be workflow|classic'];
  if (modeOf(pkg) === 'classic') {
    return 'systems' in pkg || 'features' in pkg ? ['systems/features only in workflow mode'] : [];
  }
  if (!pkg.systems?.length || !pkg.features?.length) return ['scopeMode workflow needs systems and features'];
  const findings = [];
  for (const [k, re] of ID_RES) {
    for (const r of pkg[k]) if (!re.test(r.id ?? '')) findings.push(`${k}: bad id ${r.id}`);
  }
  const seen = new Set();
  for (const id of scopeIds(pkg)) {
    if (seen.has(id)) findings.push(`duplicate id: ${id}`);
    seen.add(id);
  }
  return findings;
}

function owners(systems, key) {
  const map = new Map();
  for (const s of systems) for (const id of s[key] ?? []) map.set(id, [...(map.get(id) ?? []), s.id]);
  return map;
}

function ownership(ids, own, verb) {
  return ids.flatMap((id) => {
    const by = own.get(id) ?? [];
    if (by.length === 1) return [];
    return [by.length ? `${id}: ${verb} ${by.join(' and ')}` : `${id}: ${verb} no system`];
  });
}

function checkMembership(pkg) {
  const findings = [];
  const flows = toBe(pkg).map((w) => w.id);
  const feats = pkg.features.map((f) => f.id);
  for (const s of pkg.systems) {
    for (const w of s.workflows ?? []) if (!flows.includes(w)) findings.push(`${s.id}: workflow ${w} is not a to-be workflow`);
    for (const f of s.features ?? []) if (!feats.includes(f)) findings.push(`${s.id}: dangling reference ${f}`);
  }
  return [
    ...findings,
    ...ownership(flows, owners(pkg.systems, 'workflows'), 'belongs to'),
    ...ownership(feats, owners(pkg.systems, 'features'), 'listed by'),
  ];
}

export function checkScope(pkg, ids) {
  const shape = checkShape(pkg);
  if (shape.length || modeOf(pkg) === 'classic') return shape;
  return [
    ...checkFields(pkg),
    ...checkMembership(pkg),
    ...checkFlows(pkg),
    ...checkFeatureSteps(pkg),
    ...checkFeatureFrs(pkg, ids),
    ...checkNames(pkg),
    ...checkScopeLabels(pkg),
  ];
}
