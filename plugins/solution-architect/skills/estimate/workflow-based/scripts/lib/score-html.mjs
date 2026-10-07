// Fills the score-review template: the BA package becomes the page's systems
// and features, the component roster its Built-by lists, the inputs its
// scores. Same slots discipline as the classic page (embed is strict).
import { createHash } from 'node:crypto';
import { embed } from '../../../../analyze-requirements/scripts/lib/embed.mjs';
import { inlineModule, extractExports } from '../../../shared/lib/inline.mjs';
import { SCORE_FACTORS } from '../../../shared/lib/scoring.mjs';

const flow = (w) => ({ id: w.id, name: w.name, steps: w.steps ?? [], branches: w.branches ?? [] });

function systemData(s, req) {
  const [main, ...subs] = (s.workflows ?? []).map((id) => flow(req.workflows[id]));
  const features = (s.features ?? []).map((id) => {
    const f = req.features[id];
    return { id, name: f.name, steps: f.steps ?? [], does: f.does ?? '' };
  });
  return { id: s.id, name: s.name, main: main ?? null, subs, features };
}

// Saved browser state is keyed to this, so stale edits never outlive a rebuild.
const fingerprint = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);

const isParent = (c, components) => components.some((x) => x.parent === c.id);

export function pageData({ inputs, req, guide }) {
  const comps = inputs.components.filter((c) => !isParent(c, inputs.components));
  const nameOf = Object.fromEntries(inputs.components.map((c) => [c.id, c.name]));
  const implementsMap = Object.fromEntries(comps.map((c) => [c.id, (c.builds ?? []).map((b) => b.feature)]));
  const scores = Object.fromEntries(inputs.features.map((f) => [f.id, SCORE_FACTORS.map((k) => f.scores[k].n)]));
  return {
    data: { project: inputs.project, mapLabel: req.mapLabel, systems: req.systems.map((s) => systemData(s, req)) },
    eng: comps.map((c) => ({
      id: c.id, name: c.name, container: c.parent ? nameOf[c.parent] : c.name, milestone: c.milestone ?? '', does: c.notEstimated ?? '',
    })),
    implements: implementsMap, scores, anchor: guide, baseline: fingerprint([scores, implementsMap]),
  };
}

export function toHtml({ inputs, req, guide, template, mathSrc }) {
  return embed({
    template,
    slots: {
      TITLE: inputs.project,
      DATA: JSON.stringify(pageData({ inputs, req, guide })).replaceAll('</script', '<\\/script'),
      MATH: inlineModule(extractExports(mathSrc, ['WEIGHTS', 'BANDS', 'MODEL_PARAMS', 'weightedScore', 'bandFor', 'pointEstimate', 'spreadFor', 'featurePrice'])),
    },
  });
}
