# BA 0.4.0 follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what the PO found testing 0.4.0. Workflow diagrams draw each side branch under its source step. The interview cites input quotes, sets assumption boundaries, keeps the input's own assumptions word for word, asks for approval after the page, and ends with a handoff line.

**Architecture:** Two code-free doc tasks pinned by docs tests, then one renderer task. `review-data` gains a branch column (`at`). `review-page` draws a CSS grid in place of flex rows. The Python twins match byte for byte.

**Tech Stack:** Node ESM scripts and `node:test`; Python 3 twins; static HTML and CSS; headless Chrome browser tests.

**Spec:** `docs/superpowers/specs/2026-10-07-ba-review-page-readonly.md` (R6 amended; R10–R15 added 2026-10-08)

## Global Constraints

- Work in the worktree `.claude/worktrees/ba-review-page`, branch `feat/ba-review-page`. Never merge, never push, never `git stash`. Use `/usr/bin/git`, one command per call.
- Commit messages are Conventional Commits with no AI attribution: no Co-Authored-By, no Claude-Session, no "Generated with".
- `.mjs` gates: at most 200 lines per file, 10 functions per file, 22 lines per function and 3 params. `scripts/test/quality-gates.test.mjs` enforces them. The Python twins are exempt.
- `review.py` writes the same bytes as `review.mjs` (`scripts/test/review-parity.test.mjs`).
- The page stays static: no script, no buttons, no inputs, no ids.
- business-analyst stays 0.4.0 (unreleased).

## Review Focus

1. A branch that leaves another branch's box (a chain) must sit in the same column as that box, one level lower. Pinned in Task 3, Step 1.
2. A cycle between two branch boxes, which the validator allows, must not hang the page build. Pinned in Task 3, Step 1.
3. A branch with no label draws a bare connector with no empty label span. Pinned in Task 3, Step 1.
4. In a real browser, a branch box's centre lines up with its source step's centre. Pinned in Task 3, Step 5.
5. An input assumption that reads like a constraint stays an assumption. This is docs-only, pinned in Task 2. No code can check it, because requirements.json does not hold the input.

---

### Task 1: Interview wording: input quote, boundaries, approval, handoff

**Files:**
- Modify: `plugins/business-analyst/skills/business-analyst/references/interview.md` (§2 rule 2, lines 33-39; §8 step 2)
- Modify: `plugins/business-analyst/skills/business-analyst/references/frameworks.md:34-36`
- Modify: `plugins/business-analyst/skills/business-analyst/SKILL.md` (step 11)
- Test: `plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs`

S below = `plugins/business-analyst/skills/business-analyst`.

- [ ] **Step 1: Write the failing docs tests**

In `S/scripts/test/review-page.test.mjs`, in the test `'docs: interview options name their hint, assume with a boundary, never recommend'`:
- rename it to `'docs: interview options cite an input quote, assume with a boundary, never recommend'`;
- replace `assert.match(t, /no hint in the input/);` with:

```js
  assert.doesNotMatch(t, /no hint in the input|input hint/);
  const f = flat('references/interview.md');
  assert.match(f, /cites its input quote: the file, the place and the exact words, copied, not paraphrased/);
  assert.match(f, /An option with no input quote cites nothing/);
  assert.match(f, /a scale and a limit/);
  assert.match(f, /else the smallest scope still safe to price/);
```

Move the `const flat = …` line up so it sits above this test; it is currently declared further down. Then append these tests at the end of the file:

```js
test('docs: frameworks never leave an asked feature open', () => {
  assert.doesNotMatch(flat('references/frameworks.md'), /becomes an open question/);
  assert.match(flat('references/frameworks.md'), /closes like every asked question/);
});

test('docs: after the page, one approval question; at the end, the handoff line', () => {
  const t = flat('references/interview.md');
  assert.match(t, /"Does the review page read like your document\?"/);
  assert.match(t, /"Approve: go on to requirements\.md and the readiness report"/);
  assert.match(t, /"Change something: say what in Other"/);
  assert.match(flat('SKILL.md'), /send requirements\.md and requirements\.json to the engineering team for the estimate/);
});
```

