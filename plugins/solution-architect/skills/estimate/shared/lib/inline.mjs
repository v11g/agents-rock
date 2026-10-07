// The pricing module is written once as ESM and shipped twice: imported by
// compute.mjs, and inlined into a page as a plain script. Only the score
// review page needs any of it — score-html.mjs extracts WEIGHTS, BANDS,
// weightedScore, bandFor and tierFor so the page can re-tier an edited row —
// so the extraction is by name, never the whole module.
import { readFileSync } from 'node:fs';

export function inlineModule(src) {
  return src.replaceAll(/^export /gm, '');
}

// A page script that builds a zip (the xlsx export, the proposal's docx) gets
// the shared writer inlined ahead of it, so the writer exists once.
export function withZip(src) {
  return `${inlineModule(readFileSync(new URL('./zip.mjs', import.meta.url), 'utf8'))}\n${src}`;
}

export function stripInternal(html) {
  return html.replaceAll(/<!-- internal:start -->[\s\S]*?<!-- internal:end -->/g, '');
}

// Anchors on `export const NAME` / `export function NAME` at line start, the
// declaration shapes pricing.mjs uses throughout.
export function extractExports(src, names) {
  const starts = [...src.matchAll(/^export (?:const|function) (\w+)/gm)];
  return starts
    .map((m, i) => src.slice(m.index, starts[i + 1]?.index ?? src.length).trimEnd())
    .filter((block, i) => names.includes(starts[i][1]))
    .join('\n\n');
}
