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
