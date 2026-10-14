import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { renderMarkdown } from './lib/md-render.mjs';
import { buildNav } from './lib/nav.mjs';
import { rewriteDocLinks, anchorIds } from './lib/doc-links.mjs';
import { buildDoc } from './lib/doc-sections.mjs';
import { routeMap, fileSlug } from './lib/doc-routes.mjs';
import { nextSlug } from './lib/slug-registry.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { embed } from './lib/embed.mjs';
import { kindOf } from './lib/doc-kinds.mjs';
import { estimateLink } from './lib/companion-links.mjs';
import { sectionHelp, serialiseHelp } from './lib/section-help.mjs';
import { stripRemoteAssets } from './lib/offline.mjs';
import { buildFontFaces } from './lib/fonts.mjs';
import { validatePalette } from './lib/validate-palette.mjs';

function consumeDocs(argv, i, docs) {
  while (argv[i + 1] && !argv[i + 1].startsWith('--')) docs.push(argv[++i]);
  return i;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), docs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--docs') {
      i = consumeDocs(argv, i, args.docs);
    } else if (flag.startsWith('--')) {
      args[flag.slice(2)] = argv[++i];
    }
  }
  return args;
}

function docTitle(archMd) {
  const { data } = parseFrontmatter(archMd);
  if (data?.name) return data.name;
  const h1 = archMd.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : 'Architecture';
}

// The rail buckets documents by the directory they came from, so a docs/adr run
// collapses to one row instead of 17. Anything sitting at the set root has no
// directory name worth showing — threat-model.md and the interface contract live
// beside ARCHITECTURE.md — so the whole root heads one Architecture section.
//
// Compare resolved directories, never the path's spelling. `basename(dirname())`
// reads the *argument*: the same set rendered from inside its own directory gave
// a rail section titled "." while an absolute --docs gave one named after the set
// folder. Index 0 was special-cased out of it, so every other root-level
// companion fell through.
const DECISIONS = /^(adrs?|decisions?|rfcs?)$/;

function sectionOf(path, index, root) {
  if (index === 0) return 'Architecture';
  const dir = dirname(resolve(path));
  if (dir === resolve(root)) return 'Architecture';
  const name = basename(dir).toLowerCase();
  if (DECISIONS.test(name)) return 'Decision Records';
  return name.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

// A record is read *because* of the row that referenced it, so it opens over that
// row rather than replacing the page — §14 already tables every ADR, and a rail
// section for them is that table a second time.
function drawerOf(path, index) {
  return index > 0 && DECISIONS.test(basename(dirname(path)).toLowerCase());
}

const args = parseArgs(process.argv.slice(2));
const archMd = readFileSync(args.arch, 'utf8');
const docPaths = [args.arch, ...args.docs];
const prefixes = new Map();
// The spine keeps bare ids: it is the document every other one links into, and
// its rail, section help and tests name `core-components`, not a prefixed id.
// A prefix is never reused or empty: `notes-2.md` beside two `notes.md` would
// otherwise repeat one, and a non-ASCII filename would collide with the spine.
const usedPrefixes = new Set();
function headingPrefix(path, index) {
  if (index === 0) return '';
  let prefix;
  do prefix = nextSlug(fileSlug(path) || 'doc', prefixes); while (usedPrefixes.has(prefix));
  usedPrefixes.add(prefix);
  return prefix;
}
const docSlugs = new Map();
const pages = docPaths.map((p, i) => ({
  ...renderMarkdown(readFileSync(p, 'utf8'), { slugs: new Map(), docSlugs, prefix: headingPrefix(p, i) }),
  section: sectionOf(p, i, args.root),
  path: resolve(p),
  spine: i === 0,
  drawer: drawerOf(p, i),
  kind: kindOf(p, i),
}));

// Second pass, because a link's target id is only known once every document has
// been rendered: the id comes from the target's H1, not from its filename.
const idByPath = new Map([...pages.map((p) => [p.path, p.docId]), ...pages.flatMap((p) => anchorIds(p))]);
const linked = pages.map((p) => ({
  ...p,
  html: estimateLink(p, args.out) + rewriteDocLinks(p.html, p.path, idByPath),
}));
const routes = routeMap(linked);

// The last point at which an off-palette bundle can still be stopped. A model
// that declares no colours is valid, generates clean and exits 0, so nothing
// upstream reports anything — the diagrams simply arrive in LikeC4's default
// blue beside teal mermaid ones. Checked here because this is where the bundle
// is read, and refused rather than warned about: a viewer is worth building only
// if its two diagram renderers agree.
const likec4Bundle = readFileSync(args['likec4-bundle'], 'utf8');
const themeJson = readFileSync(args.theme, 'utf8');
const paletteFindings = validatePalette({ bundle: likec4Bundle, theme: JSON.parse(themeJson) });
if (paletteFindings.length) {
  throw new Error(`${paletteFindings.join('\n')}\n`
    + 'Write the config with scripts/likec4-config.mjs, then re-run likec4 gen webcomponent.');
}

const templateUrl = new URL('../assets/viewer-template.html', import.meta.url);
const template = readFileSync(templateUrl, 'utf8');
// Shipped with the skill rather than passed in: unlike the two bundles these are
// fixed bytes that never need regenerating, so there is nothing for a caller to
// choose and no build step to get wrong.
const fontsDir = new URL('../assets/fonts/', import.meta.url).pathname;
const html = embed({
  template,
  slots: {
    TITLE: docTitle(archMd),
    FONTS: buildFontFaces(fontsDir),
    NAV: buildNav(linked, routes),
    DOC: buildDoc(linked, routes),
    LIKEC4_BUNDLE: stripRemoteAssets(likec4Bundle),
    MERMAID_BUNDLE: stripRemoteAssets(readFileSync(args['mermaid-bundle'], 'utf8')),
    THEME: themeJson,
    SECTION_HELP: serialiseHelp(sectionHelp()),
  },
});

mkdirSync(args.out, { recursive: true });
const outPath = join(args.out, 'index.html');
writeFileSync(outPath, html);
console.log(outPath);
