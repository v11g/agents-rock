export const START = '<!-- scope:start -->';
export const END = '<!-- scope:end -->';

const stepOf = (ref) => ref.slice(ref.indexOf(':') + 1);
export const cell = (text) => String(text).replaceAll('|', '\\|');

export function mermaid(w) {
  const ids = new Map();
  const nid = (n) => {
    if (!ids.has(n)) ids.set(n, `n${ids.size}`);
    return ids.get(n);
  };
  const steps = w.steps ?? [];
  steps.forEach(nid);
  const lines = ['flowchart LR'];
  steps.slice(1).forEach((s, i) => lines.push(`  ${nid(steps[i])} --> ${nid(s)}`));
  for (const b of w.branches ?? []) lines.push(`  ${nid(b.from)} -.->${b.label ? `|${b.label}|` : ''} ${nid(b.to)}`);
  for (const [n, id] of ids) lines.push(`  ${id}["${n.replaceAll('"', "'")}"]`);
  return ['```mermaid', ...lines, '```'].join('\n');
}

function whereCell(f, sys, flows) {
  const refs = f.steps ?? [];
  if (!refs.length) return '—';
  if (refs.length === 1 && refs[0] === '*') return 'every step';
  const groups = new Map();
  for (const r of refs) {
    const wid = r.slice(0, r.indexOf(':'));
    groups.set(wid, [...(groups.get(wid) ?? []), stepOf(r)]);
  }
  return [...groups]
    .map(([wid, st]) => st.join(' → ') + ((sys.workflows ?? []).includes(wid) ? '' : ` (in ${flows.get(wid).name})`))
    .join('; ');
}

function workflowBlock(w, main, flows) {
  let head = `**${main ? 'Main workflow' : 'Sub-workflow'}: ${w.id} ${w.name}**`;
  if (w.sub) {
    head += ` — starts at ${stepOf(w.sub.startsAt)}, rejoins ${flows.get(w.sub.rejoins).name}`;
    if (w.sub.share) head += ` · ${w.sub.share}`;
  }
  return [head, mermaid(w)].join('\n\n');
}

function systemBlock(s, ctx) {
  const replaced = [...new Set((s.workflows ?? []).flatMap((id) => ctx.flows.get(id).replaces ?? []))];
  const names = replaced.map((id) => `"${ctx.flows.get(id).name}"`).join(', ');
  const intro = s.purpose + (replaced.length ? ` Replaces today's ${names}.` : '');
  const rows = (s.features ?? []).map((id) => ctx.feats.get(id)).map((f) =>
    `| ${f.id} | ${cell(f.name)} | ${cell(f.does)} | ${cell(whereCell(f, s, ctx.flows))} | ${(f.requirements ?? []).join(', ') || '—'} |`);
  const table = ['| ID | Feature | What it does | Where in the workflow | Requirements |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
  const flowsMd = (s.workflows ?? []).map((id, i) => workflowBlock(ctx.flows.get(id), i === 0, ctx.flows));
  return [`### ${s.id} ${s.name}`, intro, ...flowsMd, table].join('\n\n');
}

function systemsTable(pkg) {
  const map = pkg.mapLabel;
  const head = map ? `| ID | System | Purpose | ${cell(map)} |\n| --- | --- | --- | --- |` : '| ID | System | Purpose |\n| --- | --- | --- |';
  const rows = pkg.systems.map((s) => `| ${s.id} | ${cell(s.name)} | ${cell(s.purpose)} |${map ? ` ${cell(s.map ?? '—')} |` : ''}`);
  return [head, ...rows].join('\n');
}

export function renderScope(pkg) {
  const ctx = {
    flows: new Map((pkg.workflows ?? []).map((w) => [w.id, w])),
    feats: new Map(pkg.features.map((f) => [f.id, f])),
  };
  const n = pkg.systems.length;
  const intro = `What we propose to build: ${n === 1 ? 'one system' : `${n} systems`}, each shown as its workflows and then the features that serve them.`;
  return [START, '### To-be scope', intro, systemsTable(pkg),
    ...pkg.systems.map((s) => systemBlock(s, ctx)), END].join('\n\n');
}
