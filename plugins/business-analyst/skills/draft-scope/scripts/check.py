#!/usr/bin/env python3
"""Checks draft.json before the docx is built (steps/check.md).

  python3 check.py --draft <dir>/draft.json

Source files are read relative to the draft's folder. Prints `draft clean`
and exits 0, or prints one finding per line on stderr and exits 1.
"""
import json
import os
import sys

from draft_quotes import quote_findings
from draft_rules import coverage_findings, limit_findings, ref_findings, word_findings
from draft_schema import shape_findings

USAGE = 'usage: check.py --draft <draft.json>'
RULES = [ref_findings, coverage_findings, limit_findings, word_findings]


def findings_for(draft, base):
    out = shape_findings(draft)
    if out:
        return out
    for rule in RULES:
        out += rule(draft)
    return out + quote_findings(draft, base)


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def main(argv):
    if len(argv) != 2 or argv[0] != '--draft':
        print(USAGE, file=sys.stderr)
        return 2
    try:
        draft = load(argv[1])
    except (OSError, ValueError) as e:
        print(f'{os.path.basename(argv[1])}: {e}', file=sys.stderr)
        return 1
    out = findings_for(draft, os.path.dirname(os.path.abspath(argv[1])))
    if out:
        print('\n'.join(out), file=sys.stderr)
        return 1
    print('draft clean')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
