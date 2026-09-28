// The proposal gate. validate.mjs prints these findings; render.mjs runs
// the same function and refuses to write proposal.html on any finding.
// Figures are recomputed from estimation.json here — proposal-figures.json
// is an authoring aid, never an input, so hand-edited figures cannot pass.
import { parseFrontmatter } from '../../../analyze-requirements/scripts/lib/frontmatter.mjs';
import { checkDoc } from './checks-doc.mjs';
import { checkClient } from './checks-client.mjs';

export function checkProposal({ md, estimation, today = new Date() }) {
  const { data: fm, error } = parseFrontmatter(md);
  if (!fm) return [`frontmatter: ${error}`];
  const out = checkDoc({ fm, md, today });
  // checkClient derives its figures from the estimate itself; an unpriced
  // estimate can't quote a client, but that's a finding, not a crash.
  try {
    checkClient({ md, fm, estimation }, out);
  } catch (e) {
    out.push(`cannot check client-facing figures: ${e.message}`);
  }
  return out;
}
