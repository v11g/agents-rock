import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteDocLinks, anchorIds } from '../lib/doc-links.mjs';

const ids = new Map([
  ['/repo/docs/adr/0002-rls.md', 'doc-adr-0002-multi-tenancy'],
  ['/repo/ARCHITECTURE.md', 'doc-architecture'],
]);

test('a link to a document in the set becomes an in-page anchor', () => {
  const html = rewriteDocLinks(
    '<p><a href="0002-rls.md">ADR-0002</a></p>', '/repo/docs/adr/index.md', ids,
  );
  assert.match(html, /<a href="#doc-adr-0002-multi-tenancy">ADR-0002<\/a>/);
});

test('relative hrefs resolve against the linking document, not the repo root', () => {
  const html = rewriteDocLinks(
    '<p><a href="../../ARCHITECTURE.md">arch</a></p>', '/repo/docs/adr/index.md', ids,
  );
  assert.match(html, /href="#doc-architecture"/);
});

test('a root-relative href resolves the same way', () => {
  const html = rewriteDocLinks(
    '<p><a href="docs/adr/0002-rls.md">x</a></p>', '/repo/ARCHITECTURE.md', ids,
  );
  assert.match(html, /href="#doc-adr-0002-multi-tenancy"/);
});

// A fragment that names no heading in the target (here: ids has no #context
// entry) falls back to the document anchor rather than a dead id.
test('an unknown fragment on a document link falls back to the document', () => {
  const html = rewriteDocLinks(
    '<p><a href="0002-rls.md#context">why</a></p>', '/repo/docs/adr/index.md', ids,
  );
  assert.match(html, /href="#doc-adr-0002-multi-tenancy"/);
  assert.doesNotMatch(html, /#context/);
});

// A link to a file the viewer does not contain has nothing to navigate to. Left
// alone it still looks clickable, which is worse than plain text.
test('a link to a document outside the set is unwrapped, keeping its text', () => {
  const html = rewriteDocLinks(
    '<p>see <a href="docs/PRD.md">docs/PRD.md</a>.</p>', '/repo/ARCHITECTURE.md', ids,
  );
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /class="ext-ref"[^>]*>docs\/PRD\.md<\/span>/);
  assert.match(html, /<p>see .*\.<\/p>/);
});

test('an unwrapped reference keeps the original path in its title', () => {
  const html = rewriteDocLinks(
    '<p><a href="docs/PRD.md">the PRD</a></p>', '/repo/ARCHITECTURE.md', ids,
  );
  assert.match(html, /title="docs\/PRD\.md"/);
});

test('http and in-page hrefs are left untouched', () => {
  const src = '<p><a href="https://example.com/x.md">ext</a><a href="#goals">g</a></p>';
  assert.equal(rewriteDocLinks(src, '/repo/ARCHITECTURE.md', ids), src);
});

test('a document with no links is returned unchanged', () => {
  const src = '<p>no links here</p>';
  assert.equal(rewriteDocLinks(src, '/repo/ARCHITECTURE.md', ids), src);
});

// The rule is "any relative path", not a list of extensions. A .c4 model, a
// directory, a .py module — none of them can ever be a document in the set, so
// all of them are dead as links and all of them read better as text.
test('a link to a non-markdown source file is unwrapped', () => {
  const html = rewriteDocLinks(
    '<p><a href="docs/architecture/model/eos.c4">eos.c4</a></p>', '/repo/ARCHITECTURE.md', ids,
  );
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /class="ext-ref" title="docs\/architecture\/model\/eos\.c4">eos\.c4<\/span>/);
});

test('a link to a directory is unwrapped', () => {
  const html = rewriteDocLinks(
    '<p><a href="../mockup/">mockups</a></p>', '/repo/docs/adr/index.md', ids,
  );
  assert.match(html, /class="ext-ref" title="\.\.\/mockup\/">mockups<\/span>/);
});

test('an unwrapped reference keeps its fragment in the title', () => {
  const html = rewriteDocLinks(
    '<p><a href="docs/PRD.md#s10">PRD §10</a></p>', '/repo/ARCHITECTURE.md', ids,
  );
  assert.match(html, /title="docs\/PRD\.md#s10"/);
});

test('a protocol-relative url is not mistaken for a path', () => {
  const src = '<p><a href="//cdn.example.com/x">cdn</a></p>';
  assert.equal(rewriteDocLinks(src, '/repo/ARCHITECTURE.md', ids), src);
});

test('a root-absolute path is unwrapped: a single file has no site root', () => {
  const html = rewriteDocLinks(
    '<p><a href="/docs/guide">guide</a></p>', '/repo/ARCHITECTURE.md', ids,
  );
  assert.match(html, /class="ext-ref"/);
});

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

// A heading with no ASCII letters slugs to '' — its key must not win over
// the document anchor, or the link renders as a dead href="#".
test('an empty minted slug falls back to the document anchor', () => {
  const map = new Map([...ids,
    ['/repo/notes.md', 'doc-notes'], ['/repo/notes.md#', '']]);
  const html = rewriteDocLinks('<a href="notes.md#">N</a>', '/repo/ARCHITECTURE.md', map);
  assert.match(html, /<a href="#doc-notes">N<\/a>/);
});

test('anchorIds maps each heading\'s own-document slug to its minted id', () => {
  const page = { path: '/repo/log.md', headings: [
    { level: 3, text: 'Q3', slug: 'log__q3', local: 'q3' },
    { level: 3, text: 'Q3', slug: 'log__q3-2', local: 'q3-2' },
  ] };
  assert.deepEqual(anchorIds(page), [
    ['/repo/log.md#q3', 'log__q3'],
    ['/repo/log.md#q3-2', 'log__q3-2'],
  ]);
});

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
