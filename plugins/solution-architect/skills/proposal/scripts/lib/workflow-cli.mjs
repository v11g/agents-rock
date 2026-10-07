// validate.mjs and render.mjs in workflow mode: estimation.json (with the
// BA package it names) plus proposal-inputs.json. Same rule as classic:
// render re-runs validation and writes nothing on a finding.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { proposalFindings } from './workflow-lead.mjs';
import { proposalView } from './workflow-view.mjs';
import { workflowPage } from './workflow-page.mjs';

const USAGE = {
  validate: 'usage: validate.mjs --estimation estimation.json --inputs proposal-inputs.json',
  render: 'usage: render.mjs --estimation estimation.json --inputs proposal-inputs.json --mermaid-bundle <path> --out <lead>/dist',
};

function report(findings) {
  console.error(findings.join('\n'));
  return 1;
}

export function validateWorkflow(args) {
  if (typeof args.inputs !== 'string') return report([USAGE.validate]);
  const { findings } = proposalFindings(args);
  if (findings.length) return report(findings);
  console.log('proposal inputs valid');
  return 0;
}

function readBundle(path) {
  if (typeof path !== 'string') return { error: '--mermaid-bundle is required (see analyze-requirements references/viewer.md §1)' };
  const bundle = readFileSync(path, 'utf8');
  if (bundle.includes('</script')) return { error: 'mermaid bundle carries a literal </script — rebuild it (analyze-requirements references/viewer.md §1)' };
  return { bundle };
}

export function renderWorkflow(args) {
  if (typeof args.inputs !== 'string' || typeof args.out !== 'string') return report([USAGE.render]);
  const { findings, ...lead } = proposalFindings(args);
  if (findings.length) return report(findings);
  const { bundle, error } = readBundle(args['mermaid-bundle']);
  if (error) return report([error]);
  mkdirSync(args.out, { recursive: true });
  const out = join(args.out, 'proposal.html');
  writeFileSync(out, workflowPage({ view: proposalView(lead), bundle }));
  console.log(out);
  return 0;
}
