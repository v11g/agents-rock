#!/usr/bin/env python3
"""Python port of review.mjs: the read-only PO review page.

  python3 review.py page --json requirements.json --out review.html [--date YYYY-MM-DD]
"""
import datetime
import json
import sys

from review_data import id_leaks, undecided
from review_page import page_html
from scope_checks import check_scope, mode_of, scope_ids
from validate import collect_ids

USAGE = 'usage: review.mjs page --json <requirements.json> --out <review.html> [--date YYYY-MM-DD]'


def fail(findings):
    print('\n'.join(findings), file=sys.stderr)
    sys.exit(1)


def parse_args(argv):
    args, i = {}, 0
    while i < len(argv):
        if argv[i].startswith('--'):
            value = argv[i + 1] if i + 1 < len(argv) else None
            if value is None or value.startswith('--'):
                fail([f'{argv[i]}: needs a value'])
            args[argv[i][2:]] = value
            i += 1
        i += 1
    return args


def page(pkg, args):
    if mode_of(pkg) == 'classic':
        print('classic mode: no review page')
        return
    checks = [lambda: check_scope(pkg, set(collect_ids(pkg)) | set(scope_ids(pkg))),
              lambda: undecided(pkg), lambda: id_leaks(pkg)]
    for check in checks:
        findings = check()
        if findings:
            fail(findings)
    with open(args['out'], 'w', encoding='utf-8', newline='') as f:
        f.write(page_html(pkg, args.get('date') or datetime.date.today().isoformat()))
    print(f"review page written: {args['out']}")


def main(argv):
    cmd, args = (argv[0] if argv else None), parse_args(argv[1:])
    if cmd != 'page':
        fail([USAGE])
    with open(args['json'], encoding='utf-8') as f:
        page(json.load(f), args)


if __name__ == '__main__':
    main(sys.argv[1:])
