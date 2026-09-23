import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sectionTable } from './lib/tables.mjs';
import { mustRows, designCoverage, validationCoverage, evidenceCoverage, traceability, notes }
  from './lib/coverage.mjs';

// The four ratios the report prints. The agent judges the findings; these are
// numbers in a deliverable, so they are counted here and never by hand.
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
  }
  if (!args.arch) throw new Error('usage: coverage.mjs --arch <ARCHITECTURE.md> [--adr <dir>] [--plan <validation-plan.md>]');
  return args;
}

// Root and per-context ADR directories both hold decisions, and a review that
// reads only the root undercounts the denominator in exactly the repos that
// have the most decisions.
function adrTexts(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => readFileSync(join(e.parentPath ?? dir, e.name), 'utf8'));
}

function planRows(path) {
  if (!path || !existsSync(path)) return [];
  const md = readFileSync(path, 'utf8');
  const table = sectionTable(md, 'Validation plan') ?? sectionTable(md, 'Checks');
  return table?.rows ?? [];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const arch = readFileSync(args.arch, 'utf8');
  const rows = mustRows(sectionTable(arch, 'Quality Requirements & SLOs')
    ?? sectionTable(arch, 'Quality Requirements and SLOs'));
  const adrs = adrTexts(args.adr);
  const plan = planRows(args.plan);
  process.stdout.write(`${JSON.stringify({
    designCoverage: designCoverage(rows, adrs),
    validationCoverage: validationCoverage(rows, plan),
    executedEvidence: evidenceCoverage(plan),
    decisionTraceability: traceability(adrs),
    notes: notes(arch, args.adr ? adrs : undefined),
  }, null, 2)}\n`);
}

main();
