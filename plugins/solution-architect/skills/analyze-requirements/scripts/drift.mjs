import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readState } from './lib/state.mjs';
import { classify, changedSections } from './lib/drift.mjs';
import { gitDiff } from './lib/git-diff.mjs';

// Same shape as validate.mjs: the list-consuming loop is extracted so the
// parser stays inside the two-level nesting limit.
function consumeFiles(argv, i, files) {
  while (argv[i + 1] && !argv[i + 1].startsWith('--')) files.push(argv[++i]);
  return i;
}

function parseArgs(argv) {
  const args = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--files') i = consumeFiles(argv, i, args.files);
    else if (flag.startsWith('--')) args[flag.slice(2)] = argv[++i];
  }
  return args;
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function detail(ctx, file) {
  const text = read(join(ctx.root, file));
  const diff = gitDiff({ root: ctx.root, file, since: ctx.state.gitCommit });
  if (diff) return diff.split('\n').map((l) => `    ${l}`).join('\n');
  const sections = changedSections(ctx.state.files[file], text);
  return `    changed: ${sections.map((n) => `§${n}`).join(', ') || 'whole file'}`;
}

function report(ctx, file) {
  const verdict = classify(ctx.state.files[file], read(join(ctx.root, file)));
  console.log(`${file}  ${verdict}`);
  if (verdict === 'drifted') console.log(detail(ctx, file));
  return verdict;
}

const args = parseArgs(process.argv.slice(2));
if (!args.state) {
  console.error('usage: drift.mjs --state <architecture-state.json> --files <path> [<path> …]');
  process.exit(1);
}

const { state, error } = readState(args.state);
if (error) console.log(`state file ${error}`);
// A first run is not halted, but it is still judged: with no entries every file
// already on disk reads as untracked, which is what keeps a hand-written
// package safe from the run that was pointed at it.
if (!state) console.log('first run — no state recorded, nothing is at risk');

const ctx = { root: dirname(args.state), state: { gitCommit: null, files: {}, ...state } };
const verdicts = args.files.map((f) => report(ctx, f));
process.exit(verdicts.includes('drifted') ? 2 : 0);
