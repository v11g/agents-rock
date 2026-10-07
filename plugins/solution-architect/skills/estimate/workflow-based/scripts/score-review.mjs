// Score review round-trip for workflow mode. --write renders the review page
// from inputs + the BA package; --read folds the page's feedback JSON back
// into scores, component links and asks. It scores nothing itself.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadPair } from './lib/requirements.mjs';
import { toHtml } from './lib/score-html.mjs';
import { readFeedback } from './lib/score-diff.mjs';
import { loadGuide } from '../../shared/lib/scoring.mjs';

const templatePath = new URL('../assets/score-review.html', import.meta.url).pathname;
const mathPath = new URL('../../shared/lib/pricing.mjs', import.meta.url).pathname;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

function requirePair(path) {
  const pair = loadPair(path);
  if (!pair.req) { console.error('requirements: file not found (inputs.requirements must point at the BA package)'); process.exit(1); }
  return pair;
}

function write(args) {
  const { inputs, req } = requirePair(args.write);
  const html = toHtml({ inputs, req, guide: loadGuide(), template: readFileSync(templatePath, 'utf8'), mathSrc: readFileSync(mathPath, 'utf8') });
  writeFileSync(args.out, html);
  console.log(args.out);
}

function read(args) {
  const { inputs } = requirePair(args.inputs);
  const feedback = JSON.parse(readFileSync(args.read, 'utf8'));
  console.log(JSON.stringify(readFeedback({ inputs, feedback, guide: loadGuide() }), null, 2));
}

const args = parseArgs(process.argv.slice(2));
if (args.write && args.out) write(args);
else if (args.read && args.inputs) read(args);
else {
  console.error('usage: score-review.mjs --write estimation-inputs.json --out review.html\n       score-review.mjs --read feedback.json --inputs estimation-inputs.json');
  process.exit(1);
}
