// document.xml for the proposal: the same page data the HTML prints, in the
// same order, as Word headings, paragraphs, tables and lists. Diagrams are
// the page's drawn workflows as PNGs; a workflow with no image (the drawing
// failed) falls back to its steps written out.
import { para, bullets, table, image } from './docx-xml.mjs';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
  + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
const SECTION = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';

function scopeXml({ scope }) {
  const head = scope.mapLabel ? ['System', scope.mapLabel] : ['System'];
  const rows = scope.systems.map((s) => (scope.mapLabel ? [s.name, s.map] : [s.name]));
  return para('Scope: what this proposal covers', 'Heading1') + para(scope.intro) + table(head, rows) + para(scope.outLine);
}

function systemXml(s, { images, first }) {
  const flows = s.flows.map((f, i) => {
    const img = images[first + i];
    return para(f.label, 'Heading3') + (img ? image(img, first + i + 1) : para(f.steps));
  }).join('');
  return para(`System ${s.no}: ${s.name}`, 'Heading1') + para(s.purpose) + para(s.extra) + flows
    + table(['Feature', 'What it does'], s.features.map((f) => [f.name, f.does]));
}

function closingXml({ milestones, register, cost }) {
  return para('Milestones', 'Heading1') + para(milestones.lead)
    + table(['Milestone', 'Includes', 'What it demonstrates'], milestones.rows.map((m) => [m.title, m.includes, m.demonstrates]))
    + para('Assumptions & exclusions', 'Heading1') + para(register.lead)
    + para('Assumptions', 'Heading2') + bullets(register.assumptions) + para('Exclusions', 'Heading2') + bullets(register.exclusions)
    + para('Cost estimate', 'Heading1') + para(cost.lead)
    + table(['Range', 'If one fixed number is needed'], [[cost.range, cost.single], [cost.rangeNote, cost.singleNote]]);
}

// images[k] belongs to the k-th workflow in page order (null when not drawn).
export function documentXml(view, images) {
  const firsts = view.systems.map((_, i) => view.systems.slice(0, i).reduce((n, s) => n + s.flows.length, 0));
  const body = para(view.title, 'Title') + para(view.byline, 'Subtitle') + scopeXml(view)
    + view.systems.map((s, i) => systemXml(s, { images, first: firsts[i] })).join('') + closingXml(view);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body}${SECTION}</w:body></w:document>`;
}
