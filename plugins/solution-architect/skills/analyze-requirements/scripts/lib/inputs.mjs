import { readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { parseTables } from './md-tables.mjs';
import { extractLinks } from './md-links.mjs';
import { erEntities } from './er-entities.mjs';
import { extractModel } from './likec4-extract.mjs';
import { nextSlug } from './slug-registry.mjs';
import { parseCitations } from './validate-quotes.mjs';

export async function buildInputs({ root, archPath, modelPath, docPaths = [], inputPaths = [] }) {
  const arch = await readFile(archPath, 'utf8');
  const docs = await readDocs(root, [archPath, ...docPaths]);
  const sources = await readDocs(root, inputPaths);
  return {
    archMd: arch,
    frontmatter: parseFrontmatter(arch).data ?? {},
    tables: parseTables(arch),
    erNames: erEntities(arch),
    model: extractModel(JSON.parse(await readFile(modelPath, 'utf8'))),
    links: docs.flatMap((d) => extractLinks(d.md).map((l) => ({ fromDoc: d.path, href: l.href }))),
    files: [...docs, ...sources].map((d) => d.path),
    anchors: Object.fromEntries(docs.map((d) => [d.path, headingSlugs(d.md)])),
    sources: new Map(sources.map((d) => [d.path, d.md])),
    citations: citationsOf(root, archPath, arch),
  };
}

// Citations are written relative to ARCHITECTURE.md; sources are keyed
// relative to the root. Same frame as validate-links, or a nested set fails.
function citationsOf(root, archPath, md) {
  return parseCitations(md).map((c) => ({ ...c, path: relative(root, join(dirname(archPath), c.path)) }));
}

async function readDocs(root, paths) {
  return Promise.all(paths.map(async (p) => ({
    path: relative(root, p),
    md: await readFile(p, 'utf8'),
  })));
}

// Mirrors md-render.mjs exactly: only h2/h3 get an id in the viewer, deduped
// with a shared -N suffix rule (see slug-registry.mjs). Dedupe scope is per doc
// here, matching how this function is called once per doc; the renderer's
// cross-doc dedupe is a viewer-side concern (D6, out of scope).
function headingSlugs(md) {
  const registry = new Map();
  return md.split('\n')
    .map((l) => l.match(/^(#{2,3})\s+(.*)$/))
    .filter(Boolean)
    .map((m) => nextSlug(m[2].trim(), registry));
}
