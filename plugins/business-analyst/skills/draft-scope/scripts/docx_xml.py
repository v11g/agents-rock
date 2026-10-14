"""WordprocessingML pieces: paragraphs, bullet lists, tables (styles in docx_package.py)."""
import re

TEXT_WIDTH = 9638  # twips: A4 width less two 2 cm margins
CONTROL = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f]')
BULLET = ('<w:pPr><w:pStyle w:val="ListParagraph"/>'
          '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>')


def xml_text(text):
    clean = CONTROL.sub('', str(text))
    return clean.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def run(text, bold=False):
    props = '<w:rPr><w:b/></w:rPr>' if bold else ''
    return f'<w:r>{props}<w:t xml:space="preserve">{xml_text(text)}</w:t></w:r>'


def para(text, style=None):
    if not text:
        return ''
    props = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return f'<w:p>{props}{run(text)}</w:p>'


def bullets(items):
    return ''.join(f'<w:p>{BULLET}{run(t)}</w:p>' for t in items)


def row(cells, head):
    props = '<w:trPr><w:tblHeader/></w:trPr>' if head else ''
    tcs = ''.join(f'<w:tc><w:p>{run(c, head)}</w:p></w:tc>' for c in cells)
    return f'<w:tr>{props}{tcs}</w:tr>'


def table(head, rows):
    """A bordered table, or a 'None.' line when there are no rows."""
    if not rows:
        return para('None.')
    grid = ''.join(f'<w:gridCol w:w="{TEXT_WIDTH // len(head)}"/>' for _ in head)
    body = row(head, True) + ''.join(row(r, False) for r in rows)
    return ('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>'
            f'<w:tblGrid>{grid}</w:tblGrid>{body}</w:tbl><w:p/>')
