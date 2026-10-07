// A computed sin-kowa-mini lead (the estimate's own workflow test lead) plus
// the proposal's sentences, in a temp folder.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { staged } from '../../../estimate/workflow-based/scripts/test/stage.mjs';

export const passInputs = () => JSON.parse(readFileSync(new URL('./fixtures/proposal-inputs-pass.json', import.meta.url), 'utf8'));

export function lead(edit) {
  const dir = staged();
  const inputs = passInputs();
  if (edit) edit(inputs);
  writeFileSync(join(dir, 'proposal-inputs.json'), JSON.stringify(inputs));
  return { dir, estimation: join(dir, 'estimation.json'), inputs: join(dir, 'proposal-inputs.json') };
}
