import { execFileSync } from 'node:child_process';

// Returns null rather than throwing: no repo, no git, or no difference all mean
// "no diff available", and the caller falls back to naming changed sections.
export function gitDiff({ root, file, since = null }) {
  const range = since ? [since, '--', file] : ['--', file];
  try {
    const out = execFileSync('git', ['diff', '--no-color', ...range], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() ? out : null;
  } catch {
    return null;
  }
}
