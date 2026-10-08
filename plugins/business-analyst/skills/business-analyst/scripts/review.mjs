// The read-only PO review page (spec R1–R3):
//   node review.mjs page --json requirements.json --out review.html [--date YYYY-MM-DD]
import { readFileSync, writeFileSync } from 'node:fs';
import { collectIds } from './lib/checks.mjs';
import { modeOf, scopeIds } from './lib/scope-rules.mjs';
import { checkScope } from './lib/scope-checks.mjs';
import { pageHtml } from './lib/review-page.mjs';
import { undecided, idLeaks } from './lib/review-data.mjs';

const USAGE = 'usage: review.mjs page --json <requirements.json> --out <review.html> [--date YYYY-MM-DD]';

function fail(findings) {
  console.error(findings.join('\n'));
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail([`${argv[i]}: needs a value`]);
    args[argv[i].slice(2)] = value;
    i += 1;
  }
  return args;
}

const pad = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Checks run in order and stop at the first that finds something: a broken
// scope cannot be drawn, so undecided items and ids wait for it.
function page(pkg, args) {
  if (modeOf(pkg) === 'classic') return console.log('classic mode: no review page');
  const checks = [() => checkScope(pkg, new Set([...collectIds(pkg), ...scopeIds(pkg)])), () => undecided(pkg), () => idLeaks(pkg)];
  for (const check of checks) {
    const findings = check();
    if (findings.length) fail(findings);
  }
  writeFileSync(args.out, pageHtml(pkg, args.date ?? today()));
  console.log(`review page written: ${args.out}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (cmd !== 'page') fail([USAGE]);
page(JSON.parse(readFileSync(args.json, 'utf8')), args);
