import { readFileSync, writeFileSync } from 'node:fs';
import { deriveFigures } from './lib/figures.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const estimation = JSON.parse(readFileSync(args.estimation, 'utf8'));
let figures;
try {
  figures = deriveFigures(estimation);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
writeFileSync(args.out, `${JSON.stringify(figures, null, 2)}\n`);
console.log(args.out);
