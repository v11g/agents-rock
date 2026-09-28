// Section slicing + table parsing for proposal.md — same approach as the
// estimate skill's checks.mjs, section names fixed by the writing contract.
export const SECTIONS = [
  'Executive Summary', 'Background & Objectives', 'Proposed Solution', 'Scope',
  'Out of Scope & Assumptions', 'Delivery Approach', 'Investment & Timeline',
  'About', 'Next Steps',
];

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function sectionText(md, name) {
  const m = new RegExp(`^##\\s+${escapeRegExp(name)}.*$`, 'm').exec(md);
  if (!m) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^##\s/m);
  return rest.slice(0, next === -1 ? undefined : next);
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function tables(text) {
  const groups = [];
  let cur = [];
  for (const line of (text ?? '').split('\n')) {
    if (/^\s*\|/.test(line)) cur.push(line);
    else if (cur.length) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups
    .map((g) => g.filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l)))
    .map((g) => ({ header: cells(g[0]), rows: g.slice(1).map(cells) }));
}
