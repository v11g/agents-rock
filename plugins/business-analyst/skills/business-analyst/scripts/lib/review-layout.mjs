// Where each box of a workflow diagram sits (spec R10). Branches form a tree
// under each main step: a step's children leave that step, a side branch's
// children leave its box, a loop back is a leaf. Siblings sit side by side;
// a parent spans its children. Grid columns are 1-based; main steps are
// separated by one arrow column. Python twin: review_layout.py.

// A node's width is its leaf count, or 1 with no children.
const width = (n) => (n.kids.length ? n.kids.reduce((s, k) => s + width(k), 0) : 1);

// Children keep JSON order; a branch is claimed once, so a cycle or a shared
// `to` never loops or draws a branch twice.
function forest(steps, branches) {
  const placed = new Set();
  const take = (b) => { placed.add(b); return { b, kids: [] }; };
  const grow = (from) => {
    const kids = branches.filter((b) => b.from === from && !placed.has(b)).map(take);
    for (const k of kids) k.kids = k.b.back ? [] : grow(k.b.to);
    return kids;
  };
  const roots = steps.map(grow);
  // A branch no step reaches (a cycle between branch boxes) roots under the first step.
  for (const b of branches) {
    if (placed.has(b)) continue;
    const n = take(b);
    n.kids = b.back ? [] : grow(b.to);
    roots[0].push(n);
  }
  return roots;
}

// Depth d draws its connector in row 2d and its box in row 2d + 1.
function place(kids, depth, col) {
  let c = col;
  return kids.flatMap((n) => {
    const at = { b: n.b, depth, col: c, span: width(n) };
    c += at.span;
    return [at, ...place(n.kids, depth + 1, at.col)];
  });
}

// { lanes: [{ name, col, span }], boxes: [{ b, depth, col, span }] }
export function layout(steps, branches) {
  const lanes = [];
  const boxes = [];
  let col = 1;
  forest(steps, branches).forEach((kids, i) => {
    const span = width({ kids });
    lanes.push({ name: steps[i], col, span });
    boxes.push(...place(kids, 1, col));
    col += span + 1;
  });
  return { lanes, boxes };
}
