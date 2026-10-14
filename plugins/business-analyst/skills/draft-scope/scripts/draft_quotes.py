"""Every problem quote must appear word for word in its source file."""
import difflib
import os
import re

MARKS = str.maketrans({'“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '‑': '-'})
REPLY = re.compile(r'^[ \t]*>+[ \t]?', re.M)
SENTENCE = re.compile(r'(?<=[.!?])\s+|\n+')


def plain(text):
    """Text as the PO reads it: no email reply markers, one kind of quote mark and dash, single spaces."""
    return ' '.join(REPLY.sub('', text).translate(MARKS).split())


def norm(text):
    """What a quote is matched on: plain text, any case, without wrapping quote marks."""
    return plain(text).strip('"\'').casefold()


def read_sources(draft, base):
    """{id: text} for every source file found, plus findings for the missing ones."""
    texts, out = {}, []
    for s in draft['sources']:
        path = os.path.join(base, s['file'])
        if os.path.isfile(path):
            with open(path, encoding='utf-8') as f:
                texts[s['id']] = f.read()
        else:
            out.append(f"sources: {s['id']} file {s['file']} not found")
    return texts, out


def closest(quote, raw):
    sentences = [plain(s) for s in SENTENCE.split(REPLY.sub('', raw)) if s.strip()]
    score = lambda s: difflib.SequenceMatcher(None, norm(quote), s.casefold()).ratio()
    return max(sentences, key=score, default='')


def quote_findings(draft, base):
    texts, out = read_sources(draft, base)
    for i, p in enumerate(draft['problems']):
        for j, q in enumerate(p['quotes']):
            raw = texts.get(q['source'])
            if raw is None or norm(q['text']) in norm(raw):
                continue
            hint = closest(q['text'], raw)
            out.append(f"problems[{i}].quotes[{j}]: not word for word in {q['source']}; closest: \"{hint}\"")
    return out
