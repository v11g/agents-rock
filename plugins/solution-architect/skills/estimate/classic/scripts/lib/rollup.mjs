// Turns validated estimation-inputs into the estimation.json truth: PERT per
// task, per-feature price bands, and the project price roll-up. The dynamic,
// id-keyed maps (tasks, features, components) are assembled with sorted keys
// so repeat runs are byte-identical.
import { pert, round2 } from '../../../shared/lib/estimate-math.mjs';
import { featurePrice } from '../../../shared/lib/pricing.mjs';
import { projectPrice } from '../../../shared/lib/project-price.mjs';
import { roadmapFor } from './roadmap.mjs';
import { componentHoursFor } from './components.mjs';
import { agenticTask } from '../../../shared/lib/baselines.mjs';
import { scoreNumbers, scoreSummary } from '../../../shared/lib/scoring.mjs';

function sortedMap(entries) {
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

const CONFIDENCE_RANK = { HIGH: 0, MED: 1, LOW: 2, UNCALIBRATED: 3 };

export function criticalConfidence(features, tasks) {
  let critical = null;
  for (const feature of features) {
    if (!critical || feature.hours > critical.hours) critical = feature;
  }
  let worst = 'HIGH';
  for (const taskId of critical.taskIds) {
    const confidence = tasks[taskId].confidence;
    if (CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[worst]) worst = confidence;
  }
  return worst;
}

function buildTasks(inputs) {
  const tasks = {};
  for (const feature of inputs.features) {
    for (const task of feature.tasks) {
      const { e, sigma } = pert(task);
      tasks[task.id] = {
        e, sigma, o: task.o, p: task.p, category: task.category,
        confidence: task.confidence, verificationPct: inputs.verificationPct,
      };
    }
  }
  return tasks;
}

function buildAgenticTasks(inputs, measurements) {
  const agentContext = { ...inputs.agentContext, repository: inputs.agentContext.repository ?? inputs.project };
  const ctx = { records: measurements ?? [], agentContext };
  const tasks = {};
  for (const feature of inputs.features) {
    for (const task of feature.tasks) {
      const a = agenticTask(task, ctx);
      tasks[task.id] = { ...a, o: a.lowH, p: a.highH };
    }
  }
  return tasks;
}

// Prices a scored feature onto `row` and pushes its price inputs onto
// `priced` for the project roll-up. scoreSummary stays the single authority
// for a feature's scoreTotal/tier; featurePrice only supplies the money.
function scoredFeatureRow(feature, row, priced) {
  const n = scoreNumbers(feature.scores);
  const p = featurePrice(n);
  Object.assign(row, scoreSummary(feature), {
    point: round2(p.point), spread: round2(p.spread),
    priceLow: round2(p.low), priceHigh: round2(p.high), flag: p.flag,
  });
  priced.push({ point: p.point, spread: p.spread, unc: n.unc, risk: n.risk });
}

// Feature rows carry both halves now: hours for planning, price for the
// quote. They come from different inputs and never convert into each other.
function buildFeatures(inputs, tasks) {
  const features = {};
  const summaries = [];
  const priced = [];
  for (const feature of inputs.features) {
    const taskIds = feature.tasks.map((t) => t.id);
    const hours = taskIds.reduce((sum, id) => sum + tasks[id].e, 0);
    const low = taskIds.reduce((sum, id) => sum + tasks[id].o, 0);
    const high = taskIds.reduce((sum, id) => sum + tasks[id].p, 0);
    const row = { hours: round2(hours), low: round2(low), high: round2(high) };
    if (feature.scores) scoredFeatureRow(feature, row, priced);
    features[feature.id] = row;
    summaries.push({ hours, taskIds });
  }
  return { features: sortedMap(Object.entries(features)), summaries, priced };
}

// Rounds every top-level money/rate field on the price block, plus the one
// nested money field (overheads.amount) the top-level pass can't reach
// because `overheads` itself is an object, not a number.
function roundedPrice(price) {
  const block = Object.fromEntries(
    Object.entries(price).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v]),
  );
  block.overheads = { ...price.overheads, amount: round2(price.overheads.amount) };
  return block;
}

const isAgentic = (inputs) => inputs.deliveryMode === 'agentic';

const taskSummary = (t) => (t.evidence !== undefined
  ? {
    e: round2(t.e), sigma: round2(t.sigma), minutes: t.minutes, samples: t.samples,
    matchLevel: t.matchLevel, confidence: t.confidence, calibrated: t.calibrated, evidence: t.evidence,
  }
  : { e: round2(t.e), sigma: round2(t.sigma) });

export function computeEstimation(inputs, measurements) {
  const tasks = isAgentic(inputs) ? buildAgenticTasks(inputs, measurements) : buildTasks(inputs);
  const { features, summaries, priced } = buildFeatures(inputs, tasks);
  const taskHours = Object.fromEntries(Object.entries(tasks).map(([id, t]) => [id, t.e]));
  const roadmap = roadmapFor({ features: inputs.features, taskHours });
  const components = componentHoursFor(inputs, features);
  const price = projectPrice({ features: priced, levels: inputs.contextLevels ?? {} });
  return {
    inputs,
    computed: {
      tasks: sortedMap(Object.entries(tasks).map(([id, t]) => [id, taskSummary(t)])),
      features,
      ...(components ? { components } : {}),
      ...(roadmap ? { roadmap } : {}),
      price: roundedPrice(price),
      projectConfidence: criticalConfidence(summaries, tasks),
    },
  };
}
