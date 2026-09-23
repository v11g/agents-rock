import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';

// Three rules, deliberately. Every extra normalisation rule is a way for a real
// edit to hash as unchanged, and that is the failure nobody sees.
export function normalise(text) {
  const body = text.replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
  return `${body}\n`;
}

export function hashText(text) {
  return `sha256:${createHash('sha256').update(normalise(text)).digest('hex')}`;
}

// Only ARCHITECTURE.md gets these — it is the only file with a spine to cut on.
export function sectionHashes(md) {
  const out = {};
  let key = null;
  let buf = [];
  const flush = () => { if (key) out[key] = hashText(buf.join('\n')); };
  for (const line of md.split('\n')) {
    const heading = line.match(/^##\s+(\d+)\s/);
    if (heading) flush();
    if (heading) { key = heading[1]; buf = []; }
    if (key) buf.push(line);
  }
  flush();
  return out;
}

export function readState(path) {
  if (!existsSync(path)) return { state: null };
  try {
    return { state: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    // Never deleted: a corrupt state file is still the only record of what the
    // last run wrote, and a person may be able to read it even if we cannot.
    return { state: null, error: `unreadable (${err.message}) — treated as a first run` };
  }
}

// Temp then rename, so a crash mid-write leaves the previous revision in place.
// The caller writes this LAST, after every document is on disk.
export function writeState(path, state) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, path);
}
