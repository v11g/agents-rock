// estimation-inputs.json (+ requirements.json) → estimation.json. Refuses on
// any schema finding so the computed truth never rests on a bad shape.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadMeasurements, resolveMeasurementsPath } from '../../shared/lib/measurements.mjs';
import { loadPair } from './lib/requirements.mjs';
import { checkWorkflowInputs } from './lib/schema.mjs';
import { computeWorkflowEstimation } from './lib/rollup.mjs';

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs || !args.out) {
  console.error('usage: compute.mjs --inputs estimation-inputs.json --out estimation.json');
  process.exit(1);
}
const { inputs, req } = loadPair(args.inputs);
const findings = checkWorkflowInputs(inputs, req);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
const measurements = loadMeasurements(resolveMeasurementsPath(inputs)).records;
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, `${JSON.stringify(computeWorkflowEstimation(inputs, req, measurements), null, 2)}\n`);
console.log(args.out);
