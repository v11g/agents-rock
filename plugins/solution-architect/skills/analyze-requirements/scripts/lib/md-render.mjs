import { nextSlug } from './slug-registry.mjs';
import { escapeHtml, inline } from './md-inline.mjs';
import { renderList } from './md-list.mjs';
import { shapeOf } from './md-shape.mjs';
import { isDefinitionTable, renderDefinitions } from './md-defs.mjs';
import { isWideTable, isCrampedTable, renderWideCards } from './md-wide.mjs';
import { renderViewGroup, renderFlowTabs } from './md-views.mjs';
import { readFlowGroup } from './md-flows.mjs';

export { escapeHtml };

// `slugs` dedupes h2/h3 within one document; `prefix` names that document, so an
// id is unique across the whole set by construction (0007-cache__context). The
// separator is `__` because slugify never emits `_`, so a prefixed id cannot
// collide with a bare one.
export function renderMarkdown(md, { slugs = new Map(), docSlugs = new Map(), prefix = '' } = {}) {
  const ctx = {
    lines: md.replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n'),
    i: 0, html: [], headings: [], slugs, docSlugs, prefix, title: null, docId: null,
  };
  while (ctx.i < ctx.lines.length) dispatch(ctx);
  return {
    html: ctx.html.join('\n'),
    headings: ctx.headings,
    title: ctx.title ?? ctx.headings[0]?.text ?? 'Document',
    docId: ctx.docId,
  };
}

function dispatch(ctx) {
  const shape = shapeOf(ctx.lines, ctx.i);
  if (shape === 'blank') { ctx.i += 1; return; }
  if (shape === 'heading') return renderHeading(ctx);
  if (shape === 'fence') return renderFence(ctx);
  if (shape === 'marker') return renderMarker(ctx);
  if (shape === 'table') return renderTable(ctx);
  if (shape === 'list') return renderListBlock(ctx);
  return renderParagraph(ctx);
}

function renderListBlock(ctx) {
  const { html, next } = renderList(ctx.lines, ctx.i);
  ctx.html.push(html);
  ctx.i = next;
}

function renderHeading(ctx) {
  const [, hashes, raw] = ctx.lines[ctx.i].match(/^(#{1,6})\s+(.*)$/);
  const level = hashes.length;
  const text = raw.trim();
  ctx.i += 1;
  if (level === 1) {
    const id = `doc-${nextSlug(text, ctx.docSlugs)}`;
    ctx.title ??= text;
    ctx.docId ??= id;
    ctx.html.push(`<h1 id="${id}" class="doc-head">${inline(text)}</h1>`);
    return;
  }
  if (level !== 2 && level !== 3) {
    ctx.html.push(`<h${level}>${inline(text)}</h${level}>`);
    return;
  }
  const { slug, local } = headingId(ctx, text);
  ctx.html.push(`<h${level} id="${slug}">${inline(text)}</h${level}>`);
  ctx.headings.push({ level, text, slug, local });
}

// `local` is what an author writes after `#` inside the document and what the
// link validator knows; `slug` is the id the page carries.
function headingId(ctx, text) {
  const local = nextSlug(text, ctx.slugs);
  return { local, slug: ctx.prefix ? `${ctx.prefix}__${local}` : local };
}

function renderFence(ctx) {
  const lang = ctx.lines[ctx.i].trim().slice(3).trim();
  const code = [];
  let j = ctx.i + 1;
  while (j < ctx.lines.length && ctx.lines[j].trim() !== '```') { code.push(ctx.lines[j]); j += 1; }
  const body = escapeHtml(code.join('\n'));
  ctx.i = j + 1;
  if (lang !== 'mermaid') {
    ctx.html.push(`<pre><code>${body}</code></pre>`);
    return;
  }
  ctx.html.push(`<div class="diagram-shell"><div class="mermaid-canvas">${body}</div></div>`);
}

// Collects the whole run of markers, not one: blank lines between them are
// separation in the source, not in the reader's head.
function renderMarker(ctx) {
  const ids = [];
  let j = ctx.i;
  while (j < ctx.lines.length) {
    const marker = ctx.lines[j].trim().match(/^<!--\s*likec4:view\s+(\S+)\s*-->/);
    if (marker) ids.push(marker[1]);
    else if (ctx.lines[j].trim()) break;
    j += 1;
  }
  ctx.html.push(renderViewGroup(ids));
  ctx.i = j;
}

function renderTable(ctx) {
  const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
  const headers = cells(ctx.lines[ctx.i]);
  const rows = [];
  let j = ctx.i + 2;
  while (j < ctx.lines.length && ctx.lines[j].startsWith('|')) { rows.push(cells(ctx.lines[j])); j += 1; }
  ctx.i = j;
  if (isDefinitionTable(headers, rows)) { ctx.html.push(renderDefinitions(rows)); return; }
  if (isWideTable(headers, rows)) { ctx.html.push(renderWideCards(headers, rows)); return; }
  const head = `<tr>${headers.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
  const cls = isCrampedTable(headers) ? ' class="table--wide"' : '';
  ctx.html.push(`<table${cls}>${head}${body}</table>`);
}

// Checked before the paragraph collector, because a flow starts as one: several
// prose-then-marker units in a row are §7's three scenarios, and stacked they are
// the scroll tabs exist to remove.
function renderParagraph(ctx) {
  const group = readFlowGroup(ctx.lines, ctx.i);
  if (group) {
    ctx.html.push(renderFlowTabs(group.units));
    ctx.i = group.next;
    return;
  }
  const collected = [];
  let j = ctx.i;
  while (j < ctx.lines.length && shapeOf(ctx.lines, j) === 'paragraph') {
    collected.push(ctx.lines[j]);
    j += 1;
  }
  ctx.html.push(`<p>${inline(collected.join(' '))}</p>`);
  ctx.i = j;
}

