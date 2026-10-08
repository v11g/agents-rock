import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderScope } from '../lib/scope-render.mjs';
import { loadWorkflow } from './scope-cases.mjs';
import { collectIds, checkDuplicates, checkRefs, checkLabels, checkAmbiguity, checkReadiness, checkPackage } from '../lib/checks.mjs';

const load = () =>
  JSON.parse(readFileSync(new URL('./fixtures/requirements-pass.json', import.meta.url), 'utf8'));

const loadMd = () =>
  readFileSync(new URL('./fixtures/requirements-pass.md', import.meta.url), 'utf8');

test('the pass fixture has no integrity findings', () => {
  const pkg = load();
  const ids = collectIds(pkg);
  assert.deepEqual(
    [...checkDuplicates(pkg), ...checkRefs(pkg, ids), ...checkLabels(pkg)], []);
});

test('a duplicate id is refused', () => {
  const pkg = load();
  pkg.assumptions.push({ ...pkg.assumptions[0] });
  assert.ok(checkDuplicates(pkg).some((f) => f.includes('duplicate id: ASM-001')));
});

test('a dangling trace reference is refused', () => {
  const pkg = load();
  pkg.requirements[0].traces.rules = ['BR-999'];
  assert.ok(checkRefs(pkg, collectIds(pkg)).some((f) => f.includes('FR-001') && f.includes('BR-999')));
});

test('a dangling readiness blocker is refused', () => {
  const pkg = load();
  pkg.readiness.blockers.push('Q-404');
  assert.ok(checkRefs(pkg, collectIds(pkg)).some((f) => f.includes('Q-404')));
});

test('a requirement without a label is refused', () => {
  const pkg = load();
  delete pkg.requirements[1].label;
  assert.ok(checkLabels(pkg).some((f) => f.includes('FR-002') && f.includes('missing label')));
});

test('a business rule without a source is refused', () => {
  const pkg = load();
  delete pkg.businessRules[0].source;
  assert.ok(checkLabels(pkg).some((f) => f.includes('BR-001') && f.includes('missing source')));
});

test('a recommended requirement in scope "in" needs a paired open question', () => {
  const pkg = load();
  pkg.requirements[1].label = 'recommended';
  assert.ok(checkLabels(pkg).some((f) => f.includes('FR-002') && f.includes('open question')));
});

test('the pass fixture has no ambiguity or readiness findings', () => {
  const pkg = load();
  assert.deepEqual([...checkAmbiguity(pkg), ...checkReadiness(pkg)], []);
});

test('a vague requirement is flagged with its id and the term', () => {
  const pkg = load();
  pkg.requirements[0].text = 'The system must be fast and user-friendly.';
  const findings = checkAmbiguity(pkg);
  assert.ok(findings.some((f) => f.includes('FR-001') && f.includes('"fast"')));
  assert.ok(findings.some((f) => f.includes('FR-001') && f.includes('"user-friendly"')));
});

test('a vague nfr is flagged', () => {
  const pkg = load();
  pkg.nfrs[0].text = 'The system should be robust.';
  assert.ok(checkAmbiguity(pkg).some((f) => f.includes('NFR-001') && f.includes('"robust"')));
});

test('a hand-edited readiness overall is refused', () => {
  const pkg = load();
  pkg.readiness.overall = 95;
  assert.ok(checkReadiness(pkg).some((f) => f.includes('recomputed')));
});

test('a missing area score is refused', () => {
  const pkg = load();
  delete pkg.readiness.areas.data;
  assert.ok(checkReadiness(pkg).some((f) => f.includes('missing area score')));
});

test('status past ANALYZED with an open architecture blocker is refused', () => {
  const pkg = load();
  pkg.status = 'VALIDATED';
  assert.ok(checkReadiness(pkg).some((f) => f.includes('VALIDATED') && f.includes('Q-001')));
});

test('an open architecture blocker missing from readiness.blockers is refused', () => {
  const pkg = load();
  pkg.readiness.blockers = ['ASM-001'];
  assert.ok(checkReadiness(pkg).some((f) => f.includes('blockers missing') && f.includes('Q-001')));
});

test('READY with an unconfirmed high-impact assumption is refused', () => {
  const pkg = load();
  pkg.status = 'READY_FOR_ARCHITECTURE';
  assert.ok(checkReadiness(pkg).some((f) => f.includes('high-impact assumptions') && f.includes('ASM-001')));
});

