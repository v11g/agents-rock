import { readFileSync, writeFileSync } from 'node:fs';
import { isPackage, baRows, isStated } from './lib/ba-package.mjs';

// Reads a business-analyst requirements.json into facts, split by the BA's
// label: `facts` may be cited `stated`, `proposed` never is
// (references/extract.md §2.2). No agent reads the package.

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].slice(2)] = argv[i + 1];
  return args;
}

function readPackage(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

const args = parseArgs(process.argv.slice(2));
const pkg = readPackage(args.json);
if (!isPackage(pkg)) {
  console.log(`FAIL ${args.json} is not a requirements package`);
  process.exit(1);
}
const rows = baRows(pkg).map((r) => ({ ...r, path: args.json }));
const facts = rows.filter(isStated);
const proposed = rows.filter((r) => !isStated(r));
writeFileSync(args.out, JSON.stringify({ facts, proposed }, null, 2));
console.log(`ok ${facts.length} confirmed facts, ${proposed.length} not confirmed (assumed or recommended)`);
