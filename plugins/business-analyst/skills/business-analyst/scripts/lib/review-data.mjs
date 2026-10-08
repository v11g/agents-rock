// requirements.json → what the read-only review page shows (spec R1–R4).
// Business words only: ids never reach the page.
import { ID_TOKEN } from './checks.mjs';
import { toBe } from './scope-rules.mjs';

const NEW = 'PO in interview';
const added = (r) => (typeof r.source === 'string' && r.source.startsWith(NEW) ? r.source : null);
const title = (lead) => lead.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const shownAssumptions = (pkg) => (pkg.assumptions ?? []).filter((a) => a.status !== 'resolved');
const flowMap = (pkg) => new Map((pkg.workflows ?? []).map((w) => [w.id, w]));

function flowData(w, flows) {
  const steps = w.steps ?? [];
  return {
    name: w.name, steps,
    branches: (w.branches ?? []).map((b) => ({ from: b.from, to: b.to, label: b.label ?? null, back: steps.includes(b.to) })),
    sub: w.sub ? {
      startsAt: w.sub.startsAt.slice(w.sub.startsAt.indexOf(':') + 1),
      rejoins: flows.get(w.sub.rejoins)?.name ?? null, share: w.sub.share ?? null,
    } : null,
  };
}

export function pageData(pkg, date) {
  const flows = flowMap(pkg);
  const feats = new Map(pkg.features.map((f) => [f.id, f]));
  const systems = pkg.systems.map((s) => ({
    name: s.name, purpose: s.purpose,
    flows: (s.workflows ?? []).map((id) => flowData(flows.get(id), flows)),
    features: (s.features ?? []).map((id) => feats.get(id)).map((f) => ({ name: f.name, does: f.does, added: added(f) })),
  }));
  const assumptions = shownAssumptions(pkg).map((a) => ({ text: a.text, added: added(a) }));
  return { title: title(pkg.lead), date, systems, assumptions };
}

// R2: the page shows decided scope only; the interview settles the rest.
export function undecided(pkg) {
  return [...pkg.systems, ...toBe(pkg), ...pkg.features]
    .filter((r) => r.label !== 'confirmed')
    .map((r) => `${r.id}: not decided; ask the PO in the interview`);
}

// R3: every free text the page shows verbatim, as [record id, field, text].
function shownText(pkg) {
  const flows = flowMap(pkg);
  const when = (ok, row) => (ok ? [row] : []);
  const flowText = (w) => [[w.id, 'name', w.name], ...(w.steps ?? []).map((x) => [w.id, 'step', x]),
    ...(w.branches ?? []).flatMap((b) => [...when(!(w.steps ?? []).includes(b.to), [w.id, 'step', b.to]), [w.id, 'branch label', b.label]]),
    [w.id, 'share', w.sub?.share]];
  return [
    ...pkg.systems.flatMap((s) => [[s.id, 'name', s.name], [s.id, 'purpose', s.purpose]]),
    ...pkg.systems.flatMap((s) => (s.workflows ?? []).map((id) => flows.get(id))).flatMap(flowText),
    ...pkg.features.flatMap((f) => [[f.id, 'name', f.name], [f.id, 'does', f.does], ...when(added(f), [f.id, 'source', f.source])]),
    ...shownAssumptions(pkg).flatMap((a) => [[a.id, 'text', a.text], ...when(added(a), [a.id, 'source', a.source])]),
  ];
}

// The page must not carry ids (R3): one finding per field that names one.
export function idLeaks(pkg) {
  const out = [];
  for (const [id, field, text] of shownText(pkg)) {
    const ids = [...new Set(String(text ?? '').match(ID_TOKEN) ?? [])];
    if (ids.length) out.push(`${id}: ${field} names an id (${ids.join(', ')}); the PO page shows it`);
  }
  return out;
}
