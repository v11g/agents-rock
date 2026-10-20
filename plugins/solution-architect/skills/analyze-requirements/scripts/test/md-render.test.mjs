import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../lib/md-render.mjs';

test('renders headings with slug ids and collects them', () => {
  const { html, headings } = renderMarkdown('## Core Components\ntext');
  assert.match(html, /<h2 id="core-components">Core Components<\/h2>/);
  assert.deepEqual(headings, [{ level: 2, text: 'Core Components', slug: 'core-components', local: 'core-components' }]);
});

test('renders tables, links, mermaid fences, likec4 markers', () => {
  const md = '| A | src |\n|---|---|\n| x | observed |\n\n[adr](docs/adr/0001-sample.md)\n\n```mermaid\nerDiagram\n```\n\n<!-- likec4:view index -->';
  const { html } = renderMarkdown(md);
  assert.match(html, /<table>[\s\S]*<td>observed<\/td>/);
  assert.match(html, /<a href="docs\/adr\/0001-sample.md">adr<\/a>/);
  assert.match(html, /diagram-shell[\s\S]*mermaid-canvas/);
  assert.match(html, /<c4-view view-id="index">/);
});

test('strips frontmatter', () => {
  const { html } = renderMarkdown('---\nname: x\n---\n## T');
  assert.doesNotMatch(html, /name: x/);
});

test('makes repeated heading ids unique within a document', () => {
  const { html, headings } = renderMarkdown('## Consequences\n\n## Consequences');
  assert.match(html, /<h2 id="consequences">/);
  assert.match(html, /<h2 id="consequences-2">/);
  assert.deepEqual(headings.map((h) => h.slug), ['consequences', 'consequences-2']);
});

test('keeps heading ids unique across docs sharing a slug registry', () => {
  const seen = new Map();
  renderMarkdown('## Considered Options', { slugs: seen });
  const { headings } = renderMarkdown('## Considered Options', { slugs: seen });
  assert.equal(headings[0].slug, 'considered-options-2');
});

test('renders a plain fenced block as preformatted code', () => {
  const md = 'Tree:\n\n```\nroot/\n├── src/\n└── docs/\n```\n\nAfter.';
  const { html } = renderMarkdown(md);
  assert.match(html, /<pre><code>root\/\n├── src\/\n└── docs\/<\/code><\/pre>/);
  assert.doesNotMatch(html, /``/);
  assert.match(html, /<p>After\.<\/p>/);
});

test('escapes html inside a plain fenced block', () => {
  const { html } = renderMarkdown('```json\n{"a": "<b>"}\n```');
  assert.match(html, /<pre><code>\{&quot;a&quot;: &quot;&lt;b&gt;&quot;\}<\/code><\/pre>/);
});

test('renders absolute-URL links with the href intact', () => {
  const { html } = renderMarkdown('[Stripe](https://stripe.com/docs/api)');
  assert.match(html, /<a href="https:\/\/stripe\.com\/docs\/api">Stripe<\/a>/);
});

test('renders h4-h6 as real heading tags with no id', () => {
  const { html, headings } = renderMarkdown('#### Deep\n\n##### Deeper\n\n###### Deepest');
  assert.match(html, /<h4>Deep<\/h4>/);
  assert.match(html, /<h5>Deeper<\/h5>/);
  assert.match(html, /<h6>Deepest<\/h6>/);
  assert.doesNotMatch(html, /<h4 id=/);
  assert.deepEqual(headings, []);
});

test('escapes a quote in a link target so it cannot break out of the href attribute', () => {
  const { html } = renderMarkdown('[x](y"onclick="alert(1))');
  assert.doesNotMatch(html, /"\s*onclick=/);
  assert.match(html, /&quot;/);
});

test('h1 gets a doc-prefixed id and is reported as the page title', () => {
  const { html, title, docId } = renderMarkdown('# Threat Model\n\n## Threats');
  assert.match(html, /<h1 id="doc-threat-model"/);
  assert.equal(title, 'Threat Model');
  assert.equal(docId, 'doc-threat-model');
});

test('doc ids use their own namespace so section slugs keep their numbering', () => {
  const slugs = new Map();
  const docSlugs = new Map();
  renderMarkdown('# Related\n\n## Related', { slugs, docSlugs });
  const second = renderMarkdown('# Related\n\n## Related', { slugs, docSlugs });
  assert.equal(second.docId, 'doc-related-2');
  assert.equal(second.headings[0].slug, 'related-2');
});

test('a page with no h1 falls back to its first section for a title', () => {
  const { title, docId } = renderMarkdown('## Only A Section');
  assert.equal(title, 'Only A Section');
  assert.equal(docId, null);
});

// Lists had no shape of their own, so every "- item" fell through to the
// paragraph collector and a bulleted block came out as one run-on sentence with
// literal dashes in it. The real doc set has 268 bullets, 22 nested and 45
// numbered items — this was the largest reading defect in the body.
test('bullet lines become a list, not a run-on paragraph', () => {
  const { html } = renderMarkdown('- one\n- two\n- three');
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><li>three<\/li><\/ul>/);
  assert.doesNotMatch(html, /<p>- /);
});

test('numbered lines become an ordered list', () => {
  const { html } = renderMarkdown('1. first\n2. second');
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
});

test('an indented bullet nests inside the item above it', () => {
  const { html } = renderMarkdown('- parent\n  - child\n- sibling');
  assert.match(html, /<li>parent<ul><li>child<\/li><\/ul><\/li><li>sibling<\/li>/);
});

test('inline markup still renders inside a list item', () => {
  const { html } = renderMarkdown('- see `code` and **bold** and [a](b.md)');
  assert.match(html, /<li>see <code>code<\/code> and <strong>bold<\/strong> and <a href="b\.md">a<\/a><\/li>/);
});

