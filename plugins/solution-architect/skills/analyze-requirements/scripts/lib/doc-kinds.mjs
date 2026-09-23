import { basename } from 'node:path';

// The three companions with fixed basenames. interface-contract is absent on
// purpose: its filename is stack-dependent (OpenAPI, tool schemas, data
// contracts, a wire protocol), and if it ships as raw .yaml or .proto it never
// reaches renderMarkdown at all. Excluded rather than guessed at.
const COMPANIONS = new Map([
  ['threat-model.md', 'threat-model'],
  ['estimation.md', 'estimation'],
  ['domain-overview.md', 'domain-overview'],
  ['validation-plan.md', 'validation-plan'],
]);

// The rail row is ~190px wide and companion H1s arrive carrying the project name
// ("# <Project> — Estimation" is the estimate skill's mandated heading), so the
// clip lands on the one word that tells the rows apart and every companion reads
// as a second copy of the spine's row. Labelled by kind instead — the full H1
// stays on the row's hover title, and the document body is untouched.
const LABELS = new Map([
  ['threat-model', 'Threat Model'],
  ['estimation', 'Estimation'],
  ['domain-overview', 'Domain Overview'],
  ['validation-plan', 'Validation Plan'],
]);

// Undefined for the spine and for anything unclassified: those titles are the
// author's own and short enough to rail as written.
export function labelOf(kind) {
  return LABELS.get(kind);
}

// Position, not filename, identifies the spine: render.mjs passes ARCHITECTURE.md
// as docs[0] and a target repo may call it anything. Everything unmatched returns
// undefined and renders exactly as it does today — ADRs, CONTEXT.md,
// CONTEXT-MAP.md and the interface contract are all excluded by the spec.
export function kindOf(path, index) {
  if (index === 0) return 'spine';
  return COMPANIONS.get(basename(path).toLowerCase());
}
