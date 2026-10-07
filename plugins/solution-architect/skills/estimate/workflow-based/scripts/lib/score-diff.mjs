// What the engineer changed on the page, folded back into the inputs: score
// moves (via the shared diff, anchors re-derived), component link changes,
// and asks for components that do not exist yet.
import { SCORE_FACTORS } from '../../../shared/lib/scoring.mjs';
import { diffScores, applyDiff } from '../../../shared/lib/score-diff.mjs';

const LINK_WHY = 'linked by the engineer in the score review';
const builds = (c) => (c.builds ?? []).map((b) => b.feature);

export function diffLinks(inputs, feedback) {
  const out = [];
  for (const fb of feedback.components ?? []) {
    const c = inputs.components.find((x) => x.id === fb.id);
    if (!c || !Array.isArray(fb.implements)) continue; // partial block: leave the links alone
    const was = builds(c);
    const now = fb.implements;
    for (const f of now) if (!was.includes(f)) out.push({ component: c.id, feature: f, change: 'add' });
    for (const f of was) if (!now.includes(f)) out.push({ component: c.id, feature: f, change: 'remove' });
  }
  return out;
}

export function applyLinks(inputs, linkDiff) {
  return inputs.components.map((c) => {
    const mine = linkDiff.filter((d) => d.component === c.id);
    if (!mine.length) return c;
    const removed = new Set(mine.filter((d) => d.change === 'remove').map((d) => d.feature));
    const kept = (c.builds ?? []).filter((b) => !removed.has(b.feature));
    const added = mine.filter((d) => d.change === 'add').map((d) => ({ feature: d.feature, why: LINK_WHY }));
    return { ...c, builds: [...kept, ...added] };
  });
}

// Every moved score without a reason is a question the agent owes the
// reviewer; the old cite is the evidence the answer argues against.
function unreasoned(inputs, feedback, diff) {
  const given = (c) => feedback.features.find((f) => f.id === c.id)?.reasons?.[c.field];
  return diff.filter((c) => SCORE_FACTORS.includes(c.field) && !given(c))
    .map((c) => ({ ...c, oldCite: inputs.features.find((f) => f.id === c.id).scores[c.field].cite }));
}

export function readFeedback({ inputs, feedback, guide }) {
  const known = new Set(inputs.features.map((f) => f.id));
  // The page sends scoreNote '' when the engineer wrote no note: unchanged, not erased.
  const features = (feedback.features ?? []).filter((f) => known.has(f.id))
    .map(({ scoreNote, ...f }) => (scoreNote ? { ...f, scoreNote } : f));
  const fb = { ...feedback, features };
  const diff = diffScores(inputs, fb);
  const links = diffLinks(inputs, fb);
  return {
    diff, needsReason: unreasoned(inputs, fb, diff), features: applyDiff({ draft: inputs, diff, guide }),
    links, components: applyLinks(inputs, links), asks: fb.addComponent ?? [],
  };
}
