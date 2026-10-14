"""Workflow step lines drawn as boxes: one bordered table cell per step, arrow
cells between (spec D3). A plain table, so Word and Google Docs both draw it
and the PO edits a step by typing in its box."""
from docx_xml import TEXT_WIDTH, para, run

PER_ROW = 5
ARROW_W = 400
STEP_W = (TEXT_WIDTH - ARROW_W * (PER_ROW - 1)) // PER_ROW
LINE = '<w:{0} w:val="single" w:sz="8" w:space="0" w:color="5C6470"/>'
BOX = '<w:tcBorders>' + ''.join(LINE.format(b) for b in ('top', 'left', 'bottom', 'right')) + '</w:tcBorders>'
NO_BORDERS = ('<w:tblBorders>' + ''.join(f'<w:{b} w:val="nil"/>'
              for b in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')) + '</w:tblBorders>')
GAP = ('<w:tr><w:trPr><w:trHeight w:val="120" w:hRule="exact"/></w:trPr>'
       + '<w:tc><w:p/></w:tc>' * (PER_ROW * 2 - 1) + '</w:tr>')
CENTER = '<w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>'


def cell(text, width, box):
    props = f'<w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{BOX if box else ""}<w:vAlign w:val="center"/></w:tcPr>'
    return f'<w:tc>{props}<w:p>{CENTER}{run(text) if text else ""}</w:p></w:tc>'


def flow_row(steps):
    """Up to PER_ROW steps; a short row is padded with empty borderless cells."""
    cells = ''
    for i in range(PER_ROW):
        step = steps[i] if i < len(steps) else ''
        if i:
            cells += cell('→' if step else '', ARROW_W, False)
        cells += cell(step, STEP_W, bool(step))
    return f'<w:tr><w:trPr><w:cantSplit/></w:trPr>{cells}</w:tr>'


def flow_label(w):
    if w['kind'] == 'main':
        return 'Main workflow'
    if w['kind'] == 'side':
        return f"Side path, back to {w['returnsTo']}" if w.get('returnsTo') else 'Side path'
    parts = [f"starts at {w['startsAt']}" if w.get('startsAt') else '',
             f"rejoins at {w['rejoinsAt']}" if w.get('rejoinsAt') else '', w.get('share') or '']
    where = ', '.join(p for p in parts if p)
    name = w.get('name') or 'Sub-workflow'
    return f'{name}: {where}' if where else name


def flow_xml(w):
    widths = [STEP_W] + [ARROW_W, STEP_W] * (PER_ROW - 1)
    grid = ''.join(f'<w:gridCol w:w="{x}"/>' for x in widths)
    rows = GAP.join(flow_row(w['steps'][i:i + PER_ROW]) for i in range(0, len(w['steps']), PER_ROW))
    return (para(flow_label(w), 'Heading3')
            + f'<w:tbl><w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/>{NO_BORDERS}'
            f'<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>{grid}</w:tblGrid>{rows}</w:tbl><w:p/>')
