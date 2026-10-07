// Baseline retrieval and statistics for agentic estimation. Pure functions:
// records in, numbers out. The agent never touches this math — compute.mjs
// calls it, and the deliverable's Evidence section is built from what this
// module actually matched, so cited history can never be invented.
import { pert } from './estimate-math.mjs';

const Z95 = 1.645; // standard normal 95th-percentile z, applied in log space

export function percentile(values, q) {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const effectiveModel = (task, ctx) => task.model ?? ctx.model;

function similarScope(rec, task) {
  const mine = task.scope?.affectedFiles;
  if (typeof mine !== 'number' || typeof rec.affected_files !== 'number' || mine <= 0) return false;
  return Math.abs(rec.affected_files - mine) / mine <= 0.5;
}

// Spec §2 ladder: stop at the first rung with enough samples. Rungs 1-3 need
// >= 3; the global rung accepts any evidence over none.
const RUNGS = [
  { level: 1, min: 3, hit: (r, t, c) => r.repository === c.repository && r.agent === c.agent && r.model === effectiveModel(t, c) },
  { level: 2, min: 3, hit: (r, t, c) => r.agent === c.agent },
  { level: 3, min: 3, hit: (r, t) => similarScope(r, t) },
  { level: 4, min: 1, hit: () => true },
];

function summarize(hits, level) {
  const mins = hits.map((r) => r.actual_minutes);
  return {
    p50: percentile(mins, 0.5),
    p80: percentile(mins, 0.8),
    p95: percentile(mins, 0.95),
    minM: percentile(mins, 0),
    maxM: percentile(mins, 1),
    samples: hits.length,
    matchLevel: level,
    evidence: hits.map((r) => ({ id: r.task_id, description: r.task_description, minutes: r.actual_minutes })),
  };
}

export function matchBaseline(task, ctx) {
  const shaped = ctx.records.filter((r) => r.task_shape === task.shape);
  for (const rung of RUNGS) {
    const hits = shaped.filter((r) => rung.hit(r, task, ctx.agentContext));
    if (hits.length >= rung.min) return summarize(hits, rung.level);
  }
  return { samples: 0, matchLevel: 0, evidence: [] };
}

// Spec confidence table: sample count sets the tier, variance can demote
// a would-be HIGH (p80/p50 >= 2 means the history itself is unpredictable).
export function confidenceFor(stats) {
  if (stats.samples === 0) return 'UNCALIBRATED';
  if (stats.samples < 3) return 'LOW';
  if (stats.samples < 10) return 'MED';
  return stats.p80 / stats.p50 < 2 ? 'HIGH' : 'MED';
}

function lognormalFit(stats) {
  const sigmaLog = Math.log(stats.p95 / stats.p50) / Z95;
  const mean = stats.p50 * Math.exp((sigmaLog ** 2) / 2);
  return { e: mean / 60, sigma: (mean * Math.sqrt(Math.exp(sigmaLog ** 2) - 1)) / 60 };
}

// Spec §3 bands: >=5 samples fit a lognormal (means sum; medians do not);
// 1-4 samples trust the matched median but take spread from the seed; zero
// samples fall back to the seed entirely.
function fitHours(stats, seed) {
  if (stats.samples >= 5) return lognormalFit(stats);
  if (stats.samples >= 1) return { e: stats.p50 / 60, sigma: (seed.p - seed.o) / 6 / 60 };
  const { e, sigma } = pert(seed);
  return { e: e / 60, sigma: sigma / 60 };
}

// Bounds per band: a lognormal fit reports p50..p95; with 1-4 samples the
// only honest bounds are the extremes actually observed (and p50 == e there,
// which would violate the low < hours < high deliverable rule); no samples
// falls back to the seed range.
function bounds(stats, seed) {
  if (stats.samples >= 5) return { lowH: stats.p50 / 60, highH: stats.p95 / 60 };
  if (stats.samples >= 1) return { lowH: stats.minM / 60, highH: stats.maxM / 60 };
  return { lowH: seed.o / 60, highH: seed.p / 60 };
}

export function agenticTask(task, ctx) {
  const stats = matchBaseline(task, ctx);
  const calibrated = stats.samples > 0;
  const { e, sigma } = fitHours(stats, task.seedMinutes);
  return {
    e,
    sigma,
    ...bounds(stats, task.seedMinutes),
    minutes: calibrated ? stats.p50 : null,
    samples: stats.samples,
    matchLevel: stats.matchLevel,
    confidence: confidenceFor(stats),
    evidence: stats.evidence,
    calibrated,
  };
}
