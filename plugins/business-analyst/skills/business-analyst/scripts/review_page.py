"""Draws the read-only review page; mirrors lib/review-page.mjs. Byte-identical
page, kept in lockstep by scripts/test/review-parity.test.mjs."""
import os

from review_data import page_data
from review_layout import layout

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
TAG = '<span class="tag">★ New</span> '


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def src(added):
    return f'<span class="src">Added: {esc(added)}</span>'


def cell(area, cls, html):
    return f'<div class="{cls}" style="grid-area:{area}">{html}</div>'


def area(row, col, span):
    return f'{row}/{col}/auto/span {span}' if span > 1 else f'{row}/{col}'


def wide(cls, span):
    return f'{cls} wide' if span > 1 else cls


def step_cells(lanes):
    out = []
    for i, l in enumerate(lanes):
        if i:
            out.append(cell(f"1/{l['col'] - 1}", 'arrow', '→'))
        out.append(cell(area(1, l['col'], l['span']), wide('step', l['span']), esc(l['name'])))
    return out


def branch_cells(x):
    b, row, col, span = x['b'], 2 * x['depth'], x['col'], x['span']
    label = f'<span class="lbl">{esc(b["label"])}</span>' if b['label'] else ''
    box = (cell(area(row + 1, col, span), 'step back', f'↺ back to {esc(b["to"])}') if b['back']
           else cell(area(row + 1, col, span), wide('step alt', span), esc(b['to'])))
    return [cell(area(row, col, span), 'down', label), box]


def flow_html(w):
    s = w['sub']
    cap = f"{'Sub-workflow' if s else 'Main workflow'} · {esc(w['name'])}"
    if s:
        cap += f" — starts at {esc(s['startsAt'])}"
        cap += f", rejoins {esc(s['rejoins'])}" if s['rejoins'] else ''
        cap += f" · {esc(s['share'])}" if s['share'] else ''
    lanes, boxes = layout(w['steps'], w['branches'])
    branches = [c for x in boxes for c in branch_cells(x)]
    return '\n'.join([f'<p class="flow-name">{cap}</p>', '<div class="flow">', '<div class="grid">',
                      *step_cells(lanes), *branches, '</div>', '</div>'])


def feature_row(f):
    if not f['added']:
        return f"<tr><td>{esc(f['name'])}</td><td>{esc(f['does'])}</td></tr>"
    return f"<tr class=\"new\"><td>{TAG}{esc(f['name'])}{src(f['added'])}</td><td>{esc(f['does'])}</td></tr>"


def system_html(s, i):
    return '\n'.join(['<section>', f"<h2><span class=\"sysno\">System {i + 1}:</span> {esc(s['name'])}</h2>", f"<p>{esc(s['purpose'])}</p>",
                      *(flow_html(w) for w in s['flows']), '<table>', '<tr><th>Feature</th><th>What it does</th></tr>',
                      *(feature_row(f) for f in s['features']), '</table>', '</section>'])


def assumptions_html(items):
    if not items:
        return []
    lis = [f"<li class=\"new\">{TAG}{esc(a['text'])}{src(a['added'])}</li>" if a['added'] else f"<li>{esc(a['text'])}</li>"
           for a in items]
    return ['<section>', '<h2>Assumptions</h2>', '<ul>', *lis, '</ul>', '</section>']


def count(k, word):
    return f"{k} {word}{'' if k == 1 else 's'}"


def summary(d):
    feats = [f for s in d['systems'] for f in s['features']]
    fresh = len([r for r in feats + d['assumptions'] if r['added']])
    parts = [count(len(d['systems']), 'system'), count(len(feats), 'feature'), count(len(d['assumptions']), 'assumption')]
    return ' · '.join(parts) + (f' · {TAG}{fresh} added in interview' if fresh else '')


def body_html(d):
    return '\n'.join(['<header>', f"<h1>{esc(d['title'])}</h1>",
                      f"<p class=\"byline\">Requirements review · {esc(d['date'])} · read-only</p>",
                      f'<p class="summary">{summary(d)}</p>', '</header>',
                      *(system_html(s, i) for i, s in enumerate(d['systems'])), *assumptions_html(d['assumptions'])])


def fill(template, slot, value):
    parts = template.split(slot)
    if len(parts) != 2:
        raise ValueError(f'template slot {slot} must appear once')
    return value.join(parts)


def fill_page(template, title, body):
    return fill(fill(template, '<!--@TITLE@-->', esc(title)), '<!--@BODY@-->', body)


def page_html(pkg, date):
    with open(os.path.join(ASSETS, 'review-page.html'), encoding='utf-8') as f:
        template = f.read()
    d = page_data(pkg, date)
    return fill_page(template, d['title'], body_html(d))