- [ ] **Step 2: Run them; they fail**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs`
Expected: 3 failures: the renamed options test, the frameworks test, and the approval/handoff test.

- [ ] **Step 3: Edit the docs**

`S/references/interview.md` §2 rule 2: replace

```
   Every option names the input hint it rests on ("docx System 4 says
   dead spots inside the warehouse"), or says "no hint in the input".
```

with

```
   An option that rests on the input cites its input quote: the file,
   the place and the exact words, copied, not paraphrased
   (SinKowaProposal.docx, System 4: "dead spots inside the warehouse").
   An option with no input quote cites nothing; its "Assume" already
   says it is a guess. An assumption's boundary is a scale and a limit
   ("hours offline: under 1"). Take the limit from the input quote first,
   else the usual value for that kind of business, else the smallest
   scope still safe to price; past the limit is a change request.
```

`S/references/interview.md` §8 step 2: replace

```
   Say in one line: check it reads like your document; tell me in chat
   anything to change.
```

with

```
   Then ask one question through the host's question tool: "Does the
   review page read like your document?" Options: "Approve: go on to
   requirements.md and the readiness report" and "Change something: say
   what in Other". Neither is your pick. No question tool → ask it in
   plain text and stop. Approve → step 11.
```

In step 3 of the same section, change `Then go to step 1 again.` to `Then go to step 1 again and ask again.`

`S/references/frameworks.md` lines 35-36: replace

```
(capability). A feature that maps to no WHY becomes an open question, not
a requirement.
```

with

```
(capability). A feature that maps to no WHY is asked about, and closes
like every asked question: an answer, an "Assume …" pick, or out of
scope (interview.md §2b).
```

`S/SKILL.md` step 11: replace

```
    `READY_FOR_ARCHITECTURE`. Workflow mode: end with one line: say
    **review page** any time to see it again.
```

with

```
    `READY_FOR_ARCHITECTURE`. Then one line: send requirements.md and
    requirements.json to the engineering team for the estimate (claude.ai:
    present both files; Claude Code: give their paths). Workflow mode: one
    more line: say **review page** any time to see it again.
```

- [ ] **Step 4: Run the tests; they pass**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs`
Expected: all pass. The Chrome tests may skip when no Chrome is found.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/references/interview.md plugins/business-analyst/skills/business-analyst/references/frameworks.md plugins/business-analyst/skills/business-analyst/SKILL.md plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs docs/superpowers/specs/2026-10-07-ba-review-page-readonly.md docs/superpowers/plans/2026-10-08-ba-review-followups.md
/usr/bin/git commit -m "docs(business-analyst): input quotes, approval question, handoff"
```

### Task 2: Writing rules: copied labels, the input's assumptions stay

**Files:**
- Modify: `S/references/writing.md` (the source paragraph near line 15; the constraint-vs-assumption paragraph near line 43)
- Test: `S/scripts/test/review-page.test.mjs`

- [ ] **Step 1: Write the failing docs test**

Append:

```js
test('docs: branch labels are copied; the input assumptions stay word for word', () => {
  const t = flat('references/writing.md');
  assert.match(t, /A branch `label` is the input's own arrow text, copied; an arrow with no text has no `label`/);
  assert.match(t, /Every assumption the input lists is an ASM row, word for word, in the input's order/);
  assert.match(t, /even when it reads like a constraint/);
  assert.match(t, /leaves the page only when the PO picks to drop it/);
});
```

- [ ] **Step 2: Run it; it fails**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs`
Expected: 1 failure (the new test).

- [ ] **Step 3: Edit writing.md**

After the sentence ending `Write them without ids (`review.mjs page` refuses one).`, add a new paragraph:

```
A branch `label` is the input's own arrow text, copied; an arrow with no
text has no `label`. Never write one.

Every assumption the input lists is an ASM row, word for word, in the
input's order, `source` naming the file and section
(`"SinKowaProposal.docx, Assumptions"`), even when it reads like a
constraint. A vague one is asked in the interview: the PO's answer adds a
new assumption (`PO in interview, <date>`), and the input's row keeps its
words. An input assumption leaves the page only when the PO picks to drop
it (status `resolved`).
```

Change the constraint-vs-assumption paragraph's last sentence from `Never file one as the other.` to `Never file one as the other; the input's own assumptions list is the exception above.`

- [ ] **Step 4: Run the tests; they pass**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/references/writing.md plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs
/usr/bin/git commit -m "docs(business-analyst): keep input assumptions and labels as written"
```

### Task 3: Draw side branches under their source step

**Files:**
- Modify: `S/scripts/lib/review-data.mjs` (`flowData`)
- Modify: `S/scripts/review_data.py` (`flow_data`)
- Modify: `S/scripts/lib/review-page.mjs` (`flowHtml`, remove `why`)
- Modify: `S/scripts/review_page.py` (`flow_html`, remove `why`)
- Modify: `S/assets/review-page.html` (CSS)
- Test: `S/scripts/test/review-page.test.mjs`, `S/scripts/test/review-browser.test.mjs`

**Interfaces:**
- Produces: each `pageData(...).systems[].flows[].branches[]` entry is `{ from, to, label, back, at }`. Here `at` is the 0-based index of the main-row step whose column the branch sits in.

- [ ] **Step 1: Write the failing data tests**

In `review-page.test.mjs`, test `'workflows: steps, side branches, loops back and the sub-flow note'`, add `at` to the expected branches:

```js
      { from: 'Pack', to: 'Short-pack alert', label: "can't fulfil", back: false, at: 1 },
      { from: 'Pack Review', to: 'Pack', label: 'mismatch', back: true, at: 2 }],
```

Append:

```js
const pipeline = (pkg) => pkg.workflows.find((w) => w.name === 'Order pipeline');

test('a branch off a branch sits in its column; a cycle falls back to the first column', () => {
  const pkg = decided();
  pipeline(pkg).branches.push({ from: 'Short-pack alert', to: 'Cancel or substitute' },
    { from: 'Loop B', to: 'Loop A' }, { from: 'Loop A', to: 'Loop B' });
  const at = pageData(pkg, DATE).systems[0].flows[0].branches.map((b) => [b.to, b.at]);
  assert.deepEqual(at.slice(2), [['Cancel or substitute', 1], ['Loop A', 0], ['Loop B', 0]]);
});

test('the diagram: main row, then each branch under its step', () => {
  const pkg = decided();
  pipeline(pkg).branches.push({ from: 'Short-pack alert', to: 'Cancel or substitute' });
  const html = pageHtml(pkg, DATE);
  for (const part of [
    '<div class="grid">',
    '<div class="step" style="grid-area:1/1">Order In</div>',
    '<div class="arrow" style="grid-area:1/2">→</div>',
    '<div class="step" style="grid-area:1/3">Pack</div>',
    '<div class="down" style="grid-area:2/3"><span class="lbl">can\'t fulfil</span></div>',
    '<div class="step alt" style="grid-area:3/3">Short-pack alert</div>',
    '<div class="down" style="grid-area:4/5"><span class="lbl">mismatch</span></div>',
    '<div class="step back" style="grid-area:5/5">↺ back to Pack</div>',
    '<div class="down" style="grid-area:6/3"></div>',
    '<div class="step alt" style="grid-area:7/3">Cancel or substitute</div>',
  ]) assert.ok(html.includes(part), part);
  assert.doesNotMatch(html, /↳|row side|class="row"/);
});
```

In the test `'the page is static html in the shape of the document'`, delete the two expected parts that begin `'<div class="row side">`.

- [ ] **Step 2: Run them; they fail**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/review-page.test.mjs`
Expected: failures in the workflows test (`at` missing), the branch-column test and the diagram test.

- [ ] **Step 3: Implement in Node**

`review-data.mjs`: add above `flowData`

```js
function columnOf(steps, branches) {
  const at = (name, seen) => {
    if (steps.includes(name)) return steps.indexOf(name);
    const up = branches.find((b) => b.to === name && !seen.has(b));
    return up ? at(up.from, new Set([...seen, up])) : 0;
  };
  return (name) => at(name, new Set());
}
```

In `flowData`, build `const col = columnOf(steps, w.branches ?? []);`. Each branch becomes `{ from: b.from, to: b.to, label: b.label ?? null, back: steps.includes(b.to), at: col(b.from) }`.

`review-page.mjs`: delete `why`. Replace the `steps`/`branches` lines of `flowHtml` and its return with:

```js
const cell = (area, cls, html) => `<div class="${cls}" style="grid-area:${area}">${html}</div>`;

function stepCells(steps) {
  return steps.flatMap((x, i) => [...(i ? [cell(`1/${2 * i}`, 'arrow', '→')] : []), cell(`1/${2 * i + 1}`, 'step', esc(x))]);
}

function branchCells(b, k) {
  const [row, col] = [2 * k + 2, 2 * b.at + 1];
  const box = b.back ? cell(`${row + 1}/${col}`, 'step back', `↺ back to ${esc(b.to)}`) : cell(`${row + 1}/${col}`, 'step alt', esc(b.to));
  return [cell(`${row}/${col}`, 'down', b.label ? `<span class="lbl">${esc(b.label)}</span>` : ''), box];
}
```

`flowHtml` returns:

```js
  return [`<div class="flow"><p class="flowcap">${esc(w.name)}${sub}</p>`, '<div class="grid">',
    ...stepCells(w.steps), ...w.branches.flatMap(branchCells), '</div>', '</div>'].join('\n');
```

`stepCells` and `branchCells` are `function` declarations, so check the 10-function gate. If `quality-gates.test.mjs` fails, turn `stepCells` into a `const` arrow.

- [ ] **Step 4: Implement in Python, byte for byte**

`review_data.py`: add

```python
def column_of(steps, branches):
    def at(name, seen):
        if name in steps:
            return steps.index(name)
        up = next((i for i, b in enumerate(branches) if b['to'] == name and i not in seen), None)
        return at(branches[up]['from'], seen | {up}) if up is not None else 0
    return lambda name: at(name, frozenset())
```

In `flow_data`, build `col = column_of(steps, w.get('branches') or [])`. Add `'at': col(b['from'])` to each branch dict.

`review_page.py`: delete `why`; add

```python
def cell(area, cls, html):
    return f'<div class="{cls}" style="grid-area:{area}">{html}</div>'


def step_cells(steps):
    out = []
    for i, x in enumerate(steps):
        if i:
            out.append(cell(f'1/{2 * i}', 'arrow', '→'))
        out.append(cell(f'1/{2 * i + 1}', 'step', esc(x)))
    return out


def branch_cells(b, k):
    row, col = 2 * k + 2, 2 * b['at'] + 1
    label = f'<span class="lbl">{esc(b["label"])}</span>' if b['label'] else ''
    box = (cell(f'{row + 1}/{col}', 'step back', f'↺ back to {esc(b["to"])}') if b['back']
           else cell(f'{row + 1}/{col}', 'step alt', esc(b['to'])))
    return [cell(f'{row}/{col}', 'down', label), box]
```

`flow_html` returns:

```python
    branches = [c for k, b in enumerate(w['branches']) for c in branch_cells(b, k)]
    return '\n'.join([f'<div class="flow"><p class="flowcap">{cap}</p>', '<div class="grid">',
                      *step_cells(w['steps']), *branches, '</div>', '</div>'])
```

- [ ] **Step 5: CSS and browser test**

`S/assets/review-page.html`: delete the `.row`, `.row + .row` and `.side` rules. Add:

```css
.grid { display: grid; grid-auto-columns: max-content; justify-items: center; align-items: center; column-gap: 6px; width: max-content; }
.step.back { border-style: dotted; background: transparent; color: var(--muted); }
.down { position: relative; width: 2px; height: 30px; background: var(--box-line); }
.down::after { content: ""; position: absolute; left: -4px; bottom: -1px; border: 5px solid transparent; border-bottom: 0; border-top-color: var(--box-line); }
.lbl { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); white-space: nowrap; font-size: 12px; color: var(--muted); }
```

Keep `.flow`, `.flowcap`, `.step`, `.step.alt` and `.arrow` as they are.

Append to `review-browser.test.mjs`:

```js
test('a side branch sits under the step it leaves', skip, async () => {
  const page = await open(decided());
  const mid = (t) => `(() => { const e = [...document.querySelectorAll('.step')].find((x) => x.textContent === ${JSON.stringify(t)}); const r = e.getBoundingClientRect(); return r.left + r.width / 2; })()`;
  try {
    assert.ok(Math.abs(await page.eval(mid('Short-pack alert')) - await page.eval(mid('Pack'))) <= 1);
    assert.ok(Math.abs(await page.eval(mid('↺ back to Pack')) - await page.eval(mid('Pack Review'))) <= 1);
  } finally { page.close(); }
});
```

- [ ] **Step 6: Run everything; it passes**

Run: `node --test plugins/business-analyst/skills/business-analyst/scripts/test/*.test.mjs`
Expected: all pass, including `review-parity` (same bytes from Node and Python), `quality-gates` and the browser tests.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add plugins/business-analyst/skills/business-analyst/scripts plugins/business-analyst/skills/business-analyst/assets/review-page.html
/usr/bin/git commit -m "fix(business-analyst): draw side branches under their step"
```

### Task 4: Verify and rebuild the package

- [ ] **Step 1:** Run `npm test` from the worktree root. Expected: pass. The known Chrome flake, "opening a system switches the cards", may fail; re-run that file alone.
- [ ] **Step 2: Smoke test on the PO's file.** Copy `~/Downloads/requirements.json` to the scratchpad. Build the page with `review.mjs page` and with `review.py page`, then `cmp` the two. Expected: both say written; `cmp` prints nothing. Take a headless-Chrome screenshot of the custom-order flow and show it to the user.
- [ ] **Step 3: Evals, one case per command.** Run `ba-review-page`, then `ba-interview-first-turn`, each with `--runs 1 --ablation none --no-publish --trust-plugin --scaffold`. Expected: 1.00 each.
- [ ] **Step 4: Rebuild `.skill`.** Run `git archive HEAD plugins/business-analyst/skills/business-analyst`, then `python3 -m scripts.package_skill` from the skill-creator dir. Output: `~/Downloads/business-analyst-0.4.0.skill`.
- [ ] **Step 5: Stop.** Report the commits, test count, eval scores and screenshot. Do not merge.
