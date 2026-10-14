# Ask for Inputs + Jump to the Answer (Part 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The skill asks for client material before it interviews, so more facts carry checked quotes. In the viewer, a citation like `interview-log.md#q3` jumps to answer Q3, not to the top of the log.

**Architecture:** Part A is skill instructions only: one inputs card at SKILL.md step 3. A brief pasted in chat is saved as `inputs/N<n>-brief.md`, so it is extracted and checked like any other file. Part D is one code change in the viewer. `doc-links.mjs` stops dropping a link's `#fragment`: it looks the fragment up and maps it to the heading id the renderer minted. `render.mjs` builds that lookup from each page's headings.

**Tech Stack:** Node ≥ 20 ESM, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` (Part 2, D9–D15). This plan adds D16 (inputs card) and D17 (fragments resolve), and amends the spec's Viewer section (Task 2). The user decided both in chat on 2026-10-14: "A for cards and D for this".

## Global Constraints

- Lands on `feat/quality-goals-citations` in worktree `.claude/worktrees/quality-goals-part2`, on top of `1364100`. Do not merge, and do not push. Plugin 3.2.0 is unreleased, so these changes ship inside 3.2.0 with **no version bump**.
- Node ≥ 20; no new npm dependencies.
- Quality gates: ≤ 20 lines per function, ≤ 3 parameters, nesting ≤ 2, ≤ 200 lines and ≤ 10 functions per file (`scripts/test/quality-gates.test.mjs`).
- TDD for code: every test runs and fails before its code exists.
- Commits: Conventional Commits, subject ≤ 50 chars, no AI attribution trailers of any kind.
- Input IDs (spec D11): `C` call, `E` email, `N` note, `D` other document. A brief from chat is a note: `N<n>-brief.md`.
- `npm test` from the worktree root passes at the end of every task.

## Review Focus

1. **The same heading text in two documents.** `### Q3` appears in ARCHITECTURE.md and in the log, so the log's heading is minted `q3-2`. `#q3` must land on the log's heading, never on ARCHITECTURE.md's. Pinned in Task 1 (render test).
2. **A fragment with no matching heading** (`#q99`, or an h1 slug). It falls back to the document anchor and never produces a dead `#q99`. The existing doc-links test is kept for this.
3. **A link with no fragment.** Same output as today. Covered by the existing doc-links tests, which stay unchanged.
4. **"Added to inputs/" picked while `inputs/` is still empty.** The skill says so and continues as interview-only; it never extracts nothing silently. Pinned in Task 2 (extract.md wording).
5. **The user said "don't ask" and pasted a brief.** No card is shown, but the brief is still saved as `N1` and extracted. Pinned in Task 2 (extract.md wording + eval 0 assertion stays valid).

---

### Task 1: Citation fragments jump to the minted heading

**Files:**
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/lib/doc-links.mjs`
- Modify: `plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs` (the `idByPath` line, ~86; import line 5)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/doc-links.test.mjs` (append)
- Test: `plugins/solution-architect/skills/analyze-requirements/scripts/test/render.test.mjs` (append)

**Interfaces:**
- Consumes: `renderMarkdown(...)` pages already carry `headings: [{ level, text, slug }]`, where `slug` is the id minted across the whole set (`md-render.mjs:59`). It also consumes `nextSlug(text, registry)` from `slug-registry.mjs`.
- Produces:
  - `anchorIds({ path, headings }) → Array<[string, string]>`, which returns `[`${path}#${localSlug}`, mintedSlug]` for each h2/h3. Here `localSlug` is the heading's slug with dedupe scoped to its own document, the same frame `inputs.mjs` `headingSlugs` uses for the links check.
  - `rewriteDocLinks(html, fromPath, idByPath)` keeps its signature. `idByPath` may now also hold `<absPath>#<localSlug>` keys. When a link's fragment matches one, the href is `#<mintedSlug>`; otherwise it stays the document id, as today.

- [ ] **Step 1: Write the failing unit tests.** Append to `doc-links.test.mjs`, and change its import to `import { rewriteDocLinks, anchorIds } from '../lib/doc-links.mjs';`:

