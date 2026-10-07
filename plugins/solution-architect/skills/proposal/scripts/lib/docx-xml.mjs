// WordprocessingML pieces for the proposal's DOCX: paragraphs, tables, bullet
// lists and inline images, in the styles docx-package.mjs defines. Pure
// strings, no DOM: Node tests read exactly what the page writes. Like the
// zip writer it ships twice, imported here and inlined into the page.
const TEXT_WIDTH = 9638; // twips: A4 width less two 2 cm margins
const EMU_PER_PX = 9525;
const EMU_PER_TWIP = 635;

// Control characters other than tab/newline are not allowed in XML 1.0.
export const xmlText = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const run = (text, bold) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;

export function para(text, style) {
  if (!text) return '';
  return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${run(text)}</w:p>`;
}

export const bullets = (items) => items.map((t) => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${run(t)}</w:p>`).join('');

function row(cells, head) {
  const cell = (c) => `<w:tc><w:p>${run(c, head)}</w:p></w:tc>`;
  return `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map(cell).join('')}</w:tr>`;
}

export function table(head, rows) {
  const col = Math.floor(TEXT_WIDTH / head.length);
  const grid = head.map(() => `<w:gridCol w:w="${col}"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${row(head, true)}${rows.map((r) => row(r, false)).join('')}</w:tbl><w:p/>`;
}

// One diagram, scaled down to the text width, never up. n is the image's
// 1-based number: its media file, relationship id and drawing id.
export function image(img, n) {
  const scale = Math.min(1, (TEXT_WIDTH * EMU_PER_TWIP) / (img.width * EMU_PER_PX));
  const cx = Math.round(img.width * EMU_PER_PX * scale);
  const cy = Math.round(img.height * EMU_PER_PX * scale);
  const pic = `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="diagram${n}.png"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`;
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Diagram ${n}"/>`
    + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">${pic}</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}
