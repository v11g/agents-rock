import { readFileSync, writeFileSync } from 'node:fs';
import { normalize, closestSentence } from './lib/validate-quotes.mjs';

// Gate between extraction and the interview (references/extract.md): a fact
// whose quote is not in its file never reaches the main agent as `stated`.
// Misses go back to their extract agent once; what still misses is dropped.

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].slice(2)] = argv[i + 1];
  return args;
}

function readSource(path, cache) {
  if (!cache.has(path)) {
    try { cache.set(path, readFileSync(path, 'utf8')); } catch { cache.set(path, null); }
  }
  return cache.get(path);
}

function missOf(fact, cache) {
  if (!normalize(fact.quote ?? '')) return { ...fact, closest: 'empty quote' };
  const text = readSource(fact.path, cache);
  if (text === null) return { ...fact, closest: `file not readable: ${fact.path}` };
  if (normalize(text).includes(normalize(fact.quote))) return null;
  return { ...fact, closest: closestSentence(text, fact.quote) };
}

const args = parseArgs(process.argv.slice(2));
const { facts } = JSON.parse(readFileSync(args.facts, 'utf8'));
const cache = new Map();
const checked = facts.map((f) => ({ fact: f, miss: missOf(f, cache) }));
const kept = checked.filter((c) => !c.miss).map((c) => c.fact);
const misses = checked.filter((c) => c.miss).map((c) => c.miss);

for (const m of misses) console.log(`MISS [${m.src}] "${m.quote}" — closest: "${m.closest}"`);
console.log(`ok ${kept.length} quotes verified, ${misses.length} missed`);
writeFileSync(args.out, JSON.stringify({ facts: kept, misses }, null, 2));
process.exit(misses.length ? 1 : 0);
