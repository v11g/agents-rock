"""To-be scope rendering and md sync; mirrors lib/scope-render.mjs + lib/scope-md.mjs (parity-tested)."""
import re

from scope_checks import mode_of

START = '<!-- scope:start -->'
END = '<!-- scope:end -->'
BLOCK = re.compile(r'<!-- scope:start -->.*?<!-- scope:end -->\n*', re.S)
# The 0.3.x Start-here line is removed from older files on re-run.
HERE = re.compile(r'\n> \*\*Product owner\? Start here:\*\*[^\n]*\n')


def step_of(ref):
    return ref[ref.index(':') + 1:]


def cell(text):
    return str(text).replace('|', '\\|')


def mermaid(w):
    ids = {}

    def nid(n):
        ids.setdefault(n, f'n{len(ids)}')
        return ids[n]
    steps = w.get('steps') or []
    for s in steps:
        nid(s)
    lines = ['flowchart LR']
    lines += [f'  {nid(a)} --> {nid(b)}' for a, b in zip(steps, steps[1:])]
    for b in w.get('branches') or []:
        label = f"|{b['label']}|" if b.get('label') else ''
        lines.append(f"  {nid(b['from'])} -.->{label} {nid(b['to'])}")
    lines += [f'  {i}["{n.replace(chr(34), chr(39))}"]' for n, i in ids.items()]
    return '\n'.join(['```mermaid', *lines, '```'])


def where_cell(f, sys_, flows):
    refs = f.get('steps') or []
    if not refs:
        return '—'
    if refs == ['*']:
        return 'every step'
    groups = {}
    for r in refs:
        groups.setdefault(r[:r.index(':')], []).append(step_of(r))
    return '; '.join(' → '.join(st) + ('' if wid in (sys_.get('workflows') or []) else f" (in {flows[wid]['name']})")
                     for wid, st in groups.items())


def workflow_block(w, main, flows):
    head = f"**{'Main workflow' if main else 'Sub-workflow'}: {w['id']} {w['name']}**"
    if w.get('sub'):
        head += f" — starts at {step_of(w['sub']['startsAt'])}, rejoins {flows[w['sub']['rejoins']]['name']}"
        if w['sub'].get('share'):
            head += f" · {w['sub']['share']}"
    return '\n\n'.join([head, mermaid(w)])


def system_block(s, ctx):
    flows, feats = ctx
    replaced = list(dict.fromkeys(r for wid in s.get('workflows') or [] for r in flows[wid].get('replaces') or []))
    names = ', '.join(f'"{flows[r]["name"]}"' for r in replaced)
    intro = s['purpose'] + (f" Replaces today's {names}." if replaced else '')
    rows = [f"| {f['id']} | {cell(f['name'])} | {cell(f['does'])} | {cell(where_cell(f, s, flows))} | {', '.join(f.get('requirements') or []) or '—'} |"
            for f in (feats[i] for i in s['features'])]
    table = '\n'.join(['| ID | Feature | What it does | Where in the workflow | Requirements |', '| --- | --- | --- | --- | --- |', *rows])
    flows_md = [workflow_block(flows[wid], i == 0, flows) for i, wid in enumerate(s.get('workflows') or [])]
    return '\n\n'.join([f"### {s['id']} {s['name']}", intro, *flows_md, table])


def systems_table(pkg):
    label = pkg.get('mapLabel')
    head = f'| ID | System | Purpose | {cell(label)} |\n| --- | --- | --- | --- |' if label else '| ID | System | Purpose |\n| --- | --- | --- |'
    rows = [f"| {s['id']} | {cell(s['name'])} | {cell(s['purpose'])} |" + (f" {cell(s.get('map') or '—')} |" if label else '') for s in pkg['systems']]
    return '\n'.join([head, *rows])


def render_scope(pkg):
    ctx = ({w['id']: w for w in pkg.get('workflows') or []}, {f['id']: f for f in pkg['features']})
    n = len(pkg['systems'])
    intro = (f"What we propose to build: {'one system' if n == 1 else f'{n} systems'}, "
             'each shown as its workflows and then the features that serve them.')
    return '\n\n'.join([START, '### To-be scope', intro, systems_table(pkg),
                        *(system_block(s, ctx) for s in pkg['systems']), END])


def apply_scope(md, pkg):
    out = HERE.sub('', md, count=1)
    m = BLOCK.search(out)
    out = BLOCK.sub('', out, count=1)
    if mode_of(pkg) == 'classic':
        return out
    part3 = re.search(r'^## Part 3', out, re.M)
    i = m.start() if m else part3.start() if part3 else len(out)
    return f'{out[:i]}{render_scope(pkg)}\n\n{out[i:]}'


def cells(line):
    return [c.strip() for c in re.split(r'(?<!\\)\|', line)[1:-1]]


def check_markers(md):
    s, e = md.count(START), md.count(END)
    ok = s == e and s <= 1 and md.find(START) <= md.find(END)
    return [] if ok else ['md: scope markers unbalanced']


def expected_feature(pkg, fr_id):
    names = [f['name'] for f in pkg['features'] if fr_id in (f.get('requirements') or [])]
    return ', '.join(names) if names else '—'


def check_feature_column(pkg, md):
    lines = md.split('\n')
    header = next((ln for ln in lines if re.match(r'^\| ID \| Requirement \|', ln)), None)
    if not header or cells(header)[-1] != 'Feature':
        return ['md: FR table has no Feature column']
    findings = []
    for line in (ln for ln in lines if re.match(r'^\| FR-\d{3} \|', ln)):
        c = cells(line)
        want = cell(expected_feature(pkg, c[0]))
        if c[-1] != want:
            findings.append(f'md: {c[0]} Feature column says {c[-1]}, json says {want}')
    return findings


def check_scope_md(pkg, md):
    findings = check_markers(md)
    fm = re.search(r'^scopeMode:\s*(\S+)', md, re.M)
    if (fm.group(1) if fm else 'classic') != mode_of(pkg):
        findings.append('md: scopeMode does not match json')
    m = BLOCK.search(md)
    block = m.group(0).rstrip() if m else None
    if mode_of(pkg) == 'classic':
        return findings + ['md: To-be scope only in workflow mode'] if block else findings
    if block != render_scope(pkg):
        findings.append('md: To-be scope is stale — run scope')
    return findings + check_feature_column(pkg, md)
