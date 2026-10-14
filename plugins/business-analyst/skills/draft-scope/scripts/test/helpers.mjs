// Runs the draft-scope Python scripts and stages a draft with its sources.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = fileURLToPath(new URL('..', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));

export function py(script, args) {
  try {
    const out = execFileSync('python3', [join(scripts, script), ...args], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? '', err: e.stderr ?? '' };
  }
}

// A temp folder holding draft.json (the pass fixture, changed by mutate) and sources/.
export function stage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'draft-scope-'));
  cpSync(join(fixtures, 'sources'), join(dir, 'sources'), { recursive: true });
  const draft = JSON.parse(readFileSync(join(fixtures, 'draft-pass.json'), 'utf8'));
  if (mutate) mutate(draft);
  writeFileSync(join(dir, 'draft.json'), JSON.stringify(draft, null, 2));
  return dir;
}

export const check = (dir) => py('check.py', ['--draft', join(dir, 'draft.json')]);
