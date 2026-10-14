import { readFileSync } from 'node:fs';

// The lookup keys on heading text rather than on a slug for two reasons: slugify
// keeps both spaces around a stripped "&", so "Goals & Scope" becomes
// goals--scope; and h2/h3 ids in one document share a dedupe registry, so an h3 named Security
// under Crosscutting Concepts would take `security` and demote §12's h2 to
// security-2.
//
// It matches on a normalised form because the markdown is the source of truth and
// the markdown varies. A real set writes "## 1 Goals and Scope" — number folded
// into the heading, "and" spelled out — while this list and the fixture write
// "Goals & Scope". Keyed on the raw string, all 16 lookups missed and the viewer
// drew nothing, with every test still green because the fixture shared the
// mistake.
//
// The leading number is dropped rather than matched on: §3 Project Structure is
// brownfield-only, so a greenfield set renumbers every section after it, and a
// number-keyed lookup would then hand §13's explainer to §12.
export function normTitle(title) {
  return String(title)
    .replace(/^\s*\d+[.)]?\s+/, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// The 16 spine headings, title only — see references/writing.md §1.
export const SPINE_TITLES = Object.freeze([
  'Goals & Scope', 'Constraints', 'Project Structure', 'Solution Strategy',
  'Architecture Model', 'Core Components', 'Runtime Behaviour', 'Data Stores',
  'External Integrations', 'Deployment & Infrastructure', 'Crosscutting Concepts',
  'Security', 'Quality Requirements & SLOs', 'Decisions',
  'Risks & Technical Debt', 'Glossary',
]);

export function sectionHelp() {
  const url = new URL('../../assets/section-help.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

// The result is spliced into an inline <script>, so a "</script" sequence
// anywhere in the prose would close the element early and inject the remainder
// as markup. Escaping "<" is enough to make that impossible and still parses as
// JSON. THEME gets away with a raw splice because a palette file is hex and
// keys; this is author-written sentences.
export function serialiseHelp(help) {
  return JSON.stringify(help).replace(/</g, '\\u003c');
}
