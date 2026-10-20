import { dirname, resolve } from 'node:path';

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
