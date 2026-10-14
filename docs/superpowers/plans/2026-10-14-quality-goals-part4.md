# Document-Scoped Anchors + Quoted Values in Proposed Rows (Part 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- In the viewer, every heading id outside ARCHITECTURE.md carries its document's name (`interview-log__q3`, `0007-cache__context`). Ids are therefore unique across the set by construction, and a `#heading` link always lands in the right document.
- Separately, a value quoted from a client file keeps its `stated` citation even when it sits inside a `proposed` row.

**Architecture:**
- **Renderer.** Today h2/h3 ids share one dedupe registry across the whole set, so the second `## Context` becomes `context-2`. After this change, each document dedupes only its own headings, and every document except the spine prefixes its ids with its file slug plus `__`. `slugify` never emits `_`, so a prefixed id can never equal a bare one.
- **Link rewriter.** `doc-links.mjs` already maps `<path>#<own-doc slug>` to the minted id (Part 3, D17). It now applies the same lookup to same-page `#x` links.
- **Smaller fixes.** The link validator stops counting headings inside code fences. The viewer's drawer scrolls to a heading inside a record.
- **Part B.** A writing rule only.

**Tech Stack:** Node ≥ 20 ESM, `node:test`, the existing CDP browser harness (`scripts/lib/cdp.mjs`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md`.
- This plan adds D18 (document-scoped anchors, which amends D17's example), D19 (validator skips fences), D20 (drawer lands on the heading) and D21 (a quoted value inside a proposed row).
- The user decided on 2026-10-14: "use id for anchor to avoid duplication", then "Do A, C then B".

## Global Constraints

- **Where it lands.** On `feat/quality-goals-citations` in worktree `.claude/worktrees/quality-goals-part2`, on top of `5bb5924`.
- **No release steps.** Do not merge, do not push, and do not bump the version. 3.2.0 is unreleased.
- Node ≥ 20; no new npm dependencies.
- **Quality gates** (`scripts/test/quality-gates.test.mjs`): ≤ 20 lines per function, ≤ 3 params, nesting ≤ 2, ≤ 200 lines and ≤ 10 functions per file.
- TDD for code: every new test runs and fails before its code exists.
- **Commits:** Conventional Commits, subject ≤ 50 chars, no AI attribution trailers.
- **Id format:**
  - spine (ARCHITECTURE.md, index 0): bare `<slug>`.
  - every other document: `<fileSlug>__<slug>`, where `fileSlug` is the filename without extension through `slugOf`. When two documents share a file slug, the prefix is deduped with `nextSlug` (`readme`, `readme-2`).
  - Dedupe (`-2`, `-3`) is per document.
- `npm test` passes at the end of every task. Known flake: `estimate/workflow-based/scripts/test/browser.test.mjs` "opening a system switches the cards" can fail in a full run. If it is the only failure, re-run that file alone and report both runs.

## Review Focus

1. **The same heading in two documents.** ARCHITECTURE.md `### Q3` must stay `q3`, and the log's must become `interview-log__q3`. A link to `interview-log.md#q3` must land on the log's heading. Pinned in Task 1 (render test).
2. **The same heading twice in one document.** `## Context` twice in ADR 0007 gives `0007-cache__context` and `0007-cache__context-2`, and `#context-2` written inside that ADR resolves to the second one. Pinned in Task 1 (md-render + doc-links tests).
3. **A same-page `#x` that is no heading** (a view panel id such as `#panel-containers`, or `#doc-…`). It must stay untouched. Pinned in Task 1 (doc-links test); the existing browser test "a link to a view panel opens that tab" keeps covering it.
4. **Two documents with the same file name** in different folders. Their prefixes must differ. Pinned in Task 1 (render test).
5. **A deep link straight to a record heading** (`#0009-long__decision` typed in the address bar) and a click on the same link. Both open the drawer at that heading. Pinned in Task 3 (browser test).

---

### Task 1: Document-scoped heading ids

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/md-render.mjs` (signature line 12; `renderHeading` lines 43–62; new helper `headingId`)
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/doc-links.mjs`
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/doc-routes.mjs` (export `fileSlug`)
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs` (imports; lines 73–82)
- Modify: `plugins/solution-architect/skills/analyze-requirements/references/viewer.md` (link-rule table and the paragraph after it, ~lines 170–181)
- Modify: `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` (D18 row after D17; Viewer bullet)
- Test: `scripts/test/md-render.test.mjs`, `scripts/test/doc-links.test.mjs`, `scripts/test/render.test.mjs`

**Interfaces:**
- Produces:
  - `renderMarkdown(md, { slugs = new Map(), docSlugs = new Map(), prefix = '' } = {})`. The second parameter becomes an options object. Each entry in `headings` gains `local`, the own-document slug: `{ level, text, slug, local }`.
  - `fileSlug(path)`, now exported from `doc-routes.mjs`.
  - `anchorIds({ path, headings })` returns `[`${path}#${h.local}`, h.slug]` and no longer calls `nextSlug`.
  - `rewriteDocLinks(html, fromPath, idByPath)` keeps its signature. A same-page `#x` is now looked up as `fromPath + '#x'`.

- [ ] **Step 1: Failing md-render tests.**
  - In `md-render.test.mjs`, change the two existing multi-argument calls to the options form, leaving their assertions unchanged:
    - test "keeps heading ids unique across docs sharing a slug registry": `renderMarkdown('## Considered Options', { slugs: seen })` (both calls).
    - test "doc ids use their own namespace…": `renderMarkdown('# Related\n\n## Related', { slugs, docSlugs })` (both calls).
  - Append:

```js
test('a prefix scopes heading ids to their document', () => {
  const { html, headings } = renderMarkdown('## Context\n\n## Context', { prefix: '0007-cache' });
  assert.match(html, /<h2 id="0007-cache__context">Context<\/h2>/);
  assert.deepEqual(headings.map((h) => [h.slug, h.local]), [
    ['0007-cache__context', 'context'],
    ['0007-cache__context-2', 'context-2'],
  ]);
});

test('without a prefix a heading id is its bare slug', () => {
  const { headings } = renderMarkdown('## Core Components');
  assert.deepEqual(headings.map((h) => [h.slug, h.local]), [['core-components', 'core-components']]);
});
```

- [ ] **Step 2: Failing doc-links tests.** In `doc-links.test.mjs`, replace the body of the test `'anchorIds maps each heading\'s own-document slug to its minted id'` with the following (the title stays):

```js
  const page = { path: '/repo/log.md', headings: [
    { level: 3, text: 'Q3', slug: 'log__q3', local: 'q3' },
    { level: 3, text: 'Q3', slug: 'log__q3-2', local: 'q3-2' },
  ] };
  assert.deepEqual(anchorIds(page), [
    ['/repo/log.md#q3', 'log__q3'],
    ['/repo/log.md#q3-2', 'log__q3-2'],
  ]);
```

Rename the existing test `'a fragment on a document link is dropped rather than guessed at'` to `'an unknown fragment on a document link falls back to the document'`, leaving its body unchanged. Then append:

```js
// Inside an ADR, #context means this ADR's Context, not the spine's.
test('a same-page anchor resolves against its own document', () => {
  const map = new Map([['/repo/docs/adr/0007.md#context', '0007__context']]);
  const html = rewriteDocLinks('<a href="#context">C</a>', '/repo/docs/adr/0007.md', map);
  assert.match(html, /<a href="#0007__context">C<\/a>/);
});

// View panels, doc heads and anything else that is not an h2/h3 keep their id.
test('a same-page anchor that names no heading is left alone', () => {
  const html = rewriteDocLinks('<a href="#panel-containers">V</a>', '/repo/ARCHITECTURE.md', new Map());
  assert.equal(html, '<a href="#panel-containers">V</a>');
});
```

- [ ] **Step 3: Failing render test.** In `render.test.mjs`, the Part 3 test `'a citation to an interview answer jumps to that answer, even when its id was deduped'`:
  - Rename it to `'a citation to an interview answer jumps to that answer, not the spine heading of the same name'`.
  - Replace its two assertions with:

```js
  assert.match(html, /<h3 id="q3">Q3<\/h3>/);
  assert.match(html, /<h3 id="interview-log__q3">Q3<\/h3>/);
  assert.match(html, /<a href="#interview-log__q3">Q3 · 2026-10-14<\/a>/);
```

Append a test that two documents with the same file name get different prefixes. It uses the same harness as that test (copy the fixture, stub the bundles):

```js
test('two documents with the same file name get different id prefixes', () => {
  const root = mkdtempSync(join(tmpdir(), 'render-prefix-'));
  cpSync(fixtures, root, { recursive: true });
  for (const d of ['a', 'b']) {
    mkdirSync(join(root, d));
    writeFileSync(join(root, d, 'notes.md'), `# Notes ${d}\n\n## Context\n`);
  }
  const out = mkdtempSync(join(tmpdir(), 'render-prefix-out-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', root, '--arch', join(root, 'ARCHITECTURE.md'),
    '--docs', join(root, 'a', 'notes.md'), join(root, 'b', 'notes.md'), '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<h2 id="notes__context">/);
  assert.match(html, /<h2 id="notes-2__context">/);
});
```

Add `mkdirSync` to the file's `node:fs` import. If `--docs` takes one path per flag rather than a list, read `consumeDocs` in render.mjs and adapt the argv, never the assertions.

- [ ] **Step 4: Run to verify they fail.**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/md-render.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/doc-links.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/render.test.mjs`

