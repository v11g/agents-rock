// The math module is written once as ESM and shipped twice: imported by
// compute.mjs, and inlined into a page as a plain script. Only the score
// review page needs any of it — score-html.mjs extracts TIER_BREAKS and
// tierFor so the page can re-tier an edited row — so the extraction is
// by name, never the whole module.
export function inlineModule(src) {
  return src.replaceAll(/^export /gm, '');
}

export function stripInternal(html) {
  return html.replaceAll(/<!-- internal:start -->[\s\S]*?<!-- internal:end -->/g, '');
}

// Anchors on `export const NAME` / `export function NAME` at line start, the
// declaration shapes estimate-math.mjs uses throughout.
export function extractExports(src, names) {
  const starts = [...src.matchAll(/^export (?:const|function) (\w+)/gm)];
  return starts
    .map((m, i) => src.slice(m.index, starts[i + 1]?.index ?? src.length).trimEnd())
    .filter((block, i) => names.includes(starts[i][1]))
    .join('\n\n');
}
