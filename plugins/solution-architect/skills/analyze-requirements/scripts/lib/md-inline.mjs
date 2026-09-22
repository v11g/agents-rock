export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// For places that show heading text as plain text (the rail, the breadcrumb,
// title attributes) — the markers are syntax, not content.
export function stripInline(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)\s]+\)/g, '$1');
}

// Every fact in a set carries where it came from, and the four words are a closed
// vocabulary (validate-provenance.mjs). Written in backticks they came out as
// <code> in accent teal — the same chip as `org_id` and `docker-compose.yml` — so
// the accent meant two unrelated things and the most repeated element in the
// document read as a snippet of code. Matched exactly: `observed_at` is a column
// name and `Observed` is not a member of the vocabulary.
const PROVENANCE = new Set(['observed', 'stated', 'researched', 'proposed', 'assumed']);

const codeOrMarker = (_, body) => (PROVENANCE.has(body)
  ? `<span class="prov" data-prov="${body}">${body}</span>`
  : `<code>${body}</code>`);

export function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, codeOrMarker)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}
