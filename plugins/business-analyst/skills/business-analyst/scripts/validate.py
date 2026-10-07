#!/usr/bin/env python3
"""Python port of validate.mjs for environments without Node (e.g. the
claude.ai sandbox). Same checks, same finding strings, same exit codes —
kept in lockstep by scripts/test/python-parity.test.mjs."""
import json
import math
import re
import sys

from scope_checks import check_scope, mode_of, scope_ids, to_be
from scope_render import check_scope_md

STATUSES = ['DRAFT', 'CLARIFICATION_REQUIRED', 'ANALYZED', 'VALIDATED', 'READY_FOR_ARCHITECTURE']
DEPTHS = ['QUICK', 'STANDARD', 'DEEP']
MODES = ['greenfield', 'existing']
LABELS = ['confirmed', 'assumed', 'recommended']
PRIORITIES = ['P1', 'P2', 'P3']
FR_SCOPES = ['in', 'out', 'future', 'unconfirmed']
AREAS = ['businessContext', 'workflows', 'rules', 'integrations', 'data', 'nfrs']

REGISTERS = [
    ('actors', r'^ACT-\d{3}$'),
    ('workflows', r'^WF-\d{3}$'),
    ('requirements', r'^FR-\d{3}$'),
    ('businessRules', r'^BR-\d{3}$'),
    ('scenarios', r'^SC-\d{3}$'),
    ('nfrs', r'^NFR-\d{3}$'),
    ('integrations', r'^INT-\d{3}$'),
    ('data', r'^DAT-\d{3}$'),
    ('constraints', r'^CON-\d{3}$'),
    ('assumptions', r'^ASM-\d{3}$'),
    ('openQuestions', r'^Q-\d{3}$'),
    ('conflicts', r'^CONFLICT-\d{3}$'),
]

REQUIRED = ['schemaVersion', 'lead', 'status', 'depth', 'updated', 'mode', 'context', 'scope', 'ai', 'readiness']
TOP_ENUMS = [('status', STATUSES), ('depth', DEPTHS), ('mode', MODES)]

ROW_ENUMS = [
    ('requirements', 'label', LABELS),
    ('requirements', 'scope', FR_SCOPES),
    ('nfrs', 'label', LABELS),
    ('integrations', 'label', LABELS),
    ('integrations', 'direction', ['read', 'write', 'both']),
    ('data', 'label', LABELS),
    ('scenarios', 'type', ['happy', 'edge', 'error']),
    ('assumptions', 'impact', ['high', 'medium', 'low']),
    ('assumptions', 'status', ['unconfirmed', 'accepted', 'resolved']),
    ('openQuestions', 'priority', PRIORITIES),
    ('openQuestions', 'status', ['open', 'answered']),
    ('conflicts', 'status', ['open', 'resolved']),
]

LABELED = ['requirements', 'nfrs', 'integrations', 'data']
SOURCED = ['requirements', 'businessRules', 'constraints']

AMBIGUOUS = [
    'fast', 'quick', 'easy', 'simple', 'user-friendly', 'intuitive', 'flexible',
    'robust', 'seamless', 'efficient', 'optimal', 'appropriate', 'various',
    'etc', 'some', 'many', 'several', 'as needed',
]

PARTS = ['Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5']
QUICK_PARTS = ['Part 1', 'Part 3', 'Part 5']
ID_TOKEN = re.compile(r'\b(?:G|ACT|WF|FR|BR|SC|NFR|INT|DAT|CON|ASM|Q|CONFLICT)-\d{3}\b')


def rows(pkg, name):
    return pkg.get(name) or []


def goals(pkg):
    return (pkg.get('context') or {}).get('goals') or []


def check_schema(pkg):
    findings = []
    for f in REQUIRED:
        if f not in pkg:
            findings.append(f'missing required field: {f}')
    for f, legal in TOP_ENUMS:
        if f in pkg and pkg[f] not in legal:
            findings.append(f'illegal {f}: {pkg[f]}')
    for g in goals(pkg):
        if not re.match(r'^G-\d{3}$', g.get('id') or ''):
            findings.append(f"context.goals: bad id {g.get('id')}")
    for name, pattern in REGISTERS:
        for row in rows(pkg, name):
            if not re.match(pattern, row.get('id') or ''):
                findings.append(f"{name}: bad id {row.get('id')}")
    for name, field, legal in ROW_ENUMS:
        for row in rows(pkg, name):
            if field in row and row[field] not in legal:
                findings.append(f'{row.get("id")}: illegal {field} "{row[field]}"')
    return findings


