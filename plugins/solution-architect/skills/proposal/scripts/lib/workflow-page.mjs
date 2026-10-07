// Fills the workflow proposal template: the body and menu rendered in Node,
// the page data for the DOCX, the mermaid bundle, and the DOCX writer (the
// shared zip writer plus the three docx modules, imports stripped).
import { readFileSync } from 'node:fs';
import { embed } from '../../../analyze-requirements/scripts/lib/embed.mjs';
import { buildFontFaces } from '../../../analyze-requirements/scripts/lib/fonts.mjs';
import { escapeHtml } from '../../../analyze-requirements/scripts/lib/md-render.mjs';
import { inlineModule, withZip } from '../../../estimate/shared/lib/inline.mjs';
import { contentHtml, navHtml } from './workflow-html.mjs';

const here = (rel) => new URL(rel, import.meta.url);
const DOCX_MODULES = ['./docx-xml.mjs', './docx-body.mjs', './docx-package.mjs'];
const noImports = (src) => src.replace(/^import [^\n]*\n/gm, '');

export const docxScript = () => withZip(DOCX_MODULES.map((m) => inlineModule(noImports(readFileSync(here(m), 'utf8')))).join('\n'));

// Every "<" escaped: nothing in the data can close or comment out its script tag.
const island = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

export function workflowPage({ view, bundle }) {
  return embed({
    template: readFileSync(here('../../assets/proposal-workflow.html'), 'utf8'),
    slots: {
      TITLE: escapeHtml(`Proposal — ${view.client}`),
      FONTS: buildFontFaces(here('../../../analyze-requirements/assets/fonts/').pathname),
      NAV: navHtml(view), CONTENT: contentHtml(view), DATA: island(view),
      MERMAID_BUNDLE: bundle, DOCX: docxScript(),
    },
  });
}
