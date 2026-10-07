// Everything the two estimate pages print, computed here so the pages only
// format numbers and never derive a price (the classic page's rule too).
import { CONTEXT_FACTORS } from '../../../shared/lib/project-price.mjs';
import { round2 } from '../../../shared/lib/estimate-math.mjs';

const CTX_LABEL = {
  codebaseMaturity: 'Codebase maturity', stackFamiliarity: 'Stack & domain familiarity', specQuality: 'Specification quality',
  compliance: 'Compliance & data sensitivity', clientDecisions: 'Client decision structure',
};
const OVH_LABEL = {
  foundation: 'Shared foundation & scaffolding', discovery: 'Discovery & specification', ux: 'UX / UI design', qa: 'QA & user acceptance testing',
  devops: 'DevOps, environments & release', docs: 'Documentation & handover', pm: 'Project management & client comms', integration: 'Cross-feature integration',
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const byMilestone = (a, b) => a.localeCompare(b, undefined, { numeric: true });

function contextRows(inputs) {
  return Object.keys(CONTEXT_FACTORS).map((key) => {
    const level = inputs.contextLevels[key];
    return { key, label: CTX_LABEL[key], level, anchor: inputs.contextProvenance?.[key]?.anchor ?? '', multiplier: CONTEXT_FACTORS[key][level - 1] ?? 1 };
  });
}

function overheadRows(price) {
  return Object.entries(price.overheads.lines).map(([key, pct]) => ({ label: OVH_LABEL[key] ?? key, pct, amount: round2(price.adjustedBase * pct) }));
}

// Hours once per component: a shared component is listed under several
// features but built once.
function effort(computed) {
  const comps = Object.values(computed.components).filter((c) => c.builds.length);
  const hours = round2(comps.reduce((n, c) => n + c.hours, 0));
  const tasks = comps.reduce((n, c) => n + Object.keys(c.tasks).length, 0);
  return { components: comps.length, tasks, hours, rate: hours ? round2(computed.price.p50 / hours) : null };
}

export function priceView(est) {
  const { inputs, computed } = est;
  const avg = (k) => round2(mean(inputs.features.map((f) => f.scores[k].n)));
  return {
    price: computed.price, featureCount: inputs.features.length, context: contextRows(inputs),
    overheads: overheadRows(computed.price), avgUnc: avg('unc'), avgRisk: avg('risk'), effort: effort(computed),
  };
}

// A milestone's range is its share of the feature build applied to the
// presented range — the mockup's rule.
function milestoneRow(name, feats, computed) {
  const mine = feats.filter(([, f]) => f.milestone === name);
  const total = computed.price.featurePoints;
  const share = total ? mine.reduce((n, [, f]) => n + f.point, 0) / total : 0;
  return {
    name, title: name.replace(/^M(\d+) - /, '$1. '),
    features: mine.map(([id, f]) => ({ id, name: f.name, system: f.system })),
    components: Object.values(computed.components).filter((c) => c.milestone === name && c.builds.length).length,
    share: round2(share), low: round2(computed.price.presentLow * share), high: round2(computed.price.presentHigh * share),
  };
}

export function milestoneView(est) {
  const feats = Object.entries(est.computed.features);
  const names = [...new Set(feats.map(([, f]) => f.milestone).filter(Boolean))].sort(byMilestone);
  return names.map((name) => milestoneRow(name, feats, est.computed));
}

export function registerView(est, req) {
  return {
    assumptions: (est.inputs.assumptions ?? []).map((a) => a.text),
    exclusions: [...(req.raw.scope?.out ?? []), ...(est.inputs.exclusions ?? [])],
  };
}