Expected: FAIL. There is no prefix and no `local`; same-page links are untouched; the render ids are `q3-2` and `context-2`.

- [ ] **Step 5: Implement `md-render.mjs`.**
  - Replace the signature line and its `ctx` fields:

```js
// `slugs` dedupes h2/h3 within one document; `prefix` names that document, so an
// id is unique across the whole set by construction (0007-cache__context). The
// separator is `__` because slugify never emits `_`, so a prefixed id cannot
// collide with a bare one.
export function renderMarkdown(md, { slugs = new Map(), docSlugs = new Map(), prefix = '' } = {}) {
  const ctx = {
    lines: md.replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n'),
    i: 0, html: [], headings: [], slugs, docSlugs, prefix, title: null, docId: null,
  };
```

  - In `renderHeading`, replace the last three lines (from `const slug = nextSlug(text, ctx.slugs);` through `ctx.headings.push(...)`) with:

```js
  const { slug, local } = headingId(ctx, text);
  ctx.html.push(`<h${level} id="${slug}">${inline(text)}</h${level}>`);
  ctx.headings.push({ level, text, slug, local });
```

  - Add after `renderHeading`:

```js
// `local` is what an author writes after `#` inside the document and what the
// link validator knows; `slug` is the id the page carries.
function headingId(ctx, text) {
  const local = nextSlug(text, ctx.slugs);
  return { local, slug: ctx.prefix ? `${ctx.prefix}__${local}` : local };
}
```

- [ ] **Step 6: Implement `doc-links.mjs`.**
  - Remove the `nextSlug` import.
  - Replace the comment above `rewriteDocLinks`, the function itself and `anchorIds` with:

```js
// idByPath maps a document's absolute path to its id, and `<path>#<slug>` to the
// id that heading carries (prefixed by its document, D18). Authors write a
// fragment against the target's own headings (#q3) — or, with no path, against
// their own — so the fragment is looked up, never trusted.
export function rewriteDocLinks(html, fromPath, idByPath) {
  const dir = dirname(fromPath);
  return html.replace(HREF, (whole, path, fragment, label) => {
    // A scheme or // means it leaves the page.
    if (ABSOLUTE.test(path)) return whole;
    // No path: a heading in this same document; anything else keeps its id.
    if (!path) return linkTo(idByPath.get(fromPath + fragment), label) ?? whole;
    const target = resolve(dir, path);
    const id = idByPath.get(target);
    if (id) return linkTo(idByPath.get(target + (fragment ?? '')) || id, label);
    return `<span class="ext-ref" title="${path}${fragment ?? ''}">${label}</span>`;
  });
}

