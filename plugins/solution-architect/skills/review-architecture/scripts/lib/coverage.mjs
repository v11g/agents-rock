// Evidence is all four or it is still a plan. Three of four is the shape that
// reads as proven and is not.
const EVIDENCE = ['result', 'environment', 'date', 'artifact'];
const SECTION_REF = /§\s*\d+/;

// A zero denominator is not a success. Reporting 100% for a system with no
// must-level rows is the exact dishonesty the report exists to catch.
export function ratio(n, d) {
  return d === 0 ? { notApplicable: true } : { n, d };
}

export function mustRows(table) {
  if (!table) return [];
  return table.rows.filter((r) => (r.priority ?? '').toLowerCase() === 'must');
}

// A ratio of not-applicable is the right answer for a document with no must
// rows and the wrong answer for one whose §13 this script failed to read. The
// two are indistinguishable in the numbers, so they are distinguished here.
export function notes(arch, adrTexts) {
  const found = /^#+\s*13[.)]?\s|Quality Requirements/im.test(arch);
  const out = [];
  if (!found) out.push('section 13 Quality Requirements & SLOs not found — no driver ratios computed');
  if (!adrTexts) out.push('no ADR directory given or found — decision ratios not computed');
  return out;
}

function names(text, measure) {
  return measure.length > 0 && text.toLowerCase().includes(measure.toLowerCase());
}

// An ADR answers a §13 row when it names that row's measure. Without an id
// column on §13, the measure string is the only stable handle the two documents
// share — which is why decisions.md tells the writer to quote it.
export function designCoverage(rows, adrTexts) {
  const answered = rows.filter((r) => adrTexts.some((t) => names(t, r.measure ?? '')));
  return ratio(answered.length, rows.length);
}

export function validationCoverage(rows, planRows) {
  const planned = rows.filter((r) => planRows.some((p) => names(rowText(p), r.measure ?? '')));
  return ratio(planned.length, rows.length);
}

function rowText(row) {
  return Object.values(row).join(' ');
}

function isEvidenced(row) {
  const status = (row.status ?? '').toLowerCase();
  return EVIDENCE.every((field) => status.includes(`${field}:`));
}

export function evidenceCoverage(planRows) {
  return ratio(planRows.filter(isEvidenced).length, planRows.length);
}

// Counts ADRs that name a section at all. Whether the section it names still
// exists is G5's job — a reviewer reading, not a script matching.
export function traceability(adrTexts) {
  return ratio(adrTexts.filter((t) => SECTION_REF.test(t)).length, adrTexts.length);
}
