// Feature → milestone aggregation for the roadmap. Groups features by their
// milestone label (order of first appearance = delivery order), sums each
// group's scenario task hours, and lets roadmapBands turn shares into bands.
// Returns undefined when no feature carries a milestone — the roadmap is
// optional and its absence must stay a missing key, not an empty array.
import { roadmapBands, round2 } from '../../../shared/lib/estimate-math.mjs';

function milestonesFrom(features, taskHours) {
  const order = [];
  const byName = {};
  for (const f of features) {
    if (!f.milestone) return null;
    if (!byName[f.milestone]) {
      byName[f.milestone] = { name: f.milestone, features: [], hours: 0 };
      order.push(f.milestone);
    }
    byName[f.milestone].features.push(f.id);
    byName[f.milestone].hours += f.tasks.reduce((sum, t) => sum + taskHours[t.id], 0);
  }
  return order.map((name) => byName[name]);
}

export function roadmapFor({ features, taskHours }) {
  const milestones = milestonesFrom(features, taskHours);
  if (!milestones) return undefined;
  return roadmapBands({ milestones }).map((band, i) => ({
    milestone: band.name,
    features: milestones[i].features,
    share: round2(band.share),
  }));
}