function linkTo(id, label) {
  return id ? `<a href="#${id}">${label}</a>` : null;
}

export function anchorIds({ path, headings }) {
  return headings.map((h) => [`${path}#${h.local}`, h.slug]);
}
```

  - `fragment` is `undefined` when the href has no `#`. With an empty path, `fromPath + undefined` misses, so the link stays as it is.

- [ ] **Step 7: Export `fileSlug`.** In `doc-routes.mjs`, change `function fileSlug(path)` to `export function fileSlug(path)`.

- [ ] **Step 8: Wire `render.mjs`.**
  - Add the imports `import { nextSlug } from './lib/slug-registry.mjs';`, and add `fileSlug` to the existing `doc-routes.mjs` import: `import { routeMap, fileSlug } from './lib/doc-routes.mjs';`.
  - Replace `const slugs = new Map();` and the `renderMarkdown(...)` call inside `pages` with:

```js
const prefixes = new Map();
// The spine keeps bare ids: it is the document every other one links into, and
// its rail, section help and tests name `core-components`, not a prefixed id.
function headingPrefix(path, index) {
  return index === 0 ? '' : nextSlug(fileSlug(path), prefixes);
}
```

```js
  ...renderMarkdown(readFileSync(p, 'utf8'), { slugs: new Map(), docSlugs, prefix: headingPrefix(p, i) }),
```

  - Then confirm that render.mjs still has ≤ 10 functions and ≤ 200 lines.

