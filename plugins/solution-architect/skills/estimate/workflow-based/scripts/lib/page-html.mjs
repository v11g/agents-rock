// Fills the two estimate templates. Both pages are internal (spec 3 E2): the
// client gets the proposal. Numbers come from estimation.json through
// page-view.mjs; the templates only format them.
import { embed } from '../../../../analyze-requirements/scripts/lib/embed.mjs';
import { inlineModule, extractExports } from '../../../shared/lib/inline.mjs';
import { pageData, systemData, MATH_EXPORTS } from './score-html.mjs';
import { priceView, milestoneView, registerView } from './page-view.mjs';
import { xlsxRows } from './xlsx-rows.mjs';

const json = (v) => JSON.stringify(v).replaceAll('</script', '<\\/script');

function common(est, req) {
  return { currency: est.inputs.currency ?? 'USD', view: priceView(est), milestones: milestoneView(est), register: registerView(est, req) };
}

// The Effort side's task rows: [name, low, expected, high hours, confidence, assumptions].
export function taskTable(est) {
  const out = {};
  for (const c of est.inputs.components) {
    const done = est.computed.components[c.id]?.tasks ?? {};
    if (c.tasks?.length) out[c.id] = c.tasks.map((t) => [t.name, done[t.id].low, done[t.id].e, done[t.id].high, done[t.id].confidence, (t.assumptions ?? []).join('; ')]);
  }
  return out;
}

export function workflowHtml({ est, req, template }) {
  const data = { project: est.inputs.project, mapLabel: req.mapLabel, systems: req.systems.map((s) => systemData(s, req)) };
  return embed({ template, slots: { TITLE: est.inputs.project, DATA: json({ ...common(est, req), data }) } });
}

export function componentsHtml({ est, req, assets }) {
  const page = {
    ...pageData({ inputs: est.inputs, req, guide: assets.guide }), ...common(est, req),
    tasks: taskTable(est),
    xlsx: {
      rows: xlsxRows(est, req), levels: est.inputs.contextLevels, template: assets.xlsxTemplate,
      register: { project: est.inputs.project, ...registerView(est, req) },
    },
  };
  return embed({
    template: assets.template,
    slots: { TITLE: est.inputs.project, DATA: json(page), MATH: inlineModule(extractExports(assets.mathSrc, MATH_EXPORTS)), XLSX: assets.xlsxSrc },
  });
}
