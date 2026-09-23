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