```js
// The author writes #q3 against the log's own headings; the renderer dedupes
// ids across the whole set, so the log's Q3 may have been minted q3-2.
test('a fragment resolves to the id its heading was minted as', () => {
  const map = new Map([...ids,
    ['/repo/interview-log.md', 'doc-interview-log'],
    ['/repo/interview-log.md#q3', 'q3-2']]);
  const html = rewriteDocLinks(
    '<p><a href="interview-log.md#q3">Q3</a></p>', '/repo/ARCHITECTURE.md', map,
  );
  assert.match(html, /<a href="#q3-2">Q3<\/a>/);
});

test('anchorIds maps each heading\'s own-document slug to its minted id', () => {
  const page = { path: '/repo/log.md', headings: [
    { level: 3, text: 'Q3', slug: 'q3-2' },
    { level: 3, text: 'Q3', slug: 'q3-3' },
  ] };
  assert.deepEqual(anchorIds(page), [
    ['/repo/log.md#q3', 'q3-2'],
    ['/repo/log.md#q3-2', 'q3-3'],
  ]);
});
```

In the same file, reword only the comment above the existing test `'a fragment on a document link is dropped rather than guessed at'`. The new comment is: `// A fragment that names no heading in the target (here: ids has no #context\n// entry) falls back to the document anchor rather than a dead id.` Leave its body unchanged.

- [ ] **Step 2: Write the failing render test.** Append to `render.test.mjs`, and add `cpSync` to its `node:fs` import:

```js
test('a citation to an interview answer jumps to that answer, even when its id was deduped', () => {
  const root = mkdtempSync(join(tmpdir(), 'render-anchor-'));
  cpSync(fixtures, root, { recursive: true });
  const arch = join(root, 'ARCHITECTURE.md');
  const log = join(root, 'interview-log.md');
  writeFileSync(arch, `${readFileSync(arch, 'utf8')}\n### Q3\n\nOwner: stated [Q3 · 2026-10-14](interview-log.md#q3)\n`);
  writeFileSync(log, '# Interview log\n\n### Q3\n**Answer** Confirm top 3\n');
  const out = mkdtempSync(join(tmpdir(), 'render-anchor-out-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', root, '--arch', arch, '--docs', log, '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<h3 id="q3-2">Q3<\/h3>/);
  assert.match(html, /<a href="#q3-2">Q3 · 2026-10-14<\/a>/);
});
```

If render.mjs needs more in the fixture than this (for example it refuses the copied `model.json` path), adapt the setup and never the two assertions. Say so in the report.

- [ ] **Step 3: Run to verify they fail**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/doc-links.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/render.test.mjs`
Expected: FAIL. `anchorIds` is not exported (SyntaxError on import). The render test finds `href="#doc-interview-log"` instead of `#q3-2`.

- [ ] **Step 4: Implement `doc-links.mjs`.** Add the import, replace the comment block above `rewriteDocLinks` together with its body, and add `anchorIds`:

```js
import { dirname, resolve } from 'node:path';
import { nextSlug } from './slug-registry.mjs';

// (keep the existing top-of-file comment and the HREF / ABSOLUTE constants)

// idByPath maps a document's absolute path to its id, and `<path>#<slug>` to
// the id that heading was minted as. Authors write a fragment against the
// target's own headings (#q3), but ids are deduped across the whole set (q3-2),
// so the fragment is looked up, never trusted; unknown → the document anchor.
export function rewriteDocLinks(html, fromPath, idByPath) {
  const dir = dirname(fromPath);
  return html.replace(HREF, (whole, path, fragment, label) => {
    // No path means an in-page anchor; a scheme or // means it leaves the page.
    if (!path || ABSOLUTE.test(path)) return whole;
    const target = resolve(dir, path);
    const id = idByPath.get(target);
    if (id) return `<a href="#${idByPath.get(target + (fragment ?? '')) ?? id}">${label}</a>`;
    return `<span class="ext-ref" title="${path}${fragment ?? ''}">${label}</span>`;
  });
}

