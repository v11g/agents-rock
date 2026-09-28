// Structural half of the proposal gate: frontmatter contract, the nine
// sections, placeholder scan, future validity. Client-safety checks live
// in checks-client.mjs.
import { SECTIONS, sectionText, tables } from './sections.mjs';

const FM_KEYS = ['client', 'client_tech_level', 'currency',
  'valid_until', 'source_architecture', 'source_estimation'];
const TECH_LEVELS = ['non-tech', 'low-tech', 'technical'];
const DURATION_HEADER = /\|\s*Duration\s*\|/i;

function checkFrontmatter({ fm, today }, out) {
  for (const key of FM_KEYS) {
    if (!fm[key]) out.push(`frontmatter: missing "${key}"`);
  }
  if (fm.client_tech_level && !TECH_LEVELS.includes(fm.client_tech_level)) {
    out.push(`frontmatter: client_tech_level must be ${TECH_LEVELS.join('|')}`);
  }
  checkValidUntil(fm.valid_until, today, out);
}

// Both of these priced a team. The estimate prices a package now, so a
// document still carrying either is showing a number nothing computed.
function checkRemoved({ fm, md }, out) {
  if ('scenario' in fm) out.push('frontmatter: "scenario" was removed — the estimate has one price');
  if (/^##\s+Team\s*$/m.test(md)) out.push('the Team section was removed — this estimate prices a package, not a staffing plan');
  const investment = sectionText(md, 'Investment & Timeline') ?? '';
  if (DURATION_HEADER.test(investment)) {
    out.push('Investment & Timeline must not carry a Duration column — the estimate produces no timeline');
  }
}

function checkValidUntil(raw, today, out) {
  if (!raw) return;
  const wellFormed = /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw));
  if (!wellFormed) { out.push('frontmatter: valid_until must be an ISO date (YYYY-MM-DD)'); return; }
  if (new Date(raw) <= today) out.push(`frontmatter: valid_until ${raw} is not in the future`);
}

function checkSections(md, out) {
  for (const name of SECTIONS) {
    const body = sectionText(md, name);
    if (body === null) { out.push(`missing ## ${name} section`); continue; }
    if (!body.trim()) out.push(`## ${name} section is empty`);
  }
  const solution = sectionText(md, 'Proposed Solution');
  if (solution !== null && !solution.includes('```mermaid')) {
    out.push('Proposed Solution has no mermaid diagram');
  }
}

function checkPlaceholders(md, out) {
  if (/\[TODO\]|\bTBD\b|\bTODO\b|lorem ipsum/i.test(md)) out.push('placeholder text found (TODO/TBD/lorem ipsum)');
  for (const t of tables(md)) {
    if (t.rows.length === 0) out.push(`empty table under header "${t.header.join(' | ')}"`);
  }
}

export function checkDoc({ fm, md, estimation, today }, out = []) {
  checkFrontmatter({ fm, today }, out);
  checkRemoved({ fm, md }, out);
  checkSections(md, out);
  checkPlaceholders(md, out);
  return out;
}
