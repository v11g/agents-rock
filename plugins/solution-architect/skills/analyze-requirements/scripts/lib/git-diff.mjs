import { execFileSync } from 'node:child_process';

// Returns null rather than throwing: no repo, no git, or no difference all mean
// "no diff available", and the caller falls back to naming changed sections.
function diff(root, range) {
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

// The working tree first. `since` is HEAD as it stood when the state file was
// written — before anyone committed what that run had just written — so
// reaching for it while an uncommitted change exists renders the whole
// regeneration and buries the one line a person has to judge.
export function gitDiff({ root, file, since = null }) {
  const working = diff(root, ['--', file]);
  if (working || !since) return working;
  return diff(root, [since, '--', file]);
}
