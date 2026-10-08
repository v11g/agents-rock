"""Read-only review page data; mirrors lib/review-data.mjs (parity-tested)."""
from scope_checks import to_be
from validate import ID_TOKEN

NEW = 'PO in interview'


def added(r):
    src = r.get('source')
    return src if isinstance(src, str) and src.startswith(NEW) else None


def title(lead):
    return ' '.join(w[:1].upper() + w[1:] for w in lead.split('-'))


def shown_assumptions(pkg):
    return [a for a in pkg.get('assumptions') or [] if a.get('status') != 'resolved']


def flow_data(w, flows):
    steps = w.get('steps') or []
    sub = w.get('sub')
    return {
        'name': w['name'], 'steps': steps,
        'branches': [{'from': b['from'], 'to': b['to'], 'label': b.get('label'), 'back': b['to'] in steps}
                     for b in w.get('branches') or []],
        'sub': {'startsAt': sub['startsAt'][sub['startsAt'].index(':') + 1:],
                'rejoins': (flows.get(sub.get('rejoins')) or {}).get('name'),
                'share': sub.get('share')} if sub else None,
    }


def page_data(pkg, date):
    flows = {w['id']: w for w in pkg.get('workflows') or []}
    feats = {f['id']: f for f in pkg['features']}
    systems = [{
        'name': s['name'], 'purpose': s['purpose'],
        'flows': [flow_data(flows[i], flows) for i in s.get('workflows') or []],
        'features': [{'name': feats[i]['name'], 'does': feats[i]['does'], 'added': added(feats[i])}
                     for i in s.get('features') or []],
    } for s in pkg['systems']]
    assumptions = [{'text': a['text'], 'added': added(a)} for a in shown_assumptions(pkg)]
    return {'title': title(pkg['lead']), 'date': date, 'systems': systems, 'assumptions': assumptions}


def undecided(pkg):
    return [f"{r['id']}: not decided; ask the PO in the interview"
            for r in pkg['systems'] + to_be(pkg) + pkg['features'] if r.get('label') != 'confirmed']


def when(ok, row):
    return [row] if ok else []


def flow_text(w):
    steps = w.get('steps') or []
    rows = [[w['id'], 'name', w.get('name')]] + [[w['id'], 'step', x] for x in steps]
    for b in w.get('branches') or []:
        rows += when(b.get('to') not in steps, [w['id'], 'step', b.get('to')]) + [[w['id'], 'branch label', b.get('label')]]
    return rows + [[w['id'], 'share', (w.get('sub') or {}).get('share')]]


def shown_text(pkg):
    flows = {w['id']: w for w in pkg.get('workflows') or []}
    rows = [row for s in pkg['systems'] for row in ([s['id'], 'name', s.get('name')], [s['id'], 'purpose', s.get('purpose')])]
    rows += [row for s in pkg['systems'] for i in s.get('workflows') or [] for row in flow_text(flows[i])]
    for f in pkg['features']:
        rows += [[f['id'], 'name', f.get('name')], [f['id'], 'does', f.get('does')]] + when(added(f), [f['id'], 'source', f.get('source')])
    for a in shown_assumptions(pkg):
        rows += [[a['id'], 'text', a.get('text')]] + when(added(a), [a['id'], 'source', a.get('source')])
    return rows


def id_leaks(pkg):
    out = []
    for rid, field, text in shown_text(pkg):
        ids = list(dict.fromkeys(ID_TOKEN.findall('' if text is None else str(text))))
        if ids:
            out.append(f"{rid}: {field} names an id ({', '.join(ids)}); the PO page shows it")
    return out
