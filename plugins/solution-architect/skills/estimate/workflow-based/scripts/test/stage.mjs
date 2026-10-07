// A computed sin-kowa-mini lead in a temp folder, for render and page tests.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const script = (n) => fileURLToPath(new URL(`../${n}.mjs`, import.meta.url));
const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

export function staged(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-render-'));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  inputs.measurementsPath = fx('measurements.jsonl');
  if (mutate) mutate(inputs);
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  execFileSync('node', [script('compute'), '--inputs', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'estimation.json')]);
  return dir;
}
