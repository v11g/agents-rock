// A heading carries its number in the document ("## 13 Quality Requirements &
// SLOs") but callers know the title, so the number is matched loosely and the
// title exactly. Matching on the title alone would let "Decisions" find
// "Architecture Decisions" in a companion.
function isHeadingFor(line, title) {
  if (!line.startsWith('#')) return false;
  const text = line.replace(/^#+\s*/, '').replace(/^\d+[.)]?\s*/, '').trim();
  return text.toLowerCase() === title.toLowerCase();
}

function cells(line) {
  return line.slice(1, -1).split('|').map((c) => c.trim());
}

// The separator row is every cell being dashes, with optional alignment colons.
// Testing the whole line instead misses it, because the interior pipes are not
// in the character class and the row then counts as data.
function isRule(line) {
  return cells(line).every((c) => /^:?-+:?$/.test(c));
}

// Everything from the heading to the next heading. A table that follows a
// different heading is a different table, which is the whole point of asking
// for one by section.
function sectionLines(md, title) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => isHeadingFor(l, title));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('#'));
  return end === -1 ? rest : rest.slice(0, end);
}

// Rows come back keyed by header, so a caller reads row.priority rather than
// row[3] and a column moving does not silently change what it counted.
function toRow(headers, line) {
  const values = cells(line);
  return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
}

export function sectionTable(md, title) {
  const lines = sectionLines(md, title);
  if (!lines) return undefined;
  const pipes = lines.filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'))
    .map((l) => l.trim());
  if (pipes.length < 2) return undefined;
  const headers = cells(pipes[0]);
  const rows = pipes.slice(1).filter((l) => !isRule(l)).map((l) => toRow(headers, l));
  return { headers, rows };
}
