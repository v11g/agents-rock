// A `stated` fact that quotes a source must quote it word for word: a model
// that paraphrases and still says "the client said" is what citations exist
// to catch. Matching text is free and deterministic, so no agent checks it.
// Exact apart from whitespace and curly quotes — transcripts wrap lines and
// Word exports curl apostrophes; neither changes what was said.
const CITATION = /stated \[([^\]]+)\]\(([^)\s#]+)(?:#[^)\s]*)?\)(?: "([^"]+)")?/g;
const EMPTY = /^(—|-|Not provided.*)?$/;

export function normalize(text) {
  return text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ').trim();
}

export function parseCitations(md) {
  return [...md.matchAll(CITATION)].map((m) => ({ label: m[1], path: m[2], quote: m[3] ?? null }));
}

export function closestSentence(text, quote) {
  const words = new Set(normalize(quote).toLowerCase().split(' '));
  const score = (s) => s.toLowerCase().split(' ').filter((w) => words.has(w)).length;
  const sentences = normalize(text).split(/(?<=[.!?])\s+/);
  return sentences.reduce((best, s) => (score(s) > score(best) ? s : best), sentences[0] ?? '');
}

export function briefQuotesOf(tables) {
  const t = tables.find((x) => /Quality Requirements/i.test(x.section));
  const col = (t?.headers ?? []).findIndex((h) => /^brief says$/i.test(h));
  if (col === -1) return [];
  return t.rows.map((r) => (r[col] ?? '').trim().replace(/^"|"$/g, ''))
    .filter((q) => !EMPTY.test(q));
}

// sources maps root-relative path → text. A citation to a file not in the map
// is left to the links check, which already fails a missing target.
export function validateQuotes({ citations, briefQuotes, sources }) {
  return [...citationFindings(citations, sources), ...briefFindings(briefQuotes, sources)];
}

function citationFindings(citations, sources) {
  return citations.filter((c) => c.quote && sources.has(c.path))
    .filter((c) => !normalize(sources.get(c.path)).includes(normalize(c.quote)))
    .map((c) => ({
      check: 'quotes',
      message: `"${c.quote}" not found in ${c.path}; closest: "${closestSentence(sources.get(c.path), c.quote)}"`,
    }));
}

// A Brief says quote names no file, so any input may hold it. With no inputs
// at all (the brief arrived in chat) there is nothing to check it against.
function briefFindings(quotes, sources) {
  if (!sources.size) return [];
  const all = [...sources.values()].map(normalize);
  return quotes.filter((q) => !all.some((t) => t.includes(normalize(q))))
    .map((q) => ({ check: 'quotes', message: `Brief says "${q}" is in no input file` }));
}
