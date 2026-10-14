import { dirname, resolve } from 'node:path';
import { nextSlug } from './slug-registry.mjs';

// The viewer is one HTML file, so a link to a sibling .md has nothing to open —
// every such href in a real set is dead on arrival. Each document is already in
// the DOM under its own id, so an in-set target becomes an in-page anchor. A
// target the viewer does not contain is unwrapped instead: left as a link it
// still looks clickable, which reads worse than plain text.
// The test is "is this a relative path", not "does it end in .md". A .c4 model,
// a directory, a source module — none of them can be a document in the set, so
// all of them are equally dead and all of them read better as text.
const HREF = /<a href="([^"#]*)(#[^"]*)?">([\s\S]*?)<\/a>/g;
const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

// idByPath maps a document's absolute path to its id, and `<path>#<slug>` to
// the id that heading was minted as. Authors write a fragment against the
// target's own headings (#q3), but ids are deduped across the whole set (q3-2),
// so the fragment is looked up, never trusted; unknown -> the document anchor.
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
