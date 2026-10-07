// Inputs findings plus, when --json is given, a byte-level check that the
// computed block equals a fresh recompute (lib/pair-findings.mjs).
import { loadPair } from './lib/requirements.mjs';
import { pairFindings } from './lib/pair-findings.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs) { console.error('usage: validate.mjs --inputs estimation-inputs.json [--json estimation.json]'); process.exit(1); }
const { inputs, req } = loadPair(args.inputs);
const findings = pairFindings(inputs, req, args.json);
if (findings.length) { console.error(findings.join('\n')); process.exit(1); }
console.log('ok');
