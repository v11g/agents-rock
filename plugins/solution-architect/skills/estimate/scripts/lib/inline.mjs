// The math module is written once as ESM and shipped twice: imported by
// compute.mjs, and inlined into the team page as a plain script. The page
// needs only pert() — task expected hours for the breakdown rows — so
// render.mjs extracts that one export before inlining.
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