// The own-document slug is what an author writes after `#` and what
// validate-links checks; the minted slug is what the page actually carries.
export function anchorIds({ path, headings }) {
  const local = new Map();
  return headings.map((h) => [`${path}#${nextSlug(h.text, local)}`, h.slug]);
}
```

- [ ] **Step 5: Wire `render.mjs`.** Change line 5 to `import { rewriteDocLinks, anchorIds } from './lib/doc-links.mjs';`, and replace the `idByPath` line with:

```js
const idByPath = new Map([...pages.map((p) => [p.path, p.docId]), ...pages.flatMap((p) => anchorIds(p))]);
```

- [ ] **Step 6: Run to verify they pass, then the full suite**

Run: `node --test plugins/solution-architect/skills/analyze-requirements/scripts/test/doc-links.test.mjs plugins/solution-architect/skills/analyze-requirements/scripts/test/render.test.mjs && npm test`
Expected: all PASS, including the existing doc-links tests unchanged and the quality gates.

- [ ] **Step 7: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/scripts/lib/doc-links.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/doc-links.test.mjs \
        plugins/solution-architect/skills/analyze-requirements/scripts/test/render.test.mjs
git commit -m "feat(analyze-requirements): jump to cited heading"
```

---

### Task 2: Ask for client inputs (docs + eval)

**Files** (all under `plugins/solution-architect/skills/analyze-requirements/` except the spec):
- Modify: `references/extract.md` (opening line; new §2; renumber old §2–§4 to §3–§5)
- Modify: `SKILL.md` (Flow steps 3 and 8)
- Modify: `references/interview.md` (question bank row; card batching bullet)
- Modify: `references/writing.md` (viewer bullet, ~line 126)
- Modify: `references/viewer.md` (link rule table row, ~line 173)
- Modify: `evals/evals.json` (eval 0: one assertion appended)
- Modify: `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md` (D16, D17 rows; Viewer bullet ~line 210)

No code. Task 1 must be committed first, because the writing.md, viewer.md and spec wording describe its behaviour.

- [ ] **Step 1: `references/extract.md`.** Replace the opening lines

```
Read at SKILL.md step 3, before the interview, whenever the user supplies
client material (call transcripts, emails, notes, documents).
```

with

```
Read at SKILL.md step 3, before the interview, on every run: it asks for
client material (§2) and turns it into quoted facts (§3).
```

Renumber `## 2. Run` → `## 3. Run`, `## 3. Follow-up questions` → `## 4. Follow-up questions`, and `## 4. Using the facts` → `## 5. Using the facts`. Inside old §3 (now §4), the reference "then `check-quotes` its facts" needs no number change. Grep the skill for `extract.md §` and fix any numbered reference to the renumbered sections. Then insert after §1:

````markdown
## 2. Ask for inputs

Evidence before questions: a fact quoted from a client file is checked word
for word, while a fact from an interview answer is only as good as the
answer. So unless files were given or `inputs/` already holds files, the
run's first card asks for them. It is one card in its own `AskUserQuestion`
call, and it counts toward the interview's 12-question cap:

- Question: "Client material makes this document stronger: every fact taken
  from it carries a checked quote. Do you have call transcripts, emails,
  notes or specs?"
- Options, in this order:
  1. `Added to inputs/ — continue (Recommended)` → list `inputs/`, give
     each file its ID (§1), then run §3.
  2. `The brief is in my message — save it` → §2.1, then §3.
  3. `None — interview only` → log the answer. The final report says
     `0 input files: <n> stated facts cite the interview only`.
- If option 1 is picked but `inputs/` is still empty, say so and continue
  as option 3.
- If the user said not to ask, show no card. A brief in the opening message
  is still saved per §2.1. With no brief, continue as option 3.

### 2.1 Saving a brief from chat

Write the part of the user's message that describes the project to
`inputs/N<n>-brief.md`, using the next free `N` number. Copy it exactly as
the user wrote it: no heading, no summary, no fixes. Date it the day it
arrived. From then on it is an input like any other: extracted (§3), never
edited, never recorded or drift-gated. A later brief gets the next number
and never overwrites an earlier one.
````

- [ ] **Step 2: `SKILL.md` Flow.** Replace step 3

