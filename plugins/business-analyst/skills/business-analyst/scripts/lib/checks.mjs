import { REGISTERS, STATUSES, AREAS, checkSchema } from './schema.mjs';
import { scopeIds } from './scope-rules.mjs';
import { checkScope } from './scope-checks.mjs';
import { checkScopeMd } from './scope-md.mjs';

const LABELED = ['requirements', 'nfrs', 'integrations', 'data'];
const SOURCED = ['requirements', 'businessRules', 'constraints'];

export function collectIds(pkg) {
  const ids = new Set((pkg.context?.goals ?? []).map((g) => g.id));
  for (const [name] of REGISTERS) for (const row of pkg[name] ?? []) ids.add(row.id);
  return ids;
}

export function checkDuplicates(pkg) {
  const findings = [];
  const seen = new Set();
  const rows = [...(pkg.context?.goals ?? []), ...REGISTERS.flatMap(([name]) => pkg[name] ?? [])];
  for (const row of rows) {
    if (seen.has(row.id)) findings.push(`duplicate id: ${row.id}`);
    seen.add(row.id);
  }
  return findings;
}

export function checkRefs(pkg, ids) {
  const findings = [];
  const miss = (owner, ref) => findings.push(`${owner}: dangling reference ${ref}`);
  for (const fr of pkg.requirements ?? []) {
    const t = fr.traces ?? {};
    const refs = [t.goal, t.workflow, ...(t.rules ?? []), ...(fr.acceptance ?? [])];
    for (const ref of refs) if (ref && !ids.has(ref)) miss(fr.id, ref);
  }
  for (const br of pkg.businessRules ?? []) {
    if (br.openQuestion && !ids.has(br.openQuestion)) miss(br.id, br.openQuestion);
  }
  for (const sc of pkg.scenarios ?? []) if (!ids.has(sc.requirement)) miss(sc.id, sc.requirement);
  for (const q of pkg.openQuestions ?? []) {
    for (const ref of q.affects ?? []) if (!ids.has(ref)) miss(q.id, ref);
  }
  for (const ref of pkg.readiness?.blockers ?? []) if (!ids.has(ref)) miss('readiness.blockers', ref);
  return findings;
}

function hasOpenQuestionFor(pkg, id) {
  return (pkg.openQuestions ?? []).some((q) => (q.affects ?? []).includes(id));
}

export function checkLabels(pkg) {
  const findings = [];
  for (const name of LABELED) {
    for (const row of pkg[name] ?? []) if (!row.label) findings.push(`${row.id}: missing label`);
  }
  for (const name of SOURCED) {
    for (const row of pkg[name] ?? []) if (!row.source) findings.push(`${row.id}: missing source`);
  }
  for (const fr of pkg.requirements ?? []) {
    if (fr.label === 'recommended' && fr.scope === 'in' && !hasOpenQuestionFor(pkg, fr.id)) {
      findings.push(`${fr.id}: recommended requirement in scope "in" without a paired open question`);
    }
  }
  return findings;
}

export const AMBIGUOUS = [
  'fast', 'quick', 'easy', 'simple', 'user-friendly', 'intuitive', 'flexible',
  'robust', 'seamless', 'efficient', 'optimal', 'appropriate', 'various',
  'etc', 'some', 'many', 'several', 'as needed',
];

