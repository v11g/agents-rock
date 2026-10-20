// A computed sin-kowa-mini lead in a temp folder, for render and page tests.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// SYS-002 as a PO document that lists features but draws no workflow: the
// system owns none and its features sit on no step (BA 0.4.0 allows it).
export function noFlowsAt(dir) {
  const path = join(dir, 'requirements.json');
  const req = JSON.parse(readFileSync(path, 'utf8'));
  const gone = new Set(['WF-003', 'WF-004']);
  req.workflows = req.workflows.filter((w) => !gone.has(w.id));
  req.systems[1].workflows = [];
  for (const f of req.features.slice(2, 4)) f.steps = [];
  writeFileSync(path, JSON.stringify(req));
}

// The score review page for the fixture lead, as a file URL.
export function reviewPage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-review-'));
  const inputs = JSON.parse(readFileSync(fx('inputs-pass.json'), 'utf8'));
  if (mutate) mutate(inputs);
  writeFileSync(join(dir, 'estimation-inputs.json'), JSON.stringify(inputs));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  execFileSync('node', [script('score-review'), '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  return pathToFileURL(join(dir, 'review.html')).href;
}

// The Component-based estimate page for the fixture lead, as a file URL.
export function componentsPage(mutate) {
  const dir = staged(mutate);
  execFileSync('node', [script('render'), '--inputs', join(dir, 'estimation-inputs.json'), '--json', join(dir, 'estimation.json'), '--out', join(dir, 'dist')]);
  return pathToFileURL(join(dir, 'dist', 'estimate-components.html')).href;
}
