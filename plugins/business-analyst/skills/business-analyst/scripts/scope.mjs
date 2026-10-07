import { readFileSync, writeFileSync } from 'node:fs';
import { collectIds } from './lib/checks.mjs';
import { scopeIds } from './lib/scope-rules.mjs';
import { checkScope } from './lib/scope-checks.mjs';
import { applyScope, checkMarkers } from './lib/scope-md.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const pkg = JSON.parse(readFileSync(args.json, 'utf8'));
const md = readFileSync(args.md, 'utf8');
const findings = [...checkScope(pkg, new Set([...collectIds(pkg), ...scopeIds(pkg)])), ...checkMarkers(md)];
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
writeFileSync(args.md, applyScope(md, pkg));
console.log(`scope written (${pkg.scopeMode ?? 'classic'})`);
