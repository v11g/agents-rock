// HTML review channel: the agent's draft rendered as one editable table,
// Σ/tier live, the rubric folded underneath, and a feedback block the human
// copies back. Same slots discipline as the estimate page (embed is strict).
import { embed } from '../../../analyze-requirements/scripts/lib/embed.mjs';
import { inlineModule, extractExports } from './inline.mjs';

export function toHtml({ draft, template, guideHtml, mathSrc }) {
  return embed({
    template,
    slots: {
      TITLE: draft.project ?? 'Estimate',
      DATA: JSON.stringify(draft).replaceAll('</script', '<\\/script'),
      GUIDE: guideHtml,
      MATH: inlineModule(extractExports(mathSrc, ['TIER_BREAKS', 'tierFor'])),
    },
  });
}
