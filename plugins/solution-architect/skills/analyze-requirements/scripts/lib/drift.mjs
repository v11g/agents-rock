import { hashText, sectionHashes } from './state.mjs';

// An ADR's `## Status` section, as decisions.md formats it.
const STATUS = /^##\s+Status\b[^\n]*\n+\s*([A-Za-z][\w-]*)/m;

// The document outranks the record. The usual way an ADR becomes accepted is a
// person editing it after we wrote it `proposed`, so trusting what the last run
// recorded locks only the ADRs that were already accepted when we wrote them —
// the ones nobody needed protecting.
export function docStatus(text) {
  return text?.match(STATUS)?.[1].toLowerCase() ?? null;
}

// `locked` is not a hash verdict. decisions.md rules that an accepted ADR is
// superseded by a new record, never rewritten, so its hash is irrelevant.
export function classify(entry, text) {
  // No entry says nothing on its own. A file on disk we never wrote is someone
  // else's; no file at all is one this run is free to create.
  if (!entry) return text === null ? 'new' : 'untracked';
  if ((docStatus(text) ?? entry.status) === 'accepted') return 'locked';
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
