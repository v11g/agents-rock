// Turns validated estimation-inputs into the estimation.json truth: PERT per
// task, AI-adjusted hours per (task × scenario), buffers, and cost rollups.
// Every map is assembled with sorted keys so repeat runs are byte-identical.
import {
  pert, projectBuffer, taskHours, riskBufferHours, scenarioRollup, dominantSeniority,
} from './estimate-math.mjs';
import { roadmapFor } from './roadmap.mjs';
import { componentHoursFor } from './components.mjs';
import { agenticTask } from './baselines.mjs';
import { scoreSummary } from './scoring.mjs';

function sortedMap(entries) {
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function taskHoursFor(scenario, tasks) {
  const seniority = dominantSeniority(scenario.team);
  const entries = Object.keys(tasks).map((id) => [id, tasks[id].evidence !== undefined
    ? tasks[id].e
    : taskHours({
      e: tasks[id].e, seniority, aiAssisted: scenario.aiAssisted,
      category: tasks[id].category, verificationPct: tasks[id].verificationPct,
    })]);
  return sortedMap(entries);
}

export function scenarioBlock(scenario, ctx) {
  const taskHours = taskHoursFor(scenario, ctx.tasks);
  const sumTaskHours = Object.values(taskHours).reduce((a, b) => a + b, 0);
  const hours = sumTaskHours + sumTaskHours * ctx.overheadPct + ctx.spreadBufferHours + ctx.riskBufferHours;
  const rollup = scenarioRollup({ hours, team: scenario.team, toolingCostPerSeat: scenario.toolingCostPerSeat });
  const roadmap = roadmapFor({ features: ctx.features, taskHours, months: rollup.months })
    ?.map((b) => ({ ...b, startMonths: round2(b.startMonths), endMonths: round2(b.endMonths) }));
  const notes = [];
  if (scenario.team.length === 1) notes.push('bus factor: single engineer');
  if (scenario.team.length > 3) notes.push('coordination overhead grows past 3 engineers');
  return {
    taskHours: sortedMap(Object.entries(taskHours).map(([id, h]) => [id, round2(h)])),
    hours: round2(hours),
    months: round2(rollup.months),
    laborCost: round2(rollup.laborCost),
    toolingCost: round2(rollup.toolingCost),
    totalCost: round2(rollup.totalCost),
    notes,
    ...(roadmap ? { roadmap } : {}),
  };
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

function buildFeatures(inputs, tasks) {
  const features = {};
  const summaries = [];
  for (const feature of inputs.features) {
    const taskIds = feature.tasks.map((t) => t.id);
    const hours = taskIds.reduce((sum, id) => sum + tasks[id].e, 0);
    const low = taskIds.reduce((sum, id) => sum + tasks[id].o, 0);
    const high = taskIds.reduce((sum, id) => sum + tasks[id].p, 0);
    features[feature.id] = { hours: round2(hours), low: round2(low), high: round2(high), ...scoreSummary(feature) };
    summaries.push({ hours, taskIds });
  }
  return { features: sortedMap(Object.entries(features)), summaries };
}

function globalBuffers(tasks, risks) {
  const devHours = Object.values(tasks).reduce((sum, t) => sum + t.e, 0);
  const spreadBufferHours = projectBuffer(Object.values(tasks).map((t) => t.sigma));
  return { devHours, spreadBufferHours, riskBufferHours: riskBufferHours(risks) };
}

const isAgentic = (inputs) => inputs.deliveryMode === 'agentic';

const normalizeRisks = (inputs) => (isAgentic(inputs)
  ? inputs.risks.map((r) => ({ ...r, impactHours: r.impactMinutes / 60 }))
  : inputs.risks);

const taskSummary = (t) => (t.evidence !== undefined
  ? {
    e: round2(t.e), sigma: round2(t.sigma), minutes: t.minutes, samples: t.samples,
    matchLevel: t.matchLevel, confidence: t.confidence, calibrated: t.calibrated, evidence: t.evidence,
  }
  : { e: round2(t.e), sigma: round2(t.sigma) });

const computedBlock = (ctx) => ({
  tasks: sortedMap(Object.entries(ctx.tasks).map(([id, t]) => [id, taskSummary(t)])),
  features: ctx.features,
  ...(ctx.components ? { components: ctx.components } : {}),
  devHours: round2(ctx.buffers.devHours),
  overheadHours: round2(ctx.buffers.devHours * ctx.overheadPct),
  spreadBufferHours: round2(ctx.buffers.spreadBufferHours),
  riskBufferHours: round2(ctx.buffers.riskBufferHours),
  scenarios: ctx.scenarios,
  projectConfidence: criticalConfidence(ctx.summaries, ctx.tasks),
});

export function computeEstimation(inputs, measurements) {
  const risks = normalizeRisks(inputs);
  const tasks = isAgentic(inputs) ? buildAgenticTasks(inputs, measurements) : buildTasks(inputs);
  const { features, summaries } = buildFeatures(inputs, tasks);
  const buffers = globalBuffers(tasks, risks);
  const ctx = { tasks, features: inputs.features, overheadPct: inputs.overheadPct, ...buffers };
  const scenarios = sortedMap(inputs.scenarios.map((s) => [s.id, scenarioBlock(s, ctx)]));
  const components = componentHoursFor(inputs, features);
  return {
    inputs,
    computed: computedBlock({
      tasks, features, components, buffers, overheadPct: inputs.overheadPct, scenarios, summaries,
    }),
  };
}
