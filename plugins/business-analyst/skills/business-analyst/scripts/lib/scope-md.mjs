import { modeOf } from './scope-rules.mjs';
import { START, END, cell, renderScope } from './scope-render.mjs';

const BLOCK = /<!-- scope:start -->[\s\S]*?<!-- scope:end -->\n*/;
// The 0.3.x Start-here line pointed the PO at this section; the PO now has
// the review page, so re-running scope removes the line from older files.
const HERE = /\n> \*\*Product owner\? Start here:\*\*[^\n]*\n/;
const cells = (line) => line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
const count = (md, marker) => md.split(marker).length - 1;

export function checkMarkers(md) {
  const [s, e] = [count(md, START), count(md, END)];
  const ok = s === e && s <= 1 && md.indexOf(START) <= md.indexOf(END);
  return ok ? [] : ['md: scope markers unbalanced'];
}

export function applyScope(md, pkg) {
  let out = md.replace(HERE, '');
  const at = out.search(BLOCK);
  out = out.replace(BLOCK, '');
  if (modeOf(pkg) === 'classic') return out;
  const part3 = out.search(/^## Part 3/m);
  const i = at >= 0 ? at : part3 >= 0 ? part3 : out.length;
  return `${out.slice(0, i)}${renderScope(pkg)}\n\n${out.slice(i)}`;
}

function expectedFeature(pkg, frId) {
  const names = pkg.features.filter((f) => (f.requirements ?? []).includes(frId)).map((f) => f.name);
  return names.length ? names.join(', ') : '—';
}

function checkFeatureColumn(pkg, md) {
  const lines = md.split('\n');
  const header = lines.find((l) => /^\| ID \| Requirement \|/.test(l));
  if (!header || cells(header).at(-1) !== 'Feature') return ['md: FR table has no Feature column'];
  const findings = [];
  for (const line of lines.filter((l) => /^\| FR-\d{3} \|/.test(l))) {
    const c = cells(line);
    const want = cell(expectedFeature(pkg, c[0]));
    if (c.at(-1) !== want) findings.push(`md: ${c[0]} Feature column says ${c.at(-1)}, json says ${want}`);
  }
  return findings;
}

export function checkScopeMd(pkg, md) {
  const findings = checkMarkers(md);
  const fm = md.match(/^scopeMode:\s*(\S+)/m)?.[1] ?? 'classic';
  if (fm !== modeOf(pkg)) findings.push('md: scopeMode does not match json');
  const block = md.match(BLOCK)?.[0].trimEnd() ?? null;
  if (modeOf(pkg) === 'classic') return block ? [...findings, 'md: To-be scope only in workflow mode'] : findings;
  if (block !== renderScope(pkg)) findings.push('md: To-be scope is stale — run scope');
  return [...findings, ...checkFeatureColumn(pkg, md)];
}
