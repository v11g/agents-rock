import { readFileSync } from 'node:fs';
import { checkPackage } from './lib/checks.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const md = args.md ? readFileSync(args.md, 'utf8') : null;
const pkg = JSON.parse(readFileSync(args.json, 'utf8'));
const findings = checkPackage({ pkg, md });
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log('requirements package valid');
