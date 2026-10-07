// Feature → container aggregation for the effort-by-container rollup. Sums
// each feature's expected hours into its component's top-level ancestor
// (two levels max, enforced by schema.mjs, so the ancestor is one parent hop).
// Returns undefined when inputs carry no roster — like the roadmap, absence
// must stay a missing key, not an empty map. Sums the displayed (rounded)
// per-feature hours so this table always agrees with the breakdown table.
export function componentHoursFor(inputs, featureHours) {
  if (!inputs.components) return undefined;
  const round2 = (n) => Math.round(n * 100) / 100;
  const parentOf = Object.fromEntries(inputs.components.map((c) => [c.id, c.parent]));
  const hours = {};
  for (const c of inputs.components) if (!c.parent) hours[c.id] = 0;
  for (const f of inputs.features) {
    hours[parentOf[f.component] ?? f.component] += featureHours[f.id].hours;
  }
  return Object.fromEntries(Object.entries(hours)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, h]) => [id, round2(h)]));
}
