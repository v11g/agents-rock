// The measurements.jsonl data contract — the one module that knows what a
// measurement record looks like. The estimate skill reads through here; the
// future record-task skill will write through here. Append-only by design:
// nothing in this module mutates the file.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const TASK_SHAPES = [
  'scaffold', 'small_implementation', 'cross_file_refactor', 'test_creation',
  'bug_fix', 'configuration', 'api_integration', 'database_change',
  'documentation', 'ui_implementation', 'migration', 'investigation', 'planning',
];

export const DEFAULT_MEASUREMENTS_PATH = '~/.agents-rock/measurements.jsonl';

export function expandHome(path) {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

export function resolveMeasurementsPath(inputs) {
  return expandHome(inputs.measurementsPath ?? DEFAULT_MEASUREMENTS_PATH);
}

// Unknown shapes are warnings, not errors: the taxonomy is extensible and a
// record written under a future shape must not be silently discarded.
export function checkMeasurement(rec) {
  const errors = [];
  const warnings = [];
  for (const key of ['task_shape', 'repository', 'agent', 'model']) {
    if (!(typeof rec[key] === 'string' && rec[key].trim())) errors.push(`${key} must be a non-empty string`);
  }
  if (!(typeof rec.actual_minutes === 'number' && rec.actual_minutes > 0)) {
    errors.push('actual_minutes must be a positive number');
  }
  if (typeof rec.task_shape === 'string' && rec.task_shape.trim() && !TASK_SHAPES.includes(rec.task_shape)) {
    warnings.push(`unknown task_shape "${rec.task_shape}" (kept)`);
  }
  return { errors, warnings };
}

function parseLine(line, lineNo, out) {
  let rec;
  try { rec = JSON.parse(line); } catch { out.warnings.push(`line ${lineNo}: unparseable JSON, skipped`); return; }
  const { errors, warnings } = checkMeasurement(rec);
  if (errors.length) { out.warnings.push(`line ${lineNo}: ${errors.join('; ')} — skipped`); return; }
  out.warnings.push(...warnings.map((w) => `line ${lineNo}: ${w}`));
  out.records.push(rec);
}

// A missing file is the cold-start case, not an error: zero records means
// every estimate renders Uncalibrated, which is the designed behavior.
export function loadMeasurements(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return { records: [], warnings: [] }; }
  const out = { records: [], warnings: [] };
  text.split('\n').forEach((line, i) => { if (line.trim()) parseLine(line, i + 1, out); });
  return out;
}
