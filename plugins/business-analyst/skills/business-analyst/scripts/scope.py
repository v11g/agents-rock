#!/usr/bin/env python3
"""Python port of scope.mjs: writes the To-be scope section of requirements.md
from requirements.json. Byte-identical output, kept in lockstep by
scripts/test/python-parity.test.mjs."""
import json
import sys

from scope_checks import check_scope, mode_of, scope_ids
from scope_render import apply_scope, check_markers
from validate import collect_ids


def main(argv):
    args = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith('--'):
            args[argv[i][2:]] = argv[i + 1]
            i += 1
        i += 1
    with open(args['json'], encoding='utf-8') as f:
        pkg = json.load(f)
    with open(args['md'], encoding='utf-8') as f:
        md = f.read()
    findings = check_scope(pkg, set(collect_ids(pkg)) | set(scope_ids(pkg))) + check_markers(md)
    if findings:
        print('\n'.join(findings), file=sys.stderr)
        sys.exit(1)
    with open(args['md'], 'w', encoding='utf-8', newline='') as f:
        f.write(apply_scope(md, pkg))
    print(f'scope written ({mode_of(pkg)})')


if __name__ == '__main__':
    main(sys.argv[1:])
