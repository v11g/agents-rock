import { parseTables } from './md-tables.mjs';

// `^## ` never matches `### `, so a subheading stays inside its section.
export function sectionBody(md, title) {
  const chunk = md.split(/^## /m).find((c) => title.test(c.split('\n')[0]));
  return chunk ? chunk.slice(chunk.indexOf('\n') + 1) : '';
}

// Tables anywhere in the `## ` section, subheadings included. The table
// holding `column` wins; otherwise the first table, so a legacy shape is
// still seen.
export function sectionTable(md, title, column) {
  const tables = parseTables(sectionBody(md, title));
  const has = (t) => t.headers.some((h) => column.test(h));
  return tables.find(has) ?? tables[0];
}

const GIVES_WAY = /\(gives way first\)/i;
const NOT_PROVIDED = /^Not provided/i;

// Cells compare without markdown emphasis, so **Speed** matches Speed.
const plain = (cell) => cell.replace(/[*_]/g, '');
export const isGivesWay = (cell) => GIVES_WAY.test(plain(cell));
export const isNotProvided = (cell) => NOT_PROVIDED.test(plain(cell));
export const nameOf = (cell) => plain(cell).replace(GIVES_WAY, '').trim().toLowerCase();

export function goalCells(t) {
  const col = (t?.headers ?? []).findIndex((h) => /^goal$/i.test(h));
  return col === -1 ? null : t.rows.map((r) => r[col] ?? '');
}
