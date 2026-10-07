// Page data for the workflow proposal: the BA package's systems, workflows
// and features, the estimate's milestones, register and price, and the
// agent's sentences from proposal-inputs.json. The HTML and the DOCX both
// print this one object, so the two can never disagree. No ID, score,
// component or per-milestone price goes in (spec 4 P5).
import { milestoneView, registerView } from '../../../estimate/workflow-based/scripts/lib/page-view.mjs';
import { formatMoney } from './figures.mjs';

const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const label = (s) => s.replaceAll('"', "'");

// Mermaid source for one workflow: the steps in a row, each branch dashed
// with its label.
export function flowCode(w) {
  const ids = new Map();
  const id = (name) => ids.get(name) ?? ids.set(name, `n${ids.size}`).get(name);
  const lines = ['flowchart LR'];
  w.steps.forEach((step, i) => { if (i) lines.push(`  ${id(w.steps[i - 1])} --> ${id(step)}`); });
  for (const b of w.branches) lines.push(`  ${id(b.from)} -.->${b.label ? `|"${label(b.label)}"|` : ''} ${id(b.to)}`);
  for (const [name, n] of ids) lines.push(`  ${n}["${label(name)}"]`);
  return lines.join('\n');
}

function flowsOf(system, req) {
  return (system.workflows ?? []).map((wid, i) => {
    const w = req.workflows[wid];
    const flow = { steps: w.steps ?? [], branches: w.branches ?? [] };
    return { label: `${i ? 'Sub-workflow' : 'Main workflow'} · ${w.name}`, code: flowCode(flow), steps: flow.steps.join(' → ') };
  });
}

function systemView(system, i, { req, inputs }) {
  return {
    anchor: `system-${i + 1}`, no: i + 1, name: system.name, purpose: system.purpose ?? '', extra: inputs.systems?.[system.id] ?? '',
    flows: flowsOf(system, req),
    features: (system.features ?? []).map((fid) => ({ name: req.features[fid].name, does: req.features[fid].does ?? '' })),
  };
}

function scopeView({ req, inputs }) {
  const out = req.raw.scope?.out ?? [];
  return {
    intro: inputs.scopeIntro, mapLabel: req.mapLabel,
    systems: req.systems.map((s) => ({ name: s.name, map: s.map ?? '' })),
    outLine: out.length
      ? `Explicitly excluded: ${list(out)}. Every assumption and exclusion is listed at the end of this proposal.`
      : 'The assumptions and exclusions this proposal rests on are listed at the end.',
  };
}

function milestonesView(est, inputs) {
  const rows = milestoneView(est).map((m, i) => ({
    title: `${i + 1}. ${inputs.milestones[m.name].name}`,
    includes: list(m.features.map((f) => f.name)), demonstrates: inputs.milestones[m.name].demonstrates,
  }));
  return { lead: `The ${est.inputs.features.length} features sequence into ${rows.length} milestones; each one ends with something working you can see.`, rows };
}

function costView(est) {
  const { price } = est.computed;
  return {
    lead: `The estimate scores the work behind all ${est.inputs.features.length} features above and rolls it up into a project range, including design, testing, project management and contingency.`,
    range: `${formatMoney(price.presentLow)} – ${formatMoney(price.presentHigh)}`, rangeNote: 'expected cost to worst realistic case, USD',
    single: formatMoney(price.singleNumber), singleNote: 'confident figure: 80% chance the project comes in at or under',
  };
}

export function proposalView({ est, req, inputs }) {
  return {
    client: inputs.client, title: `${inputs.title} — Systems & Workflows Proposal`, byline: `${longDate(inputs.date)} · ${inputs.firm}`,
    file: `${slug(inputs.client)}-proposal.docx`,
    scope: scopeView({ req, inputs }),
    systems: req.systems.map((s, i) => systemView(s, i, { req, inputs })),
    milestones: milestonesView(est, inputs),
    register: { lead: 'These carry over from the estimate, so the price and the scope never drift apart.', ...registerView(est, req) },
    cost: costView(est),
  };
}