export function checkAmbiguity(pkg) {
  const findings = [];
  for (const row of [...(pkg.requirements ?? []), ...(pkg.nfrs ?? [])]) {
    for (const word of AMBIGUOUS) {
      const re = new RegExp(`\\b${word.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
      if (re.test(row.text ?? '')) {
        findings.push(`${row.id}: ambiguous term "${word}" — replace with a measurable statement`);
      }
    }
  }
  return findings;
}

export function checkReadiness(pkg) {
  const findings = [];
  const r = pkg.readiness ?? {};
  const values = AREAS.map((a) => r.areas?.[a]).filter((v) => typeof v === 'number');
  if (values.length !== AREAS.length) findings.push('readiness.areas: missing area score');
  const mean = Math.round(values.reduce((s, v) => s + v, 0) / (values.length || 1));
  if (r.overall !== mean) findings.push(`readiness.overall ${r.overall} != recomputed mean ${mean}`);
  const openBlockers = (pkg.openQuestions ?? []).filter((q) => q.status === 'open' && q.architectureBlocker);
  if (openBlockers.length && STATUSES.indexOf(pkg.status) > STATUSES.indexOf('ANALYZED')) {
    findings.push(`status ${pkg.status} with open architecture blockers: ${openBlockers.map((q) => q.id).join(', ')}`);
  }
  for (const q of openBlockers) {
    if (!(r.blockers ?? []).includes(q.id)) findings.push(`readiness.blockers missing ${q.id}`);
  }
  const risky = (pkg.assumptions ?? []).filter((a) => a.impact === 'high' && a.status === 'unconfirmed');
  if (pkg.status === 'READY_FOR_ARCHITECTURE' && risky.length) {
    findings.push(`READY_FOR_ARCHITECTURE with unconfirmed high-impact assumptions: ${risky.map((a) => a.id).join(', ')}`);
  }
  if (pkg.status === 'READY_FOR_ARCHITECTURE' && (pkg.conflicts ?? []).some((c) => c.status === 'open')) {
    findings.push('READY_FOR_ARCHITECTURE with open conflicts');
  }
  return findings;
}

const PARTS = ['Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5'];
const QUICK_PARTS = ['Part 1', 'Part 3', 'Part 5'];
export const ID_TOKEN = /\b(?:G|ACT|WF|FR|BR|SC|NFR|INT|DAT|CON|ASM|Q|CONFLICT|SYS|FEAT)-\d{3}\b/g;

function sectionBodies(md) {
  const bodies = {};
  for (const chunk of md.split(/^## /m).slice(1)) {
    const nl = chunk.indexOf('\n');
    const title = nl === -1 ? chunk.trim() : chunk.slice(0, nl).trim();
    const body = nl === -1 ? '' : chunk.slice(nl + 1);
    bodies[title] = body;
  }
  return bodies;
}

export function checkMd(pkg, md) {
  const findings = [];
  if (/\[TODO\]|\bTBD\b|\bXXX\b/.test(md)) findings.push('md: placeholder found ([TODO]/TBD/XXX)');
  const bodies = sectionBodies(md);
  const required = pkg.depth === 'QUICK' ? QUICK_PARTS : PARTS;
  for (const part of required) {
    const key = Object.keys(bodies).find((h) => h.startsWith(part));
    if (!key) findings.push(`md: missing section "## ${part}"`);
    else if (!bodies[key].trim()) findings.push(`md: empty section "## ${part}"`);
  }
  const mdIds = new Set([...md.matchAll(ID_TOKEN)].map((m) => m[0]));
  for (const id of [...collectIds(pkg), ...scopeIds(pkg)]) {
    if (!mdIds.has(id)) findings.push(`md: id ${id} absent from requirements.md`);
  }
  const fmStatus = md.match(/^status:\s*(\S+)/m)?.[1];
  if (fmStatus !== pkg.status) findings.push(`md frontmatter status ${fmStatus} != json status ${pkg.status}`);
  const fmDepth = md.match(/^depth:\s*(\S+)/m)?.[1];
  if (fmDepth !== pkg.depth) findings.push(`md frontmatter depth ${fmDepth} != json depth ${pkg.depth}`);
  const fmReadiness = Number(md.match(/^readiness:\s*(\d+)/m)?.[1]);
  if (fmReadiness !== pkg.readiness?.overall) {
    findings.push(`md frontmatter readiness ${fmReadiness} != json readiness.overall ${pkg.readiness?.overall}`);
  }
  return findings;
}

export function checkMdOrphanIds(pkg, md, ids) {
  const findings = [];
  for (const m of md.matchAll(ID_TOKEN)) {
    if (!ids.has(m[0])) findings.push(`md: unknown id ${m[0]}`);
  }
  return findings;
}

export function checkPackage({ pkg, md }) {
  const schemaFindings = checkSchema(pkg);
  if (schemaFindings.length) return schemaFindings;
  const ids = new Set([...collectIds(pkg), ...scopeIds(pkg)]);
  const scope = checkScope(pkg, ids);
  const json = [
    ...checkDuplicates(pkg),
    ...checkRefs(pkg, ids),
    ...checkLabels(pkg),
    ...checkAmbiguity(pkg),
    ...checkReadiness(pkg),
    ...scope,
  ];
  // A broken scope cannot be rendered, so the md compare waits for it.
  if (md == null) return json;
  return [...json, ...checkMd(pkg, md), ...checkMdOrphanIds(pkg, md, ids), ...(scope.length ? [] : checkScopeMd(pkg, md))];
}
