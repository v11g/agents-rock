// What survives of the hours model after pricing moved to scores: PERT for
// task sizing, and the milestone shares the roadmap is drawn from. Nothing
// here converts hours to money or to months — price comes from pricing.mjs
// and project-price.mjs, and duration is deliberately not produced at all.

// Kept as a vocabulary, not as math: schema.mjs validates task.category
// against it and the Task Breakdown tab shows it. It no longer discounts
// anything, because nothing converts hours to money.
export const AI_CATEGORIES = {
  boilerplate: { min: 0.5, max: 0.8 },
  logic: { min: 0.2, max: 0.4 },
  novel: { min: 0.0, max: 0.1 },
};

export function pert({ o, m, p }) {
  return { e: (o + 4 * m + p) / 6, sigma: (p - o) / 6 };
}

// Milestone widths as shares of total task hours. Seniority and the
// verification percentage were uniform multipliers and cancelled out of
// these ratios exactly, which is why dropping them moves no boundary.
export function roadmapBands({ milestones }) {
  const total = milestones.reduce((sum, m) => sum + m.hours, 0);
  return milestones.map((m) => ({ name: m.name, share: total > 0 ? m.hours / total : 0 }));
}
