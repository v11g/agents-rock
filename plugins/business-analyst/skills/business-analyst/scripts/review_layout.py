"""Where each box of a workflow diagram sits (spec R10); mirrors
lib/review-layout.mjs. Branches form a tree under each main step; siblings
sit side by side and a parent spans its children."""


def width(kids):
    return sum(width(k['kids']) for k in kids) if kids else 1


def forest(steps, branches):
    placed = set()

    def take(i):
        placed.add(i)
        return {'b': branches[i], 'kids': []}

    def grow(name):
        kids = [take(i) for i, b in enumerate(branches) if b['from'] == name and i not in placed]
        for k in kids:
            k['kids'] = [] if k['b']['back'] else grow(k['b']['to'])
        return kids

    roots = [grow(s) for s in steps]
    for i, b in enumerate(branches):
        if i in placed:
            continue
        n = take(i)
        n['kids'] = [] if b['back'] else grow(b['to'])
        roots[0].append(n)
    return roots


def place(kids, depth, col):
    out = []
    for n in kids:
        span = width(n['kids'])
        out.append({'b': n['b'], 'depth': depth, 'col': col, 'span': span})
        out += place(n['kids'], depth + 1, col)
        col += span
    return out


def layout(steps, branches):
    lanes, boxes, col = [], [], 1
    for name, kids in zip(steps, forest(steps, branches)):
        span = width(kids)
        lanes.append({'name': name, 'col': col, 'span': span})
        boxes += place(kids, 1, col)
        col += span + 1
    return lanes, boxes
