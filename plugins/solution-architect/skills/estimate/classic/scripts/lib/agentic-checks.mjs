// Agentic-mode deliverable checks (PRD §18): measurement honesty rules that
// only apply when deliveryMode === 'agentic' — vague language, UNCALIBRATED
// masked as measured, invented evidence, missing planning work, and the
// mandatory "Delivery: agentic" header line. Split out of checks.mjs to stay
// under the file's function/line quality gates.
import { heading, tables } from './md-tables.mjs';

const VAGUE_PATTERNS = [
  /\b\d+\s*[–—-]\s*\d+\s*(hours?|hrs|minutes?|mins)\b/i,
  /\bhalf a day\b/i,
  /\ba few (hours|days|minutes)\b/i,
  /\bdepending on complexity\b/i,
];

function checkVagueness(md, out) {
  for (const re of VAGUE_PATTERNS) {
    const m = re.exec(md);
    if (m) out.push(`vague estimate language: "${m[0]}" — one number plus explicit risks`);
  }
}

// The md may only cite history the script actually matched: every Evidence
// row's id AND minutes must match computed.tasks[*].evidence (spec §4:
// "ids, minutes") — a real id with a fabricated Actual (min) cell is just as
// dishonest as an invented id.
function checkEvidence(md, estimation, out) {
  const section = heading(md, 'Evidence');
  if (section === null) { out.push('missing ### Evidence section'); return; }
  const known = new Map(
    Object.values(estimation.computed.tasks).flatMap((t) => (t.evidence ?? []).map((e) => [e.id, e.minutes])));
  for (const row of tables(section).flatMap((t) => t.rows)) {
    if (!known.has(row[0])) { out.push(`evidence row "${row[0]}": not among script-matched measurements`); continue; }
    if (Number(row[2]) !== known.get(row[0])) {
      out.push(`evidence row "${row[0]}": Actual (min) "${row[2]}" does not match matched minutes ${known.get(row[0])}`);
    }
  }
}

function checkAgenticRows(detail, out) {
  const table = tables(detail).find((t) => ['Task', 'Samples', 'Confidence'].every((h) => t.header.includes(h)));
  if (!table) { out.push('agentic task table not found (need Task, Samples, Confidence headers)'); return; }
  const confIdx = table.header.indexOf('Confidence');
  const samplesIdx = table.header.indexOf('Samples');
  for (const row of table.rows) {
    if (!['HIGH', 'MED', 'LOW', 'UNCALIBRATED'].includes(row[confIdx])) out.push(`task row "${row[0]}": bad confidence cell`);
    if (row[samplesIdx] === '0' && row[confIdx] !== 'UNCALIBRATED') {
      out.push(`task row "${row[0]}": zero samples must render UNCALIBRATED, never a measured confidence`);
    }
  }
}

function checkPlanningPresence(estimation, out) {
  const shapes = estimation.inputs.features.flatMap((f) => f.tasks).map((t) => t.shape);
  if (!shapes.includes('planning')) out.push('agentic decomposition needs >= 1 planning-shaped task (human-side work is work)');
}

export function agenticFindings({ md, estimation }) {
  const out = [];
  checkVagueness(md, out);
  checkEvidence(md, estimation, out);
  checkAgenticRows(heading(md, 'Estimation detail') ?? '', out);
  checkPlanningPresence(estimation, out);
  if (!/Delivery:\s*agentic/.test(md)) out.push('missing "Delivery: agentic" header line');
  return out;
}
