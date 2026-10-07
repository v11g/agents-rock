// The DOCX package around document.xml: content types, relationships, the
// built-in styles the body uses, one bullet list, and the diagram PNGs.
// Standard Word styles only — the team restyles the copy they send.
import { zipStore } from '../../../estimate/shared/lib/zip.mjs';
import { documentXml } from './docx-body.mjs';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml';

const CONTENT_TYPES = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
  + `<Override PartName="/word/document.xml" ContentType="${MAIN}.document.main+xml"/>`
  + `<Override PartName="/word/styles.xml" ContentType="${MAIN}.styles+xml"/>`
  + `<Override PartName="/word/numbering.xml" ContentType="${MAIN}.numbering+xml"/></Types>`;

const ROOT_RELS = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`;

const pStyle = (id, name, props) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>${props}</w:style>`;
const heading = (level, size, color) => pStyle(`Heading${level}`, `heading ${level}`,
  `<w:pPr><w:keepNext/><w:spacing w:before="${level === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr>`);
const BORDER = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="D9DDE3"/>`).join('');

const STYLES = `${XML}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>`
  + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
  + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
  + pStyle('Title', 'Title', '<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr>')
  + pStyle('Subtitle', 'Subtitle', '<w:rPr><w:color w:val="5C6470"/><w:sz w:val="24"/></w:rPr>')
  + heading(1, 32, '0F5C5A') + heading(2, 24, '1A1D21') + heading(3, 22, '5C6470')
  + pStyle('ListParagraph', 'List Paragraph', '<w:pPr><w:ind w:left="720"/></w:pPr>')
  + `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>${BORDER}</w:tblBorders>`
  + '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';

const NUMBERING = `${XML}<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>`
  + '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>'
  + '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

function documentRels(images) {
  const media = images.map((img, i) => (img ? `<Relationship Id="rIdImg${i + 1}" Type="${REL}/image" Target="media/image${i + 1}.png"/>` : '')).join('');
  return `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rIdStyles" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="${REL}/numbering" Target="numbering.xml"/>${media}</Relationships>`;
}

// images: one entry per workflow in page order, { bytes, width, height } or null.
export function buildDocx(view, images) {
  const enc = new TextEncoder();
  const files = new Map([
    ['[Content_Types].xml', CONTENT_TYPES], ['_rels/.rels', ROOT_RELS], ['word/document.xml', documentXml(view, images)],
    ['word/_rels/document.xml.rels', documentRels(images)], ['word/styles.xml', STYLES], ['word/numbering.xml', NUMBERING],
  ].map(([path, xml]) => [path, enc.encode(xml)]));
  images.forEach((img, i) => { if (img) files.set(`word/media/image${i + 1}.png`, img.bytes); });
  return zipStore(files);
}
