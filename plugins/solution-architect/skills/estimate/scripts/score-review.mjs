// Score review round-trip. --write turns the agent's draft into a CSV or an
// HTML review page; --read takes the edited CSV (or the page's feedback
// JSON) and prints the diff plus the re-anchored features for the agent to
// write into estimation-inputs.json. It scores nothing itself.
import { readFileSync, writeFileSync } from 'node:fs';
import { toCsv, fromCsv } from './lib/score-csv.mjs';
import { diffScores, applyDiff } from './lib/score-diff.mjs';
import { toHtml } from './lib/score-html.mjs';
import { loadGuide, guideTableHtml } from './lib/scoring.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const templatePath = new URL('../assets/scores-review-template.html', import.meta.url).pathname;
const mathPath = new URL('./lib/estimate-math.mjs', import.meta.url).pathname;
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

function write(args) {
  const draft = json(args.write);
  const out = args.format === 'html'
    ? toHtml({ draft, template: readFileSync(templatePath, 'utf8'), guideHtml: guideTableHtml(loadGuide()), mathSrc: readFileSync(mathPath, 'utf8') })
    : toCsv(draft);
  writeFileSync(args.out, out);
  console.log(args.out);
}

function read(args) {
  const draft = json(args.draft);
  const edited = args.read.endsWith('.json') ? json(args.read) : fromCsv(readFileSync(args.read, 'utf8'));
  const diff = diffScores(draft, edited);
  const features = applyDiff({ draft, diff, guide: loadGuide() });
  console.log(JSON.stringify({ diff, features }, null, 2));
}

function usage() {
  console.error('usage: score-review.mjs --write draft.json --format csv|html --out <file>\n       score-review.mjs --read <csv|feedback.json> --draft draft.json');
  process.exit(1);
}

// A missing --out or --draft would otherwise fail somewhere inside fs, and an
// unknown --format would silently write a CSV under the asked-for name.
const args = parseArgs(process.argv.slice(2));
if (args.write) {
  if (!args.out || (args.format && !['csv', 'html'].includes(args.format))) usage();
  write(args);
} else if (args.read) {
  if (!args.draft) usage();
  read(args);
} else usage();