test('READY with an open conflict is refused', () => {
  const pkg = load();
  pkg.status = 'READY_FOR_ARCHITECTURE';
  pkg.conflicts.push({ id: 'CONFLICT-001', topic: 'approval', statements: ['A: all', 'B: under $1,000 auto'], status: 'open' });
  assert.ok(checkReadiness(pkg).some((f) => f.includes('open conflicts')));
});

test('the pass pair passes checkPackage end to end', () => {
  assert.deepEqual(checkPackage({ pkg: load(), md: loadMd() }), []);
});

test('schema findings short-circuit the deeper checks', () => {
  const pkg = load();
  delete pkg.readiness;
  const findings = checkPackage({ pkg, md: loadMd() });
  assert.ok(findings.some((f) => f.includes('readiness')));
  assert.ok(!findings.some((f) => f.includes('recomputed')));
});

test('a placeholder in the md is refused', () => {
  const findings = checkPackage({ pkg: load(), md: loadMd() + '\nTBD\n' });
  assert.ok(findings.some((f) => f.includes('placeholder')));
});

test('a missing required section is refused', () => {
  const md = loadMd().replace('## Part 4 — Acceptance Scenarios', '## Acceptance');
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('Part 4')));
});

test('QUICK depth requires only parts 1, 3 and 5', () => {
  const pkg = load();
  pkg.depth = 'QUICK';
  const md = loadMd()
    .replace(/## Part 2[\s\S]*?(?=## Part 3)/, '')
    .replace(/## Part 4[\s\S]*?(?=## Part 5)/, '')
    .replace('depth: STANDARD', 'depth: QUICK');
  const findings = checkPackage({ pkg, md });
  assert.ok(!findings.some((f) => f.includes('Part 2') || f.includes('Part 4')));
});

test('a json id absent from the md is refused', () => {
  const md = loadMd().replaceAll('ASM-001', 'ASM-0O1');
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('ASM-001') && f.includes('absent')));
});

test('an unknown id in the md is refused', () => {
  const md = loadMd() + '\nSee FR-042 for details.\n';
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('unknown id FR-042')));
});

test('a frontmatter status mismatch is refused', () => {
  const md = loadMd().replace('status: CLARIFICATION_REQUIRED', 'status: VALIDATED');
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('frontmatter status')));
});

test('a frontmatter readiness mismatch is refused', () => {
  const md = loadMd().replace('readiness: 73', 'readiness: 99');
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('frontmatter readiness')));
});

test('a frontmatter depth mismatch is refused', () => {
  const md = loadMd().replace('depth: STANDARD', 'depth: DEEP');
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('frontmatter depth')));
});

test('a dropped FR-001 is not masked by NFR-001 substring match', () => {
  const md = loadMd()
    .replace(/\| FR-001 \|[^\n]*\n/, '')
    .replace('(FR-001)', '(FR-002)');
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('FR-001') && f.includes('absent')));
});

test('a heading at eof with no trailing newline is an empty section', () => {
  const md = loadMd().replace(/## Part 5[\s\S]*$/, '## Part 5 — Readiness Report');
  const findings = checkPackage({ pkg: load(), md });
  assert.ok(findings.some((f) => f.includes('empty section') && f.includes('Part 5')));
});

test('a blank Part 4 section body is an empty section', () => {
  const md = loadMd().replace(
    /(## Part 4 — Acceptance Scenarios\n)[\s\S]*?(?=## Part 5)/,
    '$1\n\n',
  );
  assert.ok(checkPackage({ pkg: load(), md }).some((f) => f.includes('empty section') && f.includes('Part 4')));
});

const validate = fileURLToPath(new URL('../validate.mjs', import.meta.url));

test('validate --json without --md checks the JSON only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ba-json-only-'));
  const { pkg } = loadWorkflow();
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  assert.match(execFileSync('node', [validate, '--json', join(dir, 'r.json')], { encoding: 'utf8' }), /requirements package valid/);
  pkg.features[0].steps = ['WF-002:Nowhere'];
  writeFileSync(join(dir, 'r.json'), JSON.stringify(pkg));
  assert.throws(() => execFileSync('node', [validate, '--json', join(dir, 'r.json')], { stdio: 'pipe' }));
});

test('review and leftOut are no longer part of the package', () => {
  const { pkg, md } = loadWorkflow();
  pkg.leftOut = [{ id: 'FEAT-009' }];
  pkg.features[0].review = { answer: 'maybe', date: '2026-10-07' };
  assert.deepEqual(checkPackage({ pkg, md }), []);
  assert.doesNotMatch(renderScope(pkg), /Reviewed by PO|Left out in review/);
});
