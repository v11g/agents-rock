// Turns validated workflow-mode inputs into estimation.json: a price per
// feature from its five scores, hours per component from agentic baselines,
// and the project price. Names and systems come from the BA package.
import { round2 } from '../../../shared/lib/estimate-math.mjs';
import { featurePrice } from '../../../shared/lib/pricing.mjs';
import { projectPrice } from '../../../shared/lib/project-price.mjs';
import { agenticTask } from '../../../shared/lib/baselines.mjs';
import { scoreNumbers, scoreSummary } from '../../../shared/lib/scoring.mjs';
import { featureProvenance } from './requirements.mjs';

const sortedMap = (entries) => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
const builders = (featureId, components) => components.filter((c) => (c.builds ?? []).some((b) => b.feature === featureId));

// The feature lands with the component most specific to it — fewest other
// features built, earliest milestone on a tie — so shared plumbing never
// drags a feature to the last milestone.
export function mainBuilder(featureId, components) {
  return builders(featureId, components)
    .sort((a, b) => a.builds.length - b.builds.length || String(a.milestone).localeCompare(String(b.milestone), undefined, { numeric: true }))[0];
}

function featureRow(feature, ctx) {
  const n = scoreNumbers(feature.scores);
  const p = featurePrice(n);
  const req = ctx.req.features[feature.id];
  ctx.priced.push({ point: p.point, spread: p.spread, unc: n.unc, risk: n.risk });
  return {
    name: req.name,
    system: ctx.req.systemById[ctx.req.systemOf[feature.id]]?.name ?? null,
    provenance: featureProvenance(req),
    milestone: mainBuilder(feature.id, ctx.components)?.milestone ?? null,
    builtBy: builders(feature.id, ctx.components).map((c) => c.id).sort(),
    ...scoreSummary(feature),
    point: round2(p.point), spread: round2(p.spread), priceLow: round2(p.low), priceHigh: round2(p.high), flag: p.flag,
  };
}

function componentRow(c, ctx) {
  const tasks = {};
  let hours = 0; let low = 0; let high = 0;
  for (const task of c.tasks ?? []) {
    const a = agenticTask(task, ctx.agentic);
    tasks[task.id] = { e: round2(a.e), low: round2(a.lowH), high: round2(a.highH), sigma: round2(a.sigma), confidence: a.confidence, calibrated: a.calibrated, matchLevel: a.matchLevel };
    hours += a.e; low += a.lowH; high += a.highH;
  }
  return {
    name: c.name, container: c.parent ?? null, milestone: c.milestone ?? null,
    builds: (c.builds ?? []).map((b) => b.feature), hours: round2(hours), low: round2(low), high: round2(high),
    tasks: sortedMap(Object.entries(tasks)),
  };
}

function roundedPrice(price) {
  const block = Object.fromEntries(Object.entries(price).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v]));
  block.overheads = { ...price.overheads, amount: round2(price.overheads.amount) };
  return block;
}

export function computeWorkflowEstimation(inputs, req, measurements) {
  const agentContext = { ...inputs.agentContext, repository: inputs.agentContext.repository ?? inputs.project };
  const ctx = { req, components: inputs.components, priced: [], agentic: { records: measurements ?? [], agentContext } };
  const features = sortedMap(inputs.features.map((f) => [f.id, featureRow(f, ctx)]));
  const components = sortedMap(inputs.components.map((c) => [c.id, componentRow(c, ctx)]));
  const price = projectPrice({ features: ctx.priced, levels: inputs.contextLevels ?? {} });
  return { inputs, computed: { features, components, price: roundedPrice(price) } };
}
