// Agentic task shape, shared by classic (tasks on features) and workflow mode
// (tasks on components). Durations and confidence are script-owned: their
// absence from inputs is the structural guarantee the agent never invents them.
import { TASK_SHAPES } from './measurements.mjs';

export const PROVENANCE = ['observed', 'stated', 'researched', 'proposed'];
const AGENTIC_BANNED = ['category', 'confidence', 'o', 'm', 'p'];

export function checkAgenticTask(task, out) {
  if (!TASK_SHAPES.includes(task.shape)) out.push(`task ${task.id}: unknown shape "${task.shape}"`);
  const s = task.seedMinutes ?? {};
  if (!['o', 'm', 'p'].every((k) => typeof s[k] === 'number' && s[k] > 0)) {
    out.push(`task ${task.id}: seedMinutes o, m, p must be positive numbers`);
  } else if (!(s.o <= s.m && s.m <= s.p)) out.push(`task ${task.id}: seedMinutes expected o <= m <= p`);
  if (typeof task.scope !== 'object' || task.scope === null) out.push(`task ${task.id}: scope object is required`);
  for (const key of AGENTIC_BANNED) {
    if (Object.hasOwn(task, key)) out.push(`task ${task.id}: "${key}" is not an agentic input — the script computes it`);
  }
  if (task.model !== undefined && !(typeof task.model === 'string' && task.model.trim())) {
    out.push(`task ${task.id}: model must be a non-empty string`);
  }
  if (!Array.isArray(task.assumptions)) out.push(`task ${task.id}: assumptions array is required`);
  if (!PROVENANCE.includes(task.provenance)) out.push(`task ${task.id}: provenance not in vocabulary`);
}