test('a list ends where the prose resumes', () => {
  const { html } = renderMarkdown('- item\n\nAfter the list.');
  assert.match(html, /<\/ul>\n<p>After the list\.<\/p>/);
});

test('a paragraph is not swallowed into a list that follows it', () => {
  const { html } = renderMarkdown('Lead in:\n- item');
  assert.match(html, /<p>Lead in:<\/p>\n<ul><li>item<\/li><\/ul>/);
});

// §4 Solution Strategy is specified as "≤5 bullets, each links an ADR"
// (references/writing.md), so its bullets are long enough to wrap in the source.
// A wrapped bullet used to end the list at the unmatched second line: the item
// closed, the continuation became an indented <p> carrying the ADR link on its
// own, and the next bullet opened a fresh <ul>. Five bullets rendered as five
// one-item lists interleaved with five stray paragraphs.
test('a wrapped bullet stays one list item', () => {
  const { html } = renderMarkdown('- first line\n  second line\n- next item');
  assert.match(html, /<ul><li>first line second line<\/li><li>next item<\/li><\/ul>/);
  assert.doesNotMatch(html, /<p>\s*second line/, 'the continuation broke out into a paragraph');
});

test('a wrapped bullet keeps the link that lives on its second line', () => {
  const { html } = renderMarkdown('- adopt event sourcing\n  ([ADR 2](docs/adr/2.md))');
  assert.match(html, /<li>adopt event sourcing \(<a href="docs\/adr\/2\.md">ADR 2<\/a>\)<\/li>/);
});

// The continuation rule only absorbs an indented second line: CommonMark's
// lazy continuation also allows an unindented one, which this renderer does
// not implement, because it needs no blank line before a paragraph and
// absorbing an unindented line would break the case above. Pinned here so
// the limit is a documented boundary rather than an accident.
test('an unindented line after a bullet stays its own paragraph', () => {
  const { html } = renderMarkdown('- item\nnot indented\n- next');
  assert.match(html, /<ul><li>item<\/li><\/ul>\n<p>not indented<\/p>\n<ul><li>next<\/li><\/ul>/);
});

// The continuation rule keys on indentation, so a block that follows a list
// without a blank line is still its own block. Absorbing it would flatten a
// table into the text of the bullet above it.
test('a table after a list is not absorbed into the last item', () => {
  const { html } = renderMarkdown('- item\n| a | b |\n| --- | --- |\n| 1 | 2 |');
  assert.match(html, /<\/ul>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<li>item \|/, 'the table was swallowed into the item');
});

// An indented marker under a bullet is a natural shape for §7's "2-4 dynamic
// views, named flows only": one flow named per bullet, its view embedded
// beneath. The continuation rule keyed on indentation alone would swallow it
// into the bullet's text, escape the comment, and silently drop the diagram.
test('an indented likec4 marker under a bullet still renders its diagram', () => {
  const { html } = renderMarkdown('- checkout flow\n  <!-- likec4:view checkout -->\n- refund flow');
  assert.match(html, /<c4-view view-id="checkout">/);
  assert.doesNotMatch(html, /likec4:view/, 'the marker was swallowed and escaped into the item');
});

// A two-column table whose right column runs to prose is a definition list
// wearing a table costume: 19 rows of hairline dividers where a card grid reads
// in one pass. Two columns of short values is real data and stays a table.
const defTable = (n, len) => ['| Term | Definition |', '|---|---|']
  .concat(Array.from({ length: n }, (_, i) => `| T${i} | ${'x'.repeat(len)} |`))
  .join('\n');

test('a two-column table of prose becomes a definition grid', () => {
  const { html } = renderMarkdown(defTable(3, 90));
  assert.match(html, /<dl class="def-grid">/);
  assert.equal([...html.matchAll(/<dt>/g)].length, 3);
  assert.match(html, /<dt>T0<\/dt><dd>x{90}<\/dd>/);
  assert.doesNotMatch(html, /<table>/);
});

test('a two-column table of short values stays a table', () => {
  const { html } = renderMarkdown(defTable(3, 12));
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /def-grid/);
});

test('a three-column table is always a table, however long its cells', () => {
  const md = '| A | B | C |\n|---|---|---|\n| a | ' + 'x'.repeat(200) + ' | c |';
  const { html } = renderMarkdown(md);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /def-grid/);
});

test('definition cells keep their inline markup', () => {
  const md = '| Term | Definition |\n|---|---|\n| **T** | `code` ' + 'y'.repeat(80) + ' |';
  const { html } = renderMarkdown(md);
  assert.match(html, /<dt><strong>T<\/strong><\/dt>/);
  assert.match(html, /<dd><code>code<\/code>/);
});

// Four consecutive view markers are four zoom levels on one system — 1900px of
// stacked scroll where the reader cannot compare them. Markers with prose in
// between are separate scenarios and must stay separate.
test('consecutive view markers collapse into one tab group', () => {
  const md = '<!-- likec4:view index -->\n\n<!-- likec4:view containers -->';
  const { html } = renderMarkdown(md);
  assert.match(html, /class="view-tabs"/);
  assert.equal([...html.matchAll(/<c4-view /g)].length, 2);
});

test('view markers separated by prose stay separate diagram shells', () => {
  const md = '<!-- likec4:view a -->\n\nSome prose.\n\n<!-- likec4:view b -->';
  const { html } = renderMarkdown(md);
  assert.doesNotMatch(html, /view-tabs/);
  assert.equal([...html.matchAll(/diagram-shell/g)].length, 2);
});

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
