"""Workflow-scope checks; mirrors lib/scope-rules.mjs + lib/scope-checks.mjs (parity-tested)."""
import re

LABELS = ['confirmed', 'assumed', 'recommended']
SCOPE_MODES = ['workflow', 'classic']
TECH_WORDS = ['API', 'database', 'microservice', 'backend', 'frontend', 'server', 'endpoint', 'schema', 'PWA', 'cloud']
ID_RES = [('systems', re.compile(r'^SYS-\d{3}$')), ('features', re.compile(r'^FEAT-\d{3}$'))]
FIELDS = [('systems', ['name', 'purpose']), ('features', ['name', 'does'])]


def mode_of(pkg):
    return pkg.get('scopeMode') or 'classic'


def to_be(pkg):
    return [w for w in pkg.get('workflows') or [] if w.get('state') == 'to-be']


def scope_ids(pkg):
    return [r.get('id') for r in (pkg.get('systems') or []) + (pkg.get('features') or [])]


def step_index(pkg):
    idx = set()
    for w in to_be(pkg):
        for s in w.get('steps') or []:
            idx.add(f"{w['id']}:{s}")
        for b in w.get('branches') or []:
            idx.add(f"{w['id']}:{b.get('to')}")
    return idx


def check_flows(pkg):
    findings = []
    idx = step_index(pkg)
    flows = [w['id'] for w in to_be(pkg)]
    as_is = [w['id'] for w in pkg.get('workflows') or [] if w.get('state') == 'as-is']
    for w in to_be(pkg):
        for b in w.get('branches') or []:
            if f"{w['id']}:{b.get('from')}" not in idx:
                findings.append(f"{w['id']}: branch from unknown step {b.get('from')}")
        sub = w.get('sub')
        if sub and sub.get('startsAt') not in idx:
            findings.append(f"{w['id']}: sub.startsAt unknown")
        if sub and sub.get('rejoins') not in flows:
            findings.append(f"{w['id']}: sub.rejoins is not a to-be workflow")
        for r in w.get('replaces') or []:
            if r not in as_is:
                findings.append(f"{w['id']}: replaces unknown as-is workflow {r}")
    return findings


def check_feature_steps(pkg):
    findings = []
    idx = step_index(pkg)
    for f in pkg['features']:
        steps = f.get('steps') or []
        if steps == ['*']:
            continue
        if not steps:
            findings.append(f"{f['id']}: needs at least one step")
        findings += [f"{f['id']}: unknown step {s}" for s in steps if s not in idx]
    return findings


def check_feature_frs(pkg, ids):
    findings = []
    covered = set()
    for f in pkg['features']:
        for fr in f.get('requirements') or []:
            covered.add(fr)
            if fr not in ids:
                findings.append(f"{f['id']}: dangling reference {fr}")
    for fr in pkg.get('requirements') or []:
        if fr.get('scope') == 'in' and fr.get('id') not in covered:
            findings.append(f"{fr['id']}: in scope but in no feature")
    return findings


def tech_word(name):
    return next((w for w in TECH_WORDS if re.search(rf'\b{w}s?\b', name or '', re.I)), None)


def check_names(pkg):
    findings = []
    for kind, rows in (('system', pkg['systems']), ('feature', pkg['features'])):
        seen = set()
        for r in rows:
            key = (r.get('name') or '').lower()
            if key in seen:
                findings.append(f"duplicate {kind} name: {r.get('name')}")
            seen.add(key)
            word = tech_word(r.get('name'))
            if word:
                findings.append(f"{r['id']}: name uses a tech word ({word})")
    return findings


def check_scope_labels(pkg):
    findings = []
    asked = {a for q in pkg.get('openQuestions') or [] for a in q.get('affects') or []}
    for r in to_be(pkg) + pkg['systems'] + pkg['features']:
        if not r.get('label'):
            findings.append(f"{r['id']}: missing label")
        elif r['label'] not in LABELS:
            findings.append(f"{r['id']}: illegal label \"{r['label']}\"")
        if not r.get('source'):
            findings.append(f"{r['id']}: missing source")
        if r.get('label') == 'recommended' and r['id'] not in asked:
            findings.append(f"{r['id']}: recommended without a paired open question")
    return findings


def check_shape(pkg):
    if mode_of(pkg) not in SCOPE_MODES:
        return ['scopeMode must be workflow|classic']
    if mode_of(pkg) == 'classic':
        return ['systems/features only in workflow mode'] if 'systems' in pkg or 'features' in pkg else []
    if not pkg.get('systems') or not pkg.get('features'):
        return ['scopeMode workflow needs systems and features']
    findings = []
    for key, rx in ID_RES:
        findings += [f'{key}: bad id {r.get("id")}' for r in pkg[key] if not rx.match(r.get('id') or '')]
    seen = set()
    for rid in scope_ids(pkg):
        if rid in seen:
            findings.append(f'duplicate id: {rid}')
        seen.add(rid)
    return findings


def owners(systems, key):
    own = {}
    for s in systems:
        for rid in s.get(key) or []:
            own.setdefault(rid, []).append(s['id'])
    return own


def ownership(ids, own, verb):
    findings = []
    for rid in ids:
        by = own.get(rid, [])
        if len(by) != 1:
            findings.append(f"{rid}: {verb} {' and '.join(by)}" if by else f'{rid}: {verb} no system')
    return findings


def check_membership(pkg):
    findings = []
    flows = [w['id'] for w in to_be(pkg)]
    feats = [f['id'] for f in pkg['features']]
    for s in pkg['systems']:
        if not s.get('workflows'):
            findings.append(f"{s['id']}: needs a to-be workflow")
        findings += [f"{s['id']}: workflow {w} is not a to-be workflow" for w in s.get('workflows') or [] if w not in flows]
        findings += [f"{s['id']}: dangling reference {f}" for f in s.get('features') or [] if f not in feats]
    return (findings
            + ownership(flows, owners(pkg['systems'], 'workflows'), 'belongs to')
            + ownership(feats, owners(pkg['systems'], 'features'), 'listed by'))


def check_fields(pkg):
    return [f"{r.get('id')}: missing {f}" for key, fields in FIELDS for r in pkg[key] for f in fields if not r.get(f)]


def check_scope(pkg, ids):
    shape = check_shape(pkg)
    if shape or mode_of(pkg) == 'classic':
        return shape
    return (check_fields(pkg) + check_membership(pkg) + check_flows(pkg) + check_feature_steps(pkg)
            + check_feature_frs(pkg, ids) + check_names(pkg) + check_scope_labels(pkg))
