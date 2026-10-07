import { readFileSync } from 'node:fs';
import { checkProposal } from './lib/checks.mjs';
import { isWorkflow } from './lib/workflow-lead.mjs';
import { validateWorkflow } from './lib/workflow-cli.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const estimation = JSON.parse(readFileSync(args.estimation, 'utf8'));
if (isWorkflow(estimation)) process.exit(validateWorkflow(args));
const md = readFileSync(args.md, 'utf8');
const findings = checkProposal({ md, estimation });
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log('proposal deliverable valid');
