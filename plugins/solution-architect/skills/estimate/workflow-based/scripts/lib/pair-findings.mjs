// One validation for validate.mjs and render.mjs: the inputs' shape, then a
// byte-level check that estimation.json's computed block is a fresh recompute.
import { readFileSync } from 'node:fs';
import { loadMeasurements, resolveMeasurementsPath } from '../../../shared/lib/measurements.mjs';
import { checkWorkflowInputs } from './schema.mjs';
import { computeWorkflowEstimation } from './rollup.mjs';

function checkComputed(inputs, req, jsonPath) {
  const est = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const measurements = loadMeasurements(resolveMeasurementsPath(inputs)).records;
  const fresh = computeWorkflowEstimation(inputs, req, measurements).computed;
  return JSON.stringify(est.computed) === JSON.stringify(fresh) ? [] : ['estimation.json: computed block differs from a fresh recompute — run compute.mjs'];
}

export function pairFindings(inputs, req, jsonPath) {
  const findings = checkWorkflowInputs(inputs, req);
  if (!findings.length && jsonPath) findings.push(...checkComputed(inputs, req, jsonPath));
  return findings;
}