def collect_ids(pkg):
    ordered = {}
    for g in goals(pkg):
        ordered[g.get('id')] = True
    for name, _ in REGISTERS:
        for row in rows(pkg, name):
            ordered[row.get('id')] = True
    return list(ordered)


def check_duplicates(pkg):
    findings, seen = [], set()
    all_rows = list(goals(pkg))
    for name, _ in REGISTERS:
        all_rows.extend(rows(pkg, name))
    for row in all_rows:
        rid = row.get('id')
        if rid in seen:
            findings.append(f'duplicate id: {rid}')
        seen.add(rid)
    return findings


def check_refs(pkg, ids):
    findings = []

    def miss(owner, ref):
        findings.append(f'{owner}: dangling reference {ref}')

    for fr in rows(pkg, 'requirements'):
        t = fr.get('traces') or {}
        refs = [t.get('goal'), t.get('workflow'), *(t.get('rules') or []), *(fr.get('acceptance') or [])]
        for ref in refs:
            if ref and ref not in ids:
                miss(fr.get('id'), ref)
    for br in rows(pkg, 'businessRules'):
        if br.get('openQuestion') and br['openQuestion'] not in ids:
            miss(br.get('id'), br['openQuestion'])
    for sc in rows(pkg, 'scenarios'):
        if sc.get('requirement') not in ids:
            miss(sc.get('id'), sc.get('requirement'))
    for q in rows(pkg, 'openQuestions'):
        for ref in q.get('affects') or []:
            if ref not in ids:
                miss(q.get('id'), ref)
    for ref in (pkg.get('readiness') or {}).get('blockers') or []:
        if ref not in ids:
            miss('readiness.blockers', ref)
    return findings


def check_labels(pkg):
    findings = []
    for name in LABELED:
        for row in rows(pkg, name):
            if not row.get('label'):
                findings.append(f"{row.get('id')}: missing label")
    for name in SOURCED:
        for row in rows(pkg, name):
            if not row.get('source'):
                findings.append(f"{row.get('id')}: missing source")
    for fr in rows(pkg, 'requirements'):
        has_question = any(fr.get('id') in (q.get('affects') or []) for q in rows(pkg, 'openQuestions'))
        if fr.get('label') == 'recommended' and fr.get('scope') == 'in' and not has_question:
            findings.append(f'{fr.get("id")}: recommended requirement in scope "in" without a paired open question')
    return findings


def check_ambiguity(pkg):
    findings = []
    for row in [*rows(pkg, 'requirements'), *rows(pkg, 'nfrs')]:
        for word in AMBIGUOUS:
            pattern = r'\b' + re.sub(r'[-\s]', '[-\\\\s]', word) + r'\b'
            if re.search(pattern, row.get('text') or '', re.IGNORECASE):
                findings.append(f'{row.get("id")}: ambiguous term "{word}" — replace with a measurable statement')
    return findings


def check_readiness(pkg):
    findings = []
    r = pkg.get('readiness') or {}
    areas = r.get('areas') or {}
    values = []
    for a in AREAS:
        v = areas.get(a)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            values.append(v)
    if len(values) != len(AREAS):
        findings.append('readiness.areas: missing area score')
    mean = math.floor(sum(values) / (len(values) or 1) + 0.5)
    if r.get('overall') != mean:
        findings.append(f'readiness.overall {r.get("overall")} != recomputed mean {mean}')
    open_blockers = [q for q in rows(pkg, 'openQuestions') if q.get('status') == 'open' and q.get('architectureBlocker')]
    status_idx = STATUSES.index(pkg.get('status')) if pkg.get('status') in STATUSES else -1
    if open_blockers and status_idx > STATUSES.index('ANALYZED'):
        joined = ', '.join(q.get('id') for q in open_blockers)
        findings.append(f'status {pkg.get("status")} with open architecture blockers: {joined}')
    for q in open_blockers:
        if q.get('id') not in (r.get('blockers') or []):
            findings.append(f'readiness.blockers missing {q.get("id")}')
    risky = [a for a in rows(pkg, 'assumptions') if a.get('impact') == 'high' and a.get('status') == 'unconfirmed']
    if pkg.get('status') == 'READY_FOR_ARCHITECTURE' and risky:
        joined = ', '.join(a.get('id') for a in risky)
        findings.append(f'READY_FOR_ARCHITECTURE with unconfirmed high-impact assumptions: {joined}')
    if pkg.get('status') == 'READY_FOR_ARCHITECTURE' and any(c.get('status') == 'open' for c in rows(pkg, 'conflicts')):
        findings.append('READY_FOR_ARCHITECTURE with open conflicts')
    return findings


