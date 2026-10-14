"""document.xml for draft-scope.docx, in the order of the spec's 'Document shape'."""
from docx_flow import flow_xml
from docx_xml import bullets, para, table

NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
SECTION = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" '
           'w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>')
NOTE = ('Drafted from the sources below. It holds only what the client said; '
        'the PO adds value-add features while editing.')
REASONS = {'owned-elsewhere': 'Owned by someone else', 'later-phase': 'Later phase',
           'no-detail': 'No process detail yet'}


def head_xml(d):
    rows = [[s['id'], s['kind'], s['date'], s['who']] for s in d['sources']]
    return (para(f"{d['client']} — Scope draft", 'Title') + para(d['date'], 'Subtitle') + para(NOTE)
            + para('Sources', 'Heading1') + table(['Source', 'Kind', 'Date', 'Who / subject'], rows))


def problems_xml(d):
    out = para('Problems we heard', 'Heading1')
    for p in d['problems']:
        heard = ', '.join(sorted({q['source'] for q in p['quotes']}))
        out += para(f"{p['id']} {p['text']}", 'Heading3')
        out += bullets([f'"{q["text"]}" ({q["source"]})' for q in p['quotes']])
        out += para(f'Heard in: {heard}')
    return out


def scope_xml(scope):
    out = para('Scope', 'Heading1') + para(scope['covered'])
    pillars = scope.get('pillars') or []
    if pillars:
        out += table(['System', 'Client pillar'], [[x['system'], x['pillar']] for x in pillars])
    rows = [[x['text'], REASONS[x['reason']], x['source']] for x in scope['exclusions']]
    return out + para('Exclusions', 'Heading2') + table(['Exclusion', 'Reason', 'From'], rows)


def system_xml(s, n):
    rows = [[f['name'], f['does'], f['source']] for f in s['features']]
    flows = ''.join(flow_xml(w) for w in s['workflows'])
    return (para(f"System {n}: {s['name']}", 'Heading1') + para(s['purpose']) + flows
            + table(['Feature', 'What it does', 'From'], rows))


def closing_xml(d):
    a = [[x['text'], x['feature'], x['source']] for x in d['assumptions']]
    q = [[x['text'], x['why'], x['assume'], ', '.join(x['refs'])] for x in d['questions']]
    return (para('Assumptions', 'Heading1') + table(['Assumption', 'For feature', 'From'], a)
            + para('Questions for the client', 'Heading1')
            + table(['Question', 'Why it matters', 'If no answer, assume', 'About'], q))


def document_xml(d):
    systems = ''.join(system_xml(s, i + 1) for i, s in enumerate(d['systems']))
    body = head_xml(d) + problems_xml(d) + scope_xml(d['scope']) + systems + closing_xml(d)
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            f'<w:document {NS}><w:body>{body}{SECTION}</w:body></w:document>')
