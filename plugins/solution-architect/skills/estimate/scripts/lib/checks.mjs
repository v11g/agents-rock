// Deliverable gate: the estimation.md a human reads must actually reflect the
// estimation.json a machine computed. Rules 1-4/9 check structure, 5-6 check
// table rows, 7-8 cross-check the JSON against a fresh recompute.
import { computeEstimation } from './rollup.mjs';
import { loadMeasurements, resolveMeasurementsPath } from './measurements.mjs';
import { agenticFindings } from './agentic-checks.mjs';
import { heading, tables } from './md-tables.mjs';
import { scoringFindings } from './scoring-checks.mjs';

export { heading, tables }; // agentic-checks.mjs imports them from here

const PROVENANCE = ['observed', 'stated', 'researched', 'proposed'];
const CONFIDENCE = ['HIGH', 'MED', 'LOW'];

function checkStructure(md) {
  const out = [];
  const summary = heading(md, 'Summary');
  const detail = heading(md, 'Estimation detail');
  if (summary === null) out.push('missing ## Summary section');
  if (detail === null) out.push('missing ## Estimation detail section');
  if (!/^###?\s*Out of scope\b/im.test(summary ?? '')) out.push('Out of scope heading missing from Summary');
  const assumptionRows = tables(heading(md, 'Assumptions')).flatMap((t) => t.rows);
  if (assumptionRows.length < 1) out.push('assumptions register is empty (### Assumptions needs >= 1 row)');
  if (!/\|.*buffer.*\|/i.test(summary ?? '')) out.push('no buffer line item found in Summary (/buffer/i)');
  const scenarioTable = tables(detail ?? '').find((t) => t.header.includes('Scenario'));
  if (!scenarioTable || scenarioTable.rows.length < 1) out.push('scenario comparison table missing or empty');
  if (!/calibration/i.test(detail ?? '')) out.push('no calibration line found in Estimation detail');
  return out;
}

// Rule 5: the task table, found by its header (not position), row-checked
// for provenance, confidence, non-blank assumptions, and no bare 0.
function checkTaskRows(detail, out) {
  const table = tables(detail).find((t) => ['Task', 'Confidence', 'Assumptions', 'src'].every((h) => t.header.includes(h)));
  if (!table) { out.push('task table not found by header (need Task, Confidence, Assumptions, src)'); return; }
  const srcIdx = table.header.indexOf('src');
  const confIdx = table.header.indexOf('Confidence');
  const assumeIdx = table.header.indexOf('Assumptions');
  for (const row of table.rows) {
    if (row.some((c) => c === '0')) out.push(`task row "${row[0]}": estimate cell is never 0 (use "not estimated")`);
    if (!PROVENANCE.includes(row[srcIdx])) out.push(`task row "${row[0]}": src cell must be one of ${PROVENANCE.join('|')}`);
    if (!CONFIDENCE.includes(row[confIdx])) out.push(`task row "${row[0]}": confidence cell must be HIGH|MED|LOW`);
    if (!row[assumeIdx]) out.push(`task row "${row[0]}": assumptions cell must be non-empty (use literal "none")`);
  }
}

// Rule 6: the Summary's feature/tier table — the only Summary table with a
// src column — every scope row's src must be stated|proposed.
function checkScopeRows(summary, out) {
  const table = tables(summary).find((t) => t.header.includes('src') && !t.header.includes('Task'));
  if (!table) { out.push('summary scope table missing'); return; }
  const idx = table.header.indexOf('src');
  for (const row of table.rows) {
    if (!['stated', 'proposed'].includes(row[idx])) out.push(`scope row "${row[0]}": src must be stated|proposed`);
  }
}

// Roadmap presence must match the inputs: a roadmap nobody asked for is
// invented scope, milestones without a roadmap is a silently dropped
// deliverable. The prose line keeps the bands honest — relative, not dated.
function checkRoadmap(md, estimation, out) {
  const hasMilestones = (estimation.inputs.features ?? []).some((f) => f.milestone);
  const section = heading(md, 'Roadmap');
  if (!hasMilestones) {
    if (section !== null) out.push('### Roadmap present but inputs carry no milestones');
    return;
  }
  if (section === null) { out.push('missing ### Roadmap section (inputs carry milestones)'); return; }
  if (tables(section).flatMap((t) => t.rows).length < 1) out.push('roadmap table is empty');
  if (!/not calendar dates/i.test(section)) {
    out.push('roadmap must state bands are relative months, not calendar dates');
  }
}

// Team-mode task rows require HIGH|MED|LOW confidence; agentic rows carry
// UNCALIBRATED and are checked separately (agentic-checks.mjs), so the two
// modes never run the same row rule against the same table.
function checkRows(md, estimation) {
  const out = [];
  if (estimation.inputs.deliveryMode !== 'agentic') checkTaskRows(heading(md, 'Estimation detail') ?? '', out);
  checkScopeRows(heading(md, 'Summary') ?? '', out);
  return out;
}

// Rules 7-8: the JSON side. A fresh recompute from the same inputs must
// deep-equal the stored computed block (catches hand-edits), and every
// feature's low/hours/high must be strictly ordered (or all equal, for the
// degenerate zero-spread case). Agentic recompute needs the measurements the
// original run used, loaded fresh — never trusted from the stored computed.
function checkNumbers(estimation) {
  const out = [];
  const agentic = estimation.inputs.deliveryMode === 'agentic';
  const measurements = agentic ? loadMeasurements(resolveMeasurementsPath(estimation.inputs)).records : undefined;
  const recomputed = computeEstimation(estimation.inputs, measurements).computed;
  if (JSON.stringify(recomputed) !== JSON.stringify(estimation.computed)) {
    out.push('computed block does not match recomputed totals (hand-edited JSON?)');
  }
  for (const [id, f] of Object.entries(estimation.computed.features)) {
    const zeroSpread = f.low === f.hours && f.hours === f.high && f.hours > 0;
    if (!zeroSpread && !(f.low < f.hours && f.hours < f.high)) {
      out.push(`feature ${id}: expected low < hours < high (got ${f.low}, ${f.hours}, ${f.high})`);
    }
  }
  return out;
}

export function checkDeliverables({ md, estimation }) {
  const out = [...checkStructure(md), ...checkRows(md, estimation), ...checkNumbers(estimation)];
  checkRoadmap(md, estimation, out);
  out.push(...scoringFindings({ md, estimation }));
  if (estimation.inputs.deliveryMode === 'agentic') out.push(...agenticFindings({ md, estimation }));
  return out;
}
