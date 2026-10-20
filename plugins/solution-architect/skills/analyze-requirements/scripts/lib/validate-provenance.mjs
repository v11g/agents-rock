const ALLOWED = ['observed', 'stated', 'researched', 'proposed'];
const EXEMPT = ['Decisions', 'Glossary'];
const CITED = /\[[^\]]+\]\([^)\s]+\)/;

export function validateProvenance({ tables }) {
  const findings = [];
  for (const t of tables) {
    if (EXEMPT.some((e) => t.section.includes(e))) continue;
    findings.push(...checkTable(t));
  }
  return findings;
}

function checkTable(t) {
  const col = t.headers.indexOf('src');
  if (col === -1) {
    return [{ check: 'provenance', message: `table in "${t.section}" has no src column` }];
  }
  return t.rows.flatMap((r) => checkCell(t.section, r[0], r[col] ?? ''));
}

// Bare `stated` only warns: every set written before citations existed has it
// in every table, and failing them all would block every re-render at once.
function checkCell(section, name, cell) {
  if (!ALLOWED.some((a) => cell.startsWith(a))) {
    return [{ check: 'provenance', message: `"${section}" row "${name}": bad src "${cell}"` }];
  }
  if (cell.startsWith('stated') && !CITED.test(cell)) {
    return [{ check: 'provenance', message: `"${section}" row "${name}": stated has no citation`, level: 'warn' }];
  }
  return [];
}
