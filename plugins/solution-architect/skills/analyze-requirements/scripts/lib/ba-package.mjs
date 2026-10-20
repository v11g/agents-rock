// A business-analyst package (requirements.json) arrives already sourced:
// each row has an id, a label and where it came from. A script reads it, so
// no extract agent and no quote matching: the id is the anchor. Only a row
// the BA confirmed may become `stated` (references/extract.md §2.2).
const SECTIONS = {
  requirements: 'goals and scope',
  systems: 'goals and scope',
  features: 'goals and scope',
  businessRules: 'goals and scope',
  constraints: 'constraints',
  nfrs: 'quality',
  integrations: 'external systems and integrations',
  data: 'data and its sensitivity',
};
const FACT = {
  integrations: (r) => `${r.system} (${r.direction})`,
  data: (r) => [r.entity, r.sensitivity, r.volume].filter(Boolean).join(', '),
};
const textOf = (r) => r.text ?? r.rule ?? r.purpose ?? r.name ?? '';

export function isPackage(value) {
  return Boolean(value && value.schemaVersion && Array.isArray(value.requirements));
}

// Constraints and business rules carry a source but no label: the BA records
// them only once confirmed (business-analyst references/writing.md).
function rowOf(row, key, updated) {
  const label = row.label ?? (row.source ? 'confirmed' : null);
  const fact = (FACT[key] ?? textOf)(row);
  const source = row.source ?? null;
  return { id: row.id, fact, label, source, section: SECTIONS[key], cite: `${row.id} · ${source ?? updated}` };
}

export function baRows(pkg) {
  return Object.keys(SECTIONS).flatMap((key) => (pkg[key] ?? [])
    .map((row) => rowOf(row, key, pkg.updated))
    .filter((r) => r.id && r.label));
}

export function isStated(row) {
  return row.label === 'confirmed';
}

// The text a quote may match: confirmed rows only, never assumed or recommended.
export function statedText(rows) {
  return rows.filter(isStated).map((r) => r.fact).join('\n');
}

// packages maps root-relative path → baRows. A citation's label starts with
// the row id (`FR-001 · kickoff call`); any quote it carries is checked by
// validate-quotes against the package's row texts, not here.
export function validateBaCitations({ citations, packages }) {
  return citations.filter((c) => packages.has(c.path)).flatMap((c) => {
    const id = c.label.split('·')[0].trim();
    const row = packages.get(c.path).find((r) => r.id === id);
    if (!row) return [{ check: 'quotes', message: `${id} is not in ${c.path}` }];
    if (!isStated(row)) return [{ check: 'quotes', message: `${id} is ${row.label} in ${c.path}; only confirmed rows are stated` }];
    if (c.label.trim() === row.cite) return [];
    return [{ check: 'quotes', message: `${c.label.trim()} does not match ${c.path}; cite it as ${row.cite}` }];
  });
}
