// What the human changed, and how to fold it back into the draft. A changed
// score gets the guide's sentence for its new value (the anchor is a function
// of factor × score, never free text) and keeps its cite for the agent to
// revisit; any change flips the feature to `stated`.
import { SCORE_FACTORS } from './scoring.mjs';

export function diffScores(draft, edited) {
  const out = [];
  for (const e of edited.features) {
    const d = draft.features.find((f) => f.id === e.id);
    if (!d) continue;
    for (const k of SCORE_FACTORS) {
      if (e.scores[k] !== d.scores[k].n) out.push({ id: e.id, field: k, from: d.scores[k].n, to: e.scores[k] });
    }
    if (e.scoreNote !== undefined && e.scoreNote !== d.scoreNote) out.push({ id: e.id, field: 'scoreNote', from: d.scoreNote, to: e.scoreNote });
    if (e.note) out.push({ id: e.id, field: 'note', to: e.note });
  }
  return out;
}

function applyOne(feature, change, guide) {
  if (change.field === 'note') return feature;
  if (change.field === 'scoreNote') return { ...feature, scoreNote: change.to, scoreProvenance: 'stated' };
  const score = { ...feature.scores[change.field], n: change.to, anchor: guide[change.field][change.to - 1] };
  return { ...feature, scores: { ...feature.scores, [change.field]: score }, scoreProvenance: 'stated' };
}

export function applyDiff({ draft, diff, guide }) {
  return draft.features.map((f) => diff.filter((c) => c.id === f.id).reduce((acc, c) => applyOne(acc, c, guide), f));
}
