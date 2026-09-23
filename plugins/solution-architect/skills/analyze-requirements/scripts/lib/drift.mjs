import { hashText, sectionHashes } from './state.mjs';

// `locked` is not a hash verdict. decisions.md rules that an accepted ADR is
// superseded by a new record, never rewritten, so its hash is irrelevant.
export function classify(entry, text) {
  // No entry says nothing on its own. A file on disk we never wrote is someone
  // else's; no file at all is one this run is free to create.
  if (!entry) return text === null ? 'new' : 'untracked';
  if (entry.status === 'accepted') return 'locked';
  if (text === null) return 'missing';
  return entry.hash === hashText(text) ? 'unchanged' : 'drifted';
}

export function changedSections(entry, text) {
  const now = sectionHashes(text);
  const before = entry?.sections ?? {};
  const moved = Object.keys(now).filter((n) => before[n] !== now[n]);
  const removed = Object.keys(before).filter((n) => !(n in now));
  return [...moved, ...removed].sort((a, b) => Number(a) - Number(b));
}
