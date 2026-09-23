import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hashText, sectionHashes, readState, writeState } from './lib/state.mjs';
import { docStatus } from './lib/drift.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';

// Same shape as drift.mjs: the list-consuming loop is extracted so the parser
// stays inside the two-level nesting limit.
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

// Null outside a repository: it is what tells the next run whether the git path
// is available at all.
function head(root) {
  try {
    const opts = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    return execFileSync('git', ['rev-parse', 'HEAD'], opts).trim();
  } catch {
    return null;
  }
}

// Sections only for ARCHITECTURE.md — it is the only file with a spine to cut
// on. An ADR carries the status that exempts it from being rewritten instead.
function entryFor(root, file) {
  const text = readFileSync(join(root, file), 'utf8');
  const entry = { hash: hashText(text) };
  if (file === 'ARCHITECTURE.md') entry.sections = sectionHashes(text);
  const status = /(^|\/)docs\/adr\//.test(file) ? docStatus(text) : null;
  if (status) entry.status = status;
  return entry;
}

// Taken from the package itself, so the record can never disagree with the
// document. --doc-version covers a run that did not rewrite ARCHITECTURE.md.
function docVersion(root, flag) {
  const arch = join(root, 'ARCHITECTURE.md');
  if (flag || !existsSync(arch)) return flag ?? null;
  return parseFrontmatter(readFileSync(arch, 'utf8')).data?.docVersion ?? null;
}

const args = parseArgs(process.argv.slice(2));
if (!args.state || !args.files.length) {
  console.error('usage: record.mjs --state <architecture-state.json> --files <path> [<path> …] [--doc-version <v>]');
  process.exit(1);
}

const root = dirname(args.state);
const { state } = readState(args.state);
const revision = (state?.revision ?? 0) + 1;
const written = Object.fromEntries(args.files.map((f) => [f, entryFor(root, f)]));

// Run this LAST, once every document is on disk: temp file then rename, so a
// crash leaves the state pointing at the previous consistent revision. Earlier
// entries are kept — the record covers everything this skill has written, not
// only the files this run rewrote.
writeState(args.state, {
  _generated: 'written by analyze-requirements — do not edit',
  revision,
  updated: new Date().toISOString(),
  docVersion: docVersion(root, args['doc-version']),
  gitCommit: head(root),
  files: { ...state?.files, ...written },
});

console.log(`recorded revision ${revision} — ${args.files.length} file(s)`);