```
3. **Extract** (when the user supplied client files): follow `references/extract.md` — `workflows/extract.js`, then `node scripts/check-quotes.mjs`. Never read input files into the main context.
```

with

```
3. **Inputs + extract**: follow `references/extract.md` — ask for client material unless files were given (§2), then `workflows/extract.js` and `node scripts/check-quotes.mjs` on every input (§3). Never read input files into the main context.
```

In step 8, replace `; report the URL.` with `; report the URL, plus the \`0 input files\` line when the run used none (\`references/extract.md\` §2).`

- [ ] **Step 3: `references/interview.md`.** Insert as the first row of the question bank table (directly under the `|---|...` separator):

```
| client inputs (`extract.md` §2) | Do you have call transcripts, emails, notes or specs? | both | files were given or `inputs/` already holds files, or the user said not to ask |
```

Add to `## Card batching`, directly after the `- **Max 3 cards per call.**` bullet:

```
- The client-inputs card (`extract.md` §2) is the run's first call, on its
  own: extraction must finish before any card proposes from evidence.
```

- [ ] **Step 4: `references/writing.md`.** Replace

```
- In the viewer an interview citation links to the log; an input citation
```

with

```
- In the viewer an interview citation jumps to its answer (`#q3`) in the log; an input citation
```

Keep the rest of that bullet unchanged.

- [ ] **Step 5: `references/viewer.md`.** In the link-rule table, replace the cell `in-page anchor, fragment dropped` with `in-page anchor; a fragment naming one of the target's h2/h3 headings jumps to it, any other fragment falls back to the document`. Read the surrounding rows and the paragraph after the table. If any sentence there still says fragments are always dropped, reword it to match (one sentence, same register).

- [ ] **Step 6: Spec.** In `docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md`, append two rows to the decisions table, directly after the D15 row:

```
| D16 | (added 2026-10-14) Unless files were given or `inputs/` holds files, the run's first card asks for client material; a brief pasted in chat is saved verbatim as `inputs/N<n>-brief.md` and extracted like any input. No card when the user said not to ask; the brief is still saved. | A quoted fact is checked word for word; an interview answer is not. Asking first turns more facts into checked quotes, and a chat brief stops being unverifiable. |
| D17 | (added 2026-10-14) In the viewer a link fragment resolves to the heading id the renderer minted for it (`#q3` → `q3-2` when deduped); an unknown fragment falls back to the document. | An interview citation should land on its answer, not the top of the log. |
```

In the Viewer section, replace `(the \`#q3\` fragment is dropped by design — the log is short).` with `(the \`#q3\` fragment jumps to that answer — D17).`

- [ ] **Step 7: Eval 0 assertion.** Append to eval id 0's `assertions` array in `evals/evals.json`:

```json
"asks-for-inputs-first: the first AskUserQuestion call is a single card asking for client material (call transcripts, emails, notes or specs), its first option 'Added to inputs/ — continue (Recommended)', and it comes before any §13 quality-goals card"
```

- [ ] **Step 8: Check JSON and run the suite**

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/solution-architect/skills/analyze-requirements/evals/evals.json','utf8'))" && npm test`
Expected: no parse output; suite PASS. Some tests read skill markdown (`rewriting.test.mjs`, `section-help.test.mjs`). If one breaks on the renumbered extract.md sections, fix the reference, not the test.

- [ ] **Step 9: Commit**

```bash
git add plugins/solution-architect/skills/analyze-requirements/references \
        plugins/solution-architect/skills/analyze-requirements/SKILL.md \
        plugins/solution-architect/skills/analyze-requirements/evals/evals.json \
        docs/superpowers/specs/2026-10-14-quality-goals-citations-design.md
git commit -m "docs(analyze-requirements): ask for client inputs"
```

- [ ] **Step 10: Stop.** Do not merge or push, and do not bump the version. Report the commits and the test count. Add this to the human's manual check:
  - Run `/analyze-requirements` once with an empty `inputs/` and confirm the inputs card comes first.
  - Pick "The brief is in my message" and confirm `inputs/N1-brief.md` appears and its quotes are checked.
  - In the viewer, click a `Q<n>` citation and confirm it lands on that answer.
