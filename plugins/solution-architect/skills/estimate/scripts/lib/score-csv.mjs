// Spreadsheet review channel: the agent writes its proposed scores as a CSV
// the human edits in Sheets/Excel; the numbers, the plain note and a free
// "note" column come back. Anchors and cites travel beside each score so the
// reviewer sees the reason without opening anything else.
import { SCORE_FACTORS, scoreNumbers } from './scoring.mjs';
import { tierFor } from './estimate-math.mjs';

export const CSV_HEADERS = ['id', 'feature',
  ...SCORE_FACTORS.flatMap((k) => [k, `${k}_why`, `${k}_cite`]), 'sum', 'tier', 'why_this_tier', 'note'];

const quote = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

function featureRow(f) {
  const { total, tier } = tierFor(scoreNumbers(f.scores));
  return [f.id, f.name, ...SCORE_FACTORS.flatMap((k) => [f.scores[k].n, f.scores[k].anchor, f.scores[k].cite]),
    total, tier, f.scoreNote, ''];
}

export function toCsv(draft) {
  return [CSV_HEADERS, ...draft.features.map(featureRow)].map((r) => r.map(quote).join(',')).join('\n') + '\n';
}

// RFC 4180: quoted fields may hold commas, newlines and doubled quotes.
export function parseCsv(text) {
  const rows = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rows.at(-1).push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      rows.at(-1).push(field); field = ''; rows.push([]);
    } else field += c;
  }
  if (field !== '' || rows.at(-1).length) rows.at(-1).push(field);
  return rows.filter((r) => r.length && (r.length > 1 || r[0] !== ''));
}

// A renamed or deleted score column would read back as NaN for every feature
// and land in the diff as a change the human never made.
export function fromCsv(text) {
  const [head, ...rows] = parseCsv(text);
  const col = (name) => head.indexOf(name);
  const missing = SCORE_FACTORS.filter((k) => col(k) === -1);
  if (missing.length) throw new Error(`csv is missing score columns: ${missing.join(', ')}`);
  return { features: rows.map((r) => ({
    id: r[col('id')],
    scores: Object.fromEntries(SCORE_FACTORS.map((k) => [k, Number(r[col(k)])])),
    scoreNote: r[col('why_this_tier')],
    note: r[col('note')] ?? '',
  })) };
}