def section_bodies(md):
    bodies = {}
    for chunk in re.split(r'^## ', md, flags=re.MULTILINE)[1:]:
        nl = chunk.find('\n')
        title = chunk.strip() if nl == -1 else chunk[:nl].strip()
        bodies[title] = '' if nl == -1 else chunk[nl + 1:]
    return bodies


def frontmatter(md, field, pattern=r'(\S+)'):
    m = re.search(r'^' + field + r':\s*' + pattern, md, re.MULTILINE)
    return m.group(1) if m else None


def check_md(pkg, md):
    findings = []
    if re.search(r'\[TODO\]|\bTBD\b|\bXXX\b', md):
        findings.append('md: placeholder found ([TODO]/TBD/XXX)')
    bodies = section_bodies(md)
    required = QUICK_PARTS if pkg.get('depth') == 'QUICK' else PARTS
    for part in required:
        key = next((h for h in bodies if h.startswith(part)), None)
        if key is None:
            findings.append(f'md: missing section "## {part}"')
        elif not bodies[key].strip():
            findings.append(f'md: empty section "## {part}"')
    md_ids = {m.group(0) for m in ID_TOKEN.finditer(md)}
    named = {w['id'] for w in to_be(pkg)} if mode_of(pkg) == 'workflow' else set()
    for rid in collect_ids(pkg):
        if rid not in named and rid not in md_ids:
            findings.append(f'md: id {rid} absent from requirements.md')
    fm_status = frontmatter(md, 'status')
    if fm_status != pkg.get('status'):
        findings.append(f'md frontmatter status {fm_status} != json status {pkg.get("status")}')
    fm_depth = frontmatter(md, 'depth')
    if fm_depth != pkg.get('depth'):
        findings.append(f'md frontmatter depth {fm_depth} != json depth {pkg.get("depth")}')
    fm_readiness = frontmatter(md, 'readiness', r'(\d+)')
    overall = (pkg.get('readiness') or {}).get('overall')
    if (None if fm_readiness is None else int(fm_readiness)) != overall:
        shown = 'NaN' if fm_readiness is None else int(fm_readiness)
        findings.append(f'md frontmatter readiness {shown} != json readiness.overall {overall}')
    return findings


def check_md_orphan_ids(_pkg, md, ids):
    return [f'md: unknown id {m.group(0)}' for m in ID_TOKEN.finditer(md) if m.group(0) not in ids]


def check_package(pkg, md):
    schema_findings = check_schema(pkg)
    if schema_findings:
        return schema_findings
    ids = set(collect_ids(pkg)) | set(scope_ids(pkg))
    scope = check_scope(pkg, ids)
    return [
        *check_duplicates(pkg),
        *check_refs(pkg, ids),
        *check_labels(pkg),
        *check_ambiguity(pkg),
        *check_readiness(pkg),
        *check_md(pkg, md),
        *check_md_orphan_ids(None, md, ids),
        *scope,
        *([] if scope else check_scope_md(pkg, md)),
    ]


def main(argv):
    args = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith('--'):
            args[argv[i][2:]] = argv[i + 1]
            i += 1
        i += 1
    with open(args['md'], encoding='utf-8') as f:
        md = f.read()
    with open(args['json'], encoding='utf-8') as f:
        pkg = json.load(f)
    findings = check_package(pkg, md)
    if findings:
        print('\n'.join(findings), file=sys.stderr)
        sys.exit(1)
    print('requirements package valid')


if __name__ == '__main__':
    main(sys.argv[1:])