- [ ] **Step 9: Run to verify they pass, then run the full suite.**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/md-render.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/doc-links.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/render.test.mjs && npm test`

Expected: PASS.
- Any other test that encoded cross-document dedupe for a non-spine heading (an `id="…-2"` across documents) is now wrong by design. Update its expected id to the prefixed form and list it in the report.
- Never change a spine-heading expectation. Spine ids must not move. If one does, that is a bug.

- [ ] **Step 10: Docs.**
  - **viewer.md table.** Replace the row `| \`#anchor\` | untouched |` with `| \`#anchor\` | resolved against this document's own h2/h3 headings; anything else (a view panel, a doc head) untouched |`.
  - **viewer.md paragraph.** In the paragraph after the table, replace the sentence that begins `A fragment on a document link is resolved` with: `A fragment is resolved to the heading id the page carries: outside ARCHITECTURE.md every h2/h3 id is prefixed with its document's file slug (\`0007-cache__context\`), so the same heading in two documents never collides and \`#context\` inside an ADR stays in that ADR.`
  - **Spec D18 row.** Insert after the D17 row:

```
| D18 | (added 2026-10-14) Heading ids outside ARCHITECTURE.md carry their document's file slug: `<fileSlug>__<slug>` (`interview-log__q3`); dedupe is per document; the spine keeps bare ids. A same-page `#x` resolves against its own document. Supersedes D17's `q3-2` example. | Unique by construction instead of by renumbering: adding a document never moves another document's ids, and `#context` inside an ADR lands in that ADR. |
```

  - **Spec Viewer bullet.** Replace `(the \`#q3\` fragment jumps to that answer — D17).` with `(the \`#q3\` fragment jumps to that answer, id \`interview-log__q3\` — D17, D18).`

- [ ] **Step 11: Commit.**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts plugins/solution-architect/skills/analyze-requirements/references/viewer.md docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md
git commit -m "feat(analyze-requirements): scope heading ids per doc"
```

---

### Task 2: The link validator ignores headings inside code fences

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/inputs.mjs` (`headingSlugs`, lines 42–52)
- Modify: `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` (D19 row)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/inputs.test.mjs`

**Interfaces:** `headingSlugs(md)` stays private. Its output must equal the `local` values md-render produces for the same markdown, because `anchorIds` keys on them.

- [ ] **Step 1: Failing test.** Append to `inputs.test.mjs`, using its existing `anchorInputs` helper:

```js
// md-render skips fenced code and frontmatter; the validator must count the same
// headings, or `#setup-2` passes the check and lands nowhere in the viewer.
test('a heading inside a code fence or frontmatter is not an anchor', async () => {
  const inputs = await anchorInputs('---\n## hidden\ntitle: x\n---\n## Setup\n\n```\n## Setup\n```\n\n## Setup\n');
  assert.deepEqual(inputs.anchors['ARCHITECTURE.md'], ['setup', 'setup-2']);
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/inputs.test.mjs`

Expected: FAIL, because the actual output includes `hidden` and `setup-3`.

- [ ] **Step 3: Implement.** Replace the comment above `headingSlugs` and the function itself with:

```js
// Mirrors md-render.mjs: frontmatter stripped, fenced code skipped, only h2/h3,
// deduped per document with the shared -N rule (slug-registry.mjs). These are
// the `local` slugs the renderer keys its anchors on (doc-links.mjs anchorIds).
function headingSlugs(md) {
  const registry = new Map();
  let fenced = false;
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n').flatMap((l) => {
    if (l.trim().startsWith('```')) fenced = !fenced;
    const m = !fenced && l.match(/^(#{2,3})\s+(.*)$/);
    return m ? [nextSlug(m[2].trim(), registry)] : [];
  });
}
```

- [ ] **Step 4: Spec D19 row.** Insert after D18:

```
| D19 | (added 2026-10-14) The link validator counts headings exactly as the renderer does: frontmatter stripped, fenced code skipped. | A `## ` line inside a code block shifted the validator's `-N` numbering off the viewer's, so a checked link could land nowhere. |
```

- [ ] **Step 5: Run the test, then the full suite, then commit.**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/inputs.test.mjs && npm test`

Expected: PASS.

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md
git commit -m "fix(analyze-requirements): skip fenced headings in links"
```

---

### Task 3: A link to a heading inside a record opens the drawer at that heading

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/assets/viewer-template.html`, specifically:
  - `navigate()` (~line 1917)
  - the record click handler (~line 2002)
  - a new `landInRecord` function next to `openDrawer`
- Modify: `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` (D20 row)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/browser.test.mjs`

**Interfaces:** none outside the template. Records live in a folder matched by `DECISIONS = /^(adrs?|decisions?|rfcs?)$/` (render.mjs:52), at a `--docs` index greater than 0.

**Why:** `openDrawer` resets `drawerBody.scrollTop = 0`, and the click handler rewrites a record link to `#/<route>`. Both throw the heading away, so every heading link into an ADR opens at the top.

- [ ] **Step 1: Failing browser test.**
  - In `buildViewer()`, write a long record and add it to `--docs`. The fixture already has `mkdirSync`? If not, add it to the `node:fs` import.

```js
  mkdirSync(join(out, 'adr'));
  const longAdr = stub(join('adr', '0009-long.md'), ['# ADR 0009: Long record', '', '## Context', '',
    ...Array.from({ length: 40 }, (_, i) => `Context paragraph ${i + 1} keeps the record taller than the drawer.\n`),
    '## Decision', '', 'Land here.'].join('\n'));
```

    Add `longAdr` after `stub('reflow.md', REFLOW_DOC)` in the `--docs` list.
  - Append inside the `describe`:

```js
  // openDrawer resets the scroll and the click handler rewrote the link to the
  // record's route, so a link to a heading inside an ADR opened it at the top.
  test('a link to a heading inside a record opens the drawer at that heading', async () => {
    const r = await page.eval(`(async () => {
      const h = document.querySelector('[id^="0009-long__"][id$="__decision"]');
      const a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = 'jump';
      document.querySelector('.page:not([hidden])').appendChild(a);
      a.click();
      await new Promise((res) => setTimeout(res, 200));
      const body = document.getElementById('drawer-body');
      const out = { open: document.getElementById('drawer').classList.contains('is-open'),
        inDrawer: body.contains(h), scrolled: body.scrollTop > 0,
        top: Math.round(h.getBoundingClientRect().top - body.getBoundingClientRect().top) };
      a.remove();
      document.getElementById('drawer-close').click();
      await new Promise((res) => setTimeout(res, 100));
      return out;
    })()`);
    assert.deepEqual({ open: r.open, inDrawer: r.inDrawer, scrolled: r.scrolled },
      { open: true, inDrawer: true, scrolled: true });
    assert.ok(r.top < 150, `heading sits ${r.top}px below the drawer top`);
  });
```

  - The selector does not hard-code the prefix, because `fileSlug` decides it.

- [ ] **Step 2: Run to verify it fails.**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/browser.test.mjs`

Expected: this test fails with `scrolled: false`. Every other browser test still passes.
- If adding the record breaks an unrelated assertion (a page count, for example), report it as NEEDS_CONTEXT. Do not change that assertion.
- If Chrome is missing, the suite is skipped. Report that, since this task cannot be verified without it.

- [ ] **Step 3: Implement.** In `viewer-template.html`:

  - **Declare the handoff variable.** Add next to the other drawer state (`var openRecord`, `var returnFocus`):

```js
/* A heading the click handler wants landed on once the route change opens its
   record; the route itself can only name the record. */
var pendingHeading = '';
```

  - **Add `landInRecord`.** Put it after `closeDrawer()`:

```js
/* The record's page is moved into the drawer, so once the drawer is open its
   heading ids resolve there. The document head is the drawer's own top. */
function landInRecord(id) {
  var el = id && document.getElementById(id);
  if (el && !el.classList.contains('doc-head') && drawerBody.contains(el)) el.scrollIntoView({ block: 'start' });
}
```

  - **Use it in `navigate()`.** Replace `if (record) { openDrawer(record); return; }` with:

```js
  if (record) { openDrawer(record); landInRecord(parts.id || pendingHeading); pendingHeading = ''; return; }
```

  - **Use it in the click handler.** Replace its last two statements:

```js
  if (routeParts().slug === page.dataset.route) openDrawer(page);
  else location.hash = '#/' + page.dataset.route;
```

    with:

```js
  var heading = el.classList.contains('doc-head') ? '' : el.id;
  if (routeParts().slug === page.dataset.route) { openDrawer(page); landInRecord(heading); return; }
  pendingHeading = heading;
  location.hash = '#/' + page.dataset.route;
```

- [ ] **Step 4: Spec D20 row.** Insert after D19:

```
| D20 | (added 2026-10-14) A link to a heading inside a record (an ADR in the drawer) opens the drawer scrolled to that heading, from a click or a deep link. | The drawer reset its scroll and the click handler rewrote the link to the record's route, so every heading link into an ADR opened at the top. |
```

- [ ] **Step 5: Run the browser file, then the full suite, then commit.**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/browser.test.mjs && npm test`

Expected: PASS. `viewer-template.test.mjs` may assert template text. If a test fails because of exact text, read it: fix the template if the failure points at a real problem, and update the test's expected text only if it merely encodes the old wording. Say which in the report.

```bash
git add plugins/solution-architect/skills/analyze-requirements/assets/viewer-template.html plugins/solution-architect/skills/analyze-requirements/scripts/test/browser.test.mjs docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md
git commit -m "fix(analyze-requirements): drawer lands on heading"
```

---

### Task 4: A quoted value inside a proposed row keeps its citation (B)

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/references/writing.md` (§3 Table format rules, after the `stated` bullet, ~line 125)
- Modify: `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` (D21 row)

No code changes. `parseCitations` already scans the whole document, not just `src` cells, so an inline citation in any cell gets its quote checked by `validate.mjs` (`inputs.mjs:25`, `citationsOf(root, archPath, arch)`).

**Why:** eval 2 had a §6 row whose design was `proposed` but which applied the spec's `0.72` floor. The tag covers the whole row, so the stated number lost its citation.

- [ ] **Step 1: writing.md.** Insert directly after the `stated` bullet's last line (`word for word; a bare \`stated\` is a \`WARN\`.`):

```
- A row's `src` covers the whole row. When a `proposed` (or `researched`)
  row carries a value the client stated — a threshold, a limit, a name —
  cite that value in its cell, right after it, and leave the row's tag
  alone: `applies the 0.72 floor (stated [D1 · 2026-10-01](inputs/D1-spec.md) "confidence below 0.72")`.
  `validate.mjs` checks an inline quote exactly like one in `src`. Never
  re-tag the row `stated` to keep the value: the design is still yours.
```

- [ ] **Step 2: Spec D21 row.** Insert after D20:

```
| D21 | (added 2026-10-14) A stated value inside a `proposed`/`researched` row carries its own inline `stated [..](..) "quote"` citation in its cell; the row's `src` is unchanged. | `src` is per row, so a client's number inside a design row lost its source (eval 2, 0.72 floor). The inline citation is quote-checked like any other. |
```

- [ ] **Step 3: Verify the claim, then run the suite.**
  - Confirm the inline citation is actually checked. Write a scratch ARCHITECTURE.md in the scratchpad (not the repo) with a `proposed` row carrying a wrong inline quote, then run `validate.mjs` on it with `--inputs` pointing at a one-line input file.
    - Expected: a `FAIL [quotes]` line for the wrong quote.
    - If no FAIL appears, stop and report BLOCKED, because the rule would promise a check that does not exist.
  - Run `npm test`. Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add plugins/solution-architect/skills/analyze-requirements/references/writing.md docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md
git commit -m "docs(analyze-requirements): cite values in proposed rows"
```

- [ ] **Step 5: Stop.** Do not merge, push or bump the version. Report the commits and the test count. Add this to the human's manual check:
  - In the viewer, the Q3 citation lands on the log's answer, and the address bar shows `#interview-log__q3`.
  - In an ADR, a link to `#context` lands on that ADR's Context, inside the drawer.
