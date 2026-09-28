// Client-safety half of the proposal gate: every number traces to the
// derived figures, nothing internal leaks, and non-tech documents carry no
// jargon outside the About section.
import { deriveFigures } from './figures.mjs';
import { sectionText, escapeRegExp } from './sections.mjs';
import { JARGON } from './jargon.mjs';

const flat = (f) => [
  f.cost.low, f.cost.high, f.singleNumber,
  ...f.milestones.flatMap((m) => [m.cost.low, m.cost.high]),
];

function checkMoney(md, figures, out) {
  const allowed = new Set(flat(figures));
  for (const m of md.matchAll(/[$€£]\s?([\d,]+(?:\.\d+)?)/g)) {
    const n = Number(m[1].replaceAll(',', ''));
    if (!allowed.has(n)) out.push(`money amount ${m[0].trim()} not derived from estimation.json`);
  }
}

function checkHeadline(md, figures, out) {
  const summary = sectionText(md, 'Executive Summary') ?? '';
  for (const n of [figures.cost.low, figures.cost.high]) {
    if (!summary.includes(n.toLocaleString('en-US'))) {
      out.push(`headline cost bound ${n.toLocaleString('en-US')} missing from Executive Summary`);
    }
  }
}

function checkLeaks({ md }, out) {
  if (/\|\s*src\s*\|/i.test(md)) out.push('leak: provenance "src" column');
  if (/data-internal/.test(md)) out.push('leak: data-internal marker');
  for (const word of ['observed', 'stated', 'researched', 'proposed']) {
    if (new RegExp(`\\|\\s*${word}\\s*\\|`).test(md)) out.push(`leak: provenance cell "${word}"`);
  }
}

function checkJargon({ md, fm }, out) {
  if (fm.client_tech_level !== 'non-tech') return;
  const allow = new Set((Array.isArray(fm.jargon_allow) ? fm.jargon_allow : []).map((w) => w.toLowerCase()));
  const about = sectionText(md, 'About');
  const scanned = md.replace(/^---\n[\s\S]*?\n---/, '').replace(about ?? '', '');
  for (const term of JARGON) {
    if (allow.has(term)) continue;
    if (new RegExp(`(?<![\\w/])${escapeRegExp(term)}(?:e?s)?(?![\\w/])`, 'i').test(scanned)) {
      out.push(`jargon for a non-tech client: "${term}" (rewrite plainly or add to jargon_allow)`);
    }
  }
}

export function checkClient({ md, fm, estimation }, out = []) {
  const figures = deriveFigures(estimation);
  checkMoney(md, figures, out);
  checkHeadline(md, figures, out);
  checkLeaks({ md }, out);
  checkJargon({ md, fm }, out);
  return out;
}
