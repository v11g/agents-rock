// Markdown readers shared by the deliverable checks: find a section by its
// heading, and read every `| … |` table in a slice of text.

// Returns the text of the section/subsection starting at heading `name`, up
// to (not including) the next heading of the same or shallower level.
export function heading(md, name) {
  const m = new RegExp(`^(#{2,4})\\s*${name}\\b.*$`, 'm').exec(md);
  if (!m) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(new RegExp(`^#{1,${m[1].length}}\\s`, 'm'));
  return rest.slice(0, next === -1 ? undefined : next);
}

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

// Groups contiguous `| ... |` lines into tables, dropping the `| --- |`
// separator row, and returns each as { header, rows } of trimmed cells.
export function tables(text) {
  const groups = [];
  let cur = [];
  for (const line of (text ?? '').split('\n')) {
    if (/^\s*\|/.test(line)) cur.push(line);
    else if (cur.length) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups
    .map((g) => g.filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l)))
    .map((g) => ({ header: cells(g[0]), rows: g.slice(1).map(cells) }));
}
