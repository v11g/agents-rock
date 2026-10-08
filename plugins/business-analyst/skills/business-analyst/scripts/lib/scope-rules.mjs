import { LABELS } from './schema.mjs';

export const SCOPE_MODES = ['workflow', 'classic'];
export const TECH_WORDS = ['API', 'database', 'microservice', 'backend', 'frontend', 'server', 'endpoint', 'schema', 'PWA', 'cloud'];

export const modeOf = (pkg) => pkg.scopeMode ?? 'classic';
export const toBe = (pkg) => (pkg.workflows ?? []).filter((w) => w.state === 'to-be');
export const scopeIds = (pkg) => [...(pkg.systems ?? []), ...(pkg.features ?? [])].map((r) => r.id);

function stepIndex(pkg) {
  const idx = new Set();
  for (const w of toBe(pkg)) {
    for (const s of w.steps ?? []) idx.add(`${w.id}:${s}`);
    for (const b of w.branches ?? []) idx.add(`${w.id}:${b.to}`);
  }
  return idx;
}

export function checkFlows(pkg) {
  const findings = [];
  const idx = stepIndex(pkg);
  const flows = toBe(pkg).map((w) => w.id);
  const asIs = (pkg.workflows ?? []).filter((w) => w.state === 'as-is').map((w) => w.id);
  for (const w of toBe(pkg)) {
    for (const b of w.branches ?? []) {
      if (!idx.has(`${w.id}:${b.from}`)) findings.push(`${w.id}: branch from unknown step ${b.from}`);
    }
    if (w.sub && !idx.has(w.sub.startsAt)) findings.push(`${w.id}: sub.startsAt unknown`);
    if (w.sub && !flows.includes(w.sub.rejoins)) findings.push(`${w.id}: sub.rejoins is not a to-be workflow`);
    for (const r of w.replaces ?? []) if (!asIs.includes(r)) findings.push(`${w.id}: replaces unknown as-is workflow ${r}`);
  }
  return findings;
}

export function checkFeatureSteps(pkg) {
  const findings = [];
  const idx = stepIndex(pkg);
  for (const f of pkg.features) {
    const steps = f.steps ?? [];
    if (steps.length === 1 && steps[0] === '*') continue;
    for (const s of steps) if (!idx.has(s)) findings.push(`${f.id}: unknown step ${s}`);
  }
  return findings;
}

export function checkFeatureFrs(pkg, ids) {
  const findings = [];
  const covered = new Set();
  for (const f of pkg.features) {
    for (const fr of f.requirements ?? []) {
      covered.add(fr);
      if (!ids.has(fr)) findings.push(`${f.id}: dangling reference ${fr}`);
    }
  }
  for (const fr of pkg.requirements ?? []) {
    if (fr.scope === 'in' && !covered.has(fr.id)) findings.push(`${fr.id}: in scope but in no feature`);
  }
  return findings;
}

const techWord = (name) => TECH_WORDS.find((w) => new RegExp(`\\b${w}s?\\b`, 'i').test(name ?? ''));

export function checkNames(pkg) {
  const findings = [];
  for (const [kind, rows] of [['system', pkg.systems], ['feature', pkg.features]]) {
    const seen = new Set();
    for (const r of rows) {
      const key = (r.name ?? '').toLowerCase();
      if (seen.has(key)) findings.push(`duplicate ${kind} name: ${r.name}`);
      seen.add(key);
      const word = techWord(r.name);
      if (word) findings.push(`${r.id}: name uses a tech word (${word})`);
    }
  }
  return findings;
}

export function checkScopeLabels(pkg) {
  const findings = [];
  const asked = new Set((pkg.openQuestions ?? []).flatMap((q) => q.affects ?? []));
  for (const r of [...toBe(pkg), ...pkg.systems, ...pkg.features]) {
    if (!r.label) findings.push(`${r.id}: missing label`);
    else if (!LABELS.includes(r.label)) findings.push(`${r.id}: illegal label "${r.label}"`);
    if (!r.source) findings.push(`${r.id}: missing source`);
    if (r.label === 'recommended' && !asked.has(r.id)) {
      findings.push(`${r.id}: recommended without a paired open question`);
    }
  }
  return findings;
}
