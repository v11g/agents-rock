"""The DOCX package around document.xml: content types, relationships, the
built-in styles the body uses, one bullet list. Standard Word styles only."""
import zipfile

XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml'

CONTENT_TYPES = (f'{XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                 '<Default Extension="xml" ContentType="application/xml"/>'
                 f'<Override PartName="/word/document.xml" ContentType="{MAIN}.document.main+xml"/>'
                 f'<Override PartName="/word/styles.xml" ContentType="{MAIN}.styles+xml"/>'
                 f'<Override PartName="/word/numbering.xml" ContentType="{MAIN}.numbering+xml"/></Types>')
ROOT_RELS = (f'{XML}<Relationships xmlns="{PKG_REL}">'
             f'<Relationship Id="rId1" Type="{REL}/officeDocument" Target="word/document.xml"/></Relationships>')
DOC_RELS = (f'{XML}<Relationships xmlns="{PKG_REL}">'
            f'<Relationship Id="rIdStyles" Type="{REL}/styles" Target="styles.xml"/>'
            f'<Relationship Id="rIdNumbering" Type="{REL}/numbering" Target="numbering.xml"/></Relationships>')


def p_style(sid, name, props):
    return (f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{name}"/>'
            f'<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>{props}</w:style>')


def heading(level, size):
    before = 360 if level == 1 else 240
    return p_style(f'Heading{level}', f'heading {level}',
                   f'<w:pPr><w:keepNext/><w:spacing w:before="{before}" w:after="120"/>'
                   f'<w:outlineLvl w:val="{level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="{size}"/></w:rPr>')


BORDER = ''.join(f'<w:{b} w:val="single" w:sz="4" w:space="0" w:color="D9DDE3"/>'
                 for b in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
STYLES = (f'{XML}<w:styles {W}><w:docDefaults><w:rPrDefault><w:rPr>'
          '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>'
          '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
          '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
          + p_style('Title', 'Title', '<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr>')
          + p_style('Subtitle', 'Subtitle', '<w:rPr><w:color w:val="5C6470"/><w:sz w:val="24"/></w:rPr>')
          + heading(1, 32) + heading(2, 24) + heading(3, 22)
          + p_style('ListParagraph', 'List Paragraph', '<w:pPr><w:ind w:left="720"/></w:pPr>')
          + f'<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>{BORDER}</w:tblBorders>'
          '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
          '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>')
NUMBERING = (f'{XML}<w:numbering {W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>'
             '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>'
             '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>'
             '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')


def write_docx(path, document):
    """[Content_Types].xml first, as Word expects; deflate-compressed."""
    parts = [('[Content_Types].xml', CONTENT_TYPES), ('_rels/.rels', ROOT_RELS),
             ('word/document.xml', document), ('word/_rels/document.xml.rels', DOC_RELS),
             ('word/styles.xml', STYLES), ('word/numbering.xml', NUMBERING)]
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, xml in parts:
            z.writestr(name, xml.encode('utf-8'))
