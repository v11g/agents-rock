// Workflow-mode pages: estimate.html (Workflow-based) and
// estimate-components.html (Component-based), both internal, written into the
// lead's dist/ beside the architecture viewer. Validation runs first: an
// unvalidated estimate never renders (spec 3 W13).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPair } from './lib/requirements.mjs';
import { pairFindings } from './lib/pair-findings.mjs';
import { workflowHtml, componentsHtml } from './lib/page-html.mjs';
import { loadGuide } from '../../shared/lib/scoring.mjs';

const asset = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputs || !args.json || !args.out) {
  console.error('usage: render.mjs --inputs estimation-inputs.json --json estimation.json --out <lead>/dist');
  process.exit(1);
}
const { inputs, req } = loadPair(args.inputs);
const findings = pairFindings(inputs, req, args.json);
if (findings.length) { console.error(findings.join('\n')); process.exit(1); }
const est = JSON.parse(readFileSync(args.json, 'utf8'));
const assets = {
  template: asset('../assets/estimate-components.html'), guide: loadGuide(),
  mathSrc: asset('../../shared/lib/pricing.mjs'), xlsxSrc: asset('../../shared/assets/xlsx-export.js'),
  xlsxTemplate: readFileSync(new URL('../assets/estimator-system.xlsx', import.meta.url)).toString('base64'),
};
mkdirSync(args.out, { recursive: true });
writeFileSync(join(args.out, 'estimate.html'), workflowHtml({ est, req, template: asset('../assets/estimate-template.html') }));
writeFileSync(join(args.out, 'estimate-components.html'), componentsHtml({ est, req, assets }));
if (!existsSync(join(args.out, 'index.html'))) console.log('Architecture viewer not found in dist/ — C2/C3 links will not open until it is rendered.');
console.log(join(args.out, 'estimate.html'));
console.log(join(args.out, 'estimate-components.html'));
