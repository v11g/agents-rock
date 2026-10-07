// A workflow-mode proposal reads what the estimate already validated:
// estimation.json and the BA package it names. Loading re-runs the
// estimate's own validation, so a stale or hand-edited estimate never
// reaches a client page (spec 4 W6). Modules stay single-line-import: the
// page inlines some of them with their import lines stripped.
import { existsSync, readFileSync } from 'node:fs';
import { resolveRequirementsPath, loadRequirements } from '../../../estimate/workflow-based/scripts/lib/requirements.mjs';
import { pairFindings } from '../../../estimate/workflow-based/scripts/lib/pair-findings.mjs';
import { deriveFigures } from './figures.mjs';
import { checkProposalInputs } from './workflow-checks.mjs';

export const isWorkflow = (estimation) => estimation.inputs?.scopeMode === 'workflow';

function quotable(est) {
  try { deriveFigures(est); return []; } catch (e) { return [`cannot quote this estimate: ${e.message}`]; }
}

export function loadLead(estimationPath) {
  const est = JSON.parse(readFileSync(estimationPath, 'utf8'));
  const reqPath = resolveRequirementsPath(estimationPath, est.inputs);
  if (!reqPath || !existsSync(reqPath)) {
    return { est, req: null, findings: [`requirements.json not found (estimation.json names "${est.inputs.requirements}") — run the estimate skill in the lead folder`] };
  }
  const req = loadRequirements(reqPath);
  const findings = req.raw.scopeMode === 'workflow' ? [] : ['requirements.json is not in workflow scope mode'];
  findings.push(...pairFindings(est.inputs, req, estimationPath), ...quotable(est));
  return { est, req, findings };
}

export function loadInputs(path) {
  try {
    return { inputs: JSON.parse(readFileSync(path, 'utf8')), findings: [] };
  } catch (e) {
    return { inputs: null, findings: [`proposal-inputs.json: ${e.message}`] };
  }
}

// The lead first: the sentence checks need a valid estimate to know its milestones.
export function proposalFindings({ estimation, inputs }) {
  const lead = loadLead(estimation);
  const sent = loadInputs(inputs);
  const findings = [...lead.findings, ...sent.findings];
  if (!findings.length) findings.push(...checkProposalInputs({ inputs: sent.inputs, est: lead.est, req: lead.req }));
  return { findings, est: lead.est, req: lead.req, inputs: sent.inputs };
}
