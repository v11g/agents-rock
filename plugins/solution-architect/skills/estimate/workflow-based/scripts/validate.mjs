// Inputs findings plus, when --json is given, a byte-level check that the
// computed block equals a fresh recompute. estimation.md arrives in spec 3.
import { readFileSync } from 'node:fs';
import { loadMeasurements, resolveMeasurementsPath } from '../../shared/lib/measurements.mjs';
import { loadPair } from './lib/requirements.mjs';
import { checkWorkflowInputs } from './lib/schema.mjs';
import { computeWorkflowEstimation } from './lib/rollup.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

function checkComputed(inputs, req, jsonPath) {
  const est = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const measurements = loadMeasurements(resolveMeasurementsPath(inputs)).records;
  const fresh = computeWorkflowEstimation(inputs, req, measurements).computed;
  return JSON.stringify(est.computed) === JSON.stringify(fresh) ? [] : ['estimation.json: computed block differs from a fresh recompute — run compute.mjs'];
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs) { console.error('usage: validate.mjs --inputs estimation-inputs.json [--json estimation.json]'); process.exit(1); }
const { inputs, req } = loadPair(args.inputs);
const findings = checkWorkflowInputs(inputs, req);
if (!findings.length && args.json) findings.push(...checkComputed(inputs, req, args.json));
if (findings.length) { console.error(findings.join('\n')); process.exit(1); }
console.log('ok');
