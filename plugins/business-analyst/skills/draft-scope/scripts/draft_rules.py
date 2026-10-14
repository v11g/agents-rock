"""Rules check.py applies to a well-shaped draft: references, coverage, limits, banned words."""
import re


def source_refs(draft):
    """(where, id) for every field that must name a source."""
    for i, p in enumerate(draft['problems']):
        for j, q in enumerate(p['quotes']):
            yield f'problems[{i}].quotes[{j}]', q['source']
    for j, x in enumerate(draft['scope']['exclusions']):
        yield f'scope.exclusions[{j}]', x['source']
    for i, s in enumerate(draft['systems']):
        for key in ('workflows', 'features'):
            for j, x in enumerate(s[key]):
                yield f'systems[{i}].{key}[{j}]', x['source']
    for i, a in enumerate(draft['assumptions']):
        yield f'assumptions[{i}]', a['source']


def problem_refs(draft):
    """(where, id) for every field that must name a problem."""
    for i, s in enumerate(draft['systems']):
        yield f'systems[{i}]', s['problem']
        for j, f in enumerate(s['features']):
            yield f'systems[{i}].features[{j}]', f['problem']


def ref_findings(draft):
    sources = {s['id'] for s in draft['sources']}
    problems = {p['id'] for p in draft['problems']}
    features = {f['name'] for s in draft['systems'] for f in s['features']}
    out = [f'{w}: unknown source {r}' for w, r in source_refs(draft) if r not in sources]
    out += [f'{w}: unknown problem {r}' for w, r in problem_refs(draft) if r not in problems]
    out += [f"assumptions[{i}]: unknown feature {a['feature']}"
            for i, a in enumerate(draft['assumptions']) if a['feature'] not in features]
    for i, q in enumerate(draft['questions']):
        out += [f'questions[{i}]: unknown ref {r}' for r in q['refs'] if r not in sources | problems]
    return out


MAX_PROBLEMS = 6
MAX_ASSUMPTIONS = 8
BANNED = ['fast', 'quick', 'easy', 'simple', 'user-friendly', 'intuitive', 'flexible', 'robust',
          'seamless', 'efficient', 'optimal', 'appropriate', 'various', 'etc', 'some', 'many',
          'several', 'as needed']
QUOTED = re.compile('|'.join([r'"[^"]*"', r'“[^”]*”', r"(?<!\w)'[^']*'(?!\w)", r'‘[^’]*’']))


def words(text):
    return len([w for w in text.split() if any(c.isalnum() for c in w)])


def coverage_findings(draft):
    hit = {f['problem'] for s in draft['systems'] for f in s['features']}
    hit |= {r for q in draft['questions'] for r in q['refs']}
    return [f"{p['id']}: no feature or client question points at it"
            for p in draft['problems'] if p['id'] not in hit]


def count_findings(draft):
    n, a = len(draft['problems']), len(draft['assumptions'])
    out = [f'problems: {n}, at least 1'] if n < 1 else []
    out += [f"{p['id']}: no quote" for p in draft['problems'] if not p['quotes']]
    out += [f'problems: {n}, at most {MAX_PROBLEMS}'] if n > MAX_PROBLEMS else []
    return out + ([f'assumptions: {a}, at most {MAX_ASSUMPTIONS}'] if a > MAX_ASSUMPTIONS else [])


def limit_findings(draft):
    out = count_findings(draft)
    for i, s in enumerate(draft['systems']):
        for j, w in enumerate(s['workflows']):
            out += [f'systems[{i}].workflows[{j}]: no steps'] if not w['steps'] else []
            out += [f'systems[{i}].workflows[{j}]: step "{st}" has {words(st)} words, at most 5'
                    for st in w['steps'] if not 1 <= words(st) <= 5]
        out += [f"systems[{i}].features[{j}]: name \"{f['name']}\" has {words(f['name'])} words, 2 to 6"
                for j, f in enumerate(s['features']) if not 2 <= words(f['name']) <= 6]
    return out


def text_fields(draft):
    """(where, text) for every field the PO reads that is not a quote."""
    yield 'scope.covered', draft['scope']['covered']
    for i, p in enumerate(draft['problems']):
        yield f'problems[{i}].text', p['text']
    for j, x in enumerate(draft['scope']['exclusions']):
        yield f'scope.exclusions[{j}].text', x['text']
    for i, s in enumerate(draft['systems']):
        yield f'systems[{i}].name', s['name']
        yield f'systems[{i}].purpose', s['purpose']
        for j, f in enumerate(s['features']):
            yield f'systems[{i}].features[{j}].name', f['name']
            yield f'systems[{i}].features[{j}].does', f['does']
    for i, a in enumerate(draft['assumptions']):
        yield f'assumptions[{i}].text', a['text']
    for i, q in enumerate(draft['questions']):
        for key in ('text', 'why', 'assume'):
            yield f'questions[{i}].{key}', q[key]


def word_findings(draft):
    out = []
    for where, text in text_fields(draft):
        plain = QUOTED.sub(' ', text)
        out += [f'{where}: vague word "{w}"' for w in BANNED
                if re.search(rf'(?<![\w-]){re.escape(w)}(?![\w-])', plain, re.IGNORECASE)]
    return out
