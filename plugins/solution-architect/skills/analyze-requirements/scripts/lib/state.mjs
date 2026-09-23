import { createHash } from 'node:crypto';

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
