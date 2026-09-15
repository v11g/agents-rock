// The Summary's feature/tier table typed a Tier letter nobody checked. At
// STANDARD/DEEP the letter must be the one the scores produced (copied into
// computed.features by rollup.mjs). QUICK and agentic deliverables are not
// scored and skip this.
import { heading, tables } from './md-tables.mjs';

const scored = (inputs) => inputs.deliveryMode !== 'agentic' && inputs.depth !== 'QUICK';

export function scoringFindings({ md, estimation }) {
  const out = [];
  const { inputs, computed } = estimation;
  if (!scored(inputs)) return out;
  const table = tables(heading(md, 'Summary') ?? '').find((t) => t.header.includes('src') && !t.header.includes('Task'));
  if (!table) return out; // checkScopeRows already reports the missing table
  const tierIdx = table.header.indexOf('Tier');
  if (tierIdx === -1) { out.push('summary scope table needs a Tier column at STANDARD/DEEP depth'); return out; }
  const want = Object.fromEntries(inputs.features.map((f) => [f.name, computed.features[f.id]?.tier]));
  for (const row of table.rows) {
    if (want[row[0]] && row[tierIdx] !== want[row[0]]) {
      out.push(`scope row "${row[0]}": Tier ${row[tierIdx]} does not match scores (${want[row[0]]})`);
    }
  }
  return out;
}
