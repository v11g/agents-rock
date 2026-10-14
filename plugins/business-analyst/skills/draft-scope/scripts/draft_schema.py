"""Shape of draft.json (references/draft-schema.md): required fields, types, ids and kinds."""
import re

SOURCE_ID = re.compile(r'^[ECN][1-9][0-9]*$')
PROBLEM_ID = re.compile(r'^P[1-9][0-9]*$')
KINDS = ('email', 'call', 'note')
FLOW_KINDS = ('main', 'side', 'sub')
REASONS = ('owned-elsewhere', 'later-phase', 'no-detail')

TOP = [('client', str), ('date', str), ('sources', list), ('problems', list),
       ('scope', dict), ('systems', list), ('assumptions', list), ('questions', list)]
SCOPE = [('covered', str), ('exclusions', list)]
ITEMS = {
    'sources': [('id', str), ('kind', str), ('date', str), ('who', str), ('file', str)],
    'problems': [('id', str), ('text', str), ('quotes', list)],
    'systems': [('name', str), ('purpose', str), ('problem', str), ('workflows', list), ('features', list)],
    'assumptions': [('text', str), ('feature', str), ('source', str)],
    'questions': [('text', str), ('why', str), ('assume', str), ('refs', list)],
}
NESTED = {
    'quotes': [('source', str), ('text', str)],
    'workflows': [('kind', str), ('steps', list), ('source', str)],
    'features': [('name', str), ('does', str), ('problem', str), ('source', str)],
    'exclusions': [('text', str), ('reason', str), ('source', str)],
}


def missing(obj, fields, where):
    if not isinstance(obj, dict):
        return [f'{where}: not an object']
    return [f'{where}: {key} missing or not {kind.__name__}'
            for key, kind in fields if not isinstance(obj.get(key), kind)]


def nested_items(draft):
    """(where, item, fields) for every item inside problems, systems and scope."""
    for i, p in enumerate(draft['problems']):
        for j, q in enumerate(p['quotes']):
            yield f'problems[{i}].quotes[{j}]', q, NESTED['quotes']
    for i, s in enumerate(draft['systems']):
        for key in ('workflows', 'features'):
            for j, x in enumerate(s[key]):
                yield f'systems[{i}].{key}[{j}]', x, NESTED[key]
    for j, x in enumerate(draft['scope']['exclusions']):
        yield f'scope.exclusions[{j}]', x, NESTED['exclusions']


def outer_findings(draft):
    out = missing(draft, TOP, 'draft')
    if out:
        return out
    out = missing(draft['scope'], SCOPE, 'scope')
    for name, fields in ITEMS.items():
        for i, item in enumerate(draft[name]):
            out += missing(item, fields, f'{name}[{i}]')
    return out


def id_findings(draft):
    out = []
    for name, pattern in (('sources', SOURCE_ID), ('problems', PROBLEM_ID)):
        ids = [x['id'] for x in draft[name]]
        out += [f'{name}: bad id {i}' for i in ids if not pattern.match(i)]
        out += [f'{name}: duplicate id {i}' for i in sorted(set(ids)) if ids.count(i) > 1]
    return out


def enum_findings(draft):
    out = [f"sources: {s['id']} kind {s['kind']} is not email, call or note"
           for s in draft['sources'] if s['kind'] not in KINDS]
    for i, s in enumerate(draft['systems']):
        out += [f"systems[{i}].workflows[{j}]: kind {w['kind']} is not main, side or sub"
                for j, w in enumerate(s['workflows']) if w['kind'] not in FLOW_KINDS]
    out += [f"scope.exclusions[{j}]: reason {x['reason']} is not owned-elsewhere, later-phase or no-detail"
            for j, x in enumerate(draft['scope']['exclusions']) if x['reason'] not in REASONS]
    return out


def shape_findings(draft):
    out = outer_findings(draft)
    if out:
        return out
    for where, item, fields in nested_items(draft):
        out += missing(item, fields, where)
    if out:
        return out
    return id_findings(draft) + enum_findings(draft)
