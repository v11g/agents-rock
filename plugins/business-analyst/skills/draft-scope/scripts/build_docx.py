#!/usr/bin/env python3
"""Builds draft-scope.docx from a draft.json that check.py passed.

  python3 build_docx.py --draft <dir>/draft.json --out <dir>/draft-scope.docx

Standard library only. Run check.py first: this script trusts the shape.
"""
import json
import sys

from docx_body import document_xml
from docx_package import write_docx

USAGE = 'usage: build_docx.py --draft <draft.json> --out <draft-scope.docx>'


def parse(argv):
    if len(argv) != 4 or argv[0] != '--draft' or argv[2] != '--out':
        return None
    return argv[1], argv[3]


def main(argv):
    args = parse(argv)
    if args is None:
        print(USAGE, file=sys.stderr)
        return 2
    with open(args[0], encoding='utf-8') as f:
        draft = json.load(f)
    write_docx(args[1], document_xml(draft))
    print(args[1])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
