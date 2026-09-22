const ALLOWED = ['observed', 'stated', 'researched', 'proposed', 'assumed'];
const EXEMPT = ['Decisions', 'Glossary'];

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
  return t.rows.filter((r) => !ALLOWED.some((a) => (r[col] ?? '').startsWith(a)))
    .map((r) => ({ check: 'provenance', message: `"${t.section}" row "${r[0]}": bad src "${r[col]}"` }));
}
