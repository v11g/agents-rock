// Structural limits every skill's scripts must hold. Shared by the three
// skills' quality-gates tests so the thresholds live in one place.
//
// A limit set with a key omitted skips that check — template JavaScript gets
// the per-function limits only, because a self-contained page is one file by
// design and can never meet a per-file line or function count.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LIMITS = { fileLines: 200, functions: 10, functionLines: 22, params: 3 };

// A rendered page is one self-contained file by design — it inlines its fonts and
// carries no external URL — so a per-file line or function count can never be met
// and would say nothing if it were. The per-function limits still apply.
export const TEMPLATE_LIMITS = { functionLines: 22, params: 3 };

// Braces inside a regex, string or comment are not structure. Counting them
// makes a short function measure long, and the overshoot runs on into whatever
// follows. Blank the literal out but keep its newlines, so spans stay accurate.
const blank = (m) => m.replace(/[^\n]/g, ' ');

// Order is load-bearing. Escape pairs go first, so an escaped slash or quote can
// never terminate the literal that contains it. Regex literals go before strings,
// because a character class may hold a quote or a backtick — md-inline.mjs:9 is a
// regex holding three backticks, and reading those as a template literal blanks
// twenty lines of real structure.
function stripLiterals(src) {
  return src
    .replace(/\\./g, '__')
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\/\/[^\n]*/g, blank)
    .replace(/([=(,:[!&|?;]\s*)(\/(?:\[[^\]\n]*\]|[^/\n])+\/[gimsuy]*)/g, (_, pre, re) => pre + blank(re))
    .replace(/'[^'\n]*'/g, blank)
    .replace(/"[^"\n]*"/g, blank)
    .replace(/`[^`]*`/g, blank);
}

// Measured in lines of code, not lines of text. The limit caps how much logic a
// reader holds at once, and a static HTML string or a comment block is neither —
// they arrive here already blanked, so a blank line is a line that carried none.
// A `function NAME(...)` match points before the parameter list, so the body
// brace is whatever `{` follows the parameter list's own balanced parens —
// not the first `{` after the match, which is the parameter list's own brace
// when the first parameter is destructured (`function f({ a, b }) {`).
function afterParams(code, from) {
  const parenOpen = code.indexOf('(', from);
  let depth = 0;
  for (let i = parenOpen; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    if (code[i] === ')') { depth -= 1; if (depth === 0) return i + 1; }
  }
  return parenOpen + 1;
}

function functionSpans(code) {
  const spans = [];
  const starts = [...code.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+\w+|=>\s*\{/g)];
  for (const m of starts) {
    const from = m[0].includes('function') ? afterParams(code, m.index) : m.index;
    const open = code.indexOf('{', from);
    let depth = 0; let end = code.length - 1;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      if (code[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    spans.push(code.slice(open, end + 1).split('\n').filter((l) => l.trim() !== '').length);
  }
  return spans;
}

function countParams(sig) {
  let depth = 0; let n = sig.trim() ? 1 : 0;
  for (const ch of sig) {
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) n += 1;
  }
  return n;
}

function paramCounts(src) {
  return [
    ...src.matchAll(/function\s+\w+\s*\(([^)]*)\)/g),
    ...src.matchAll(/\(([^)]*)\)\s*=>/g),
  ].map((m) => countParams(m[1]));
}

export function violations(src, limits = LIMITS) {
  const out = [];
  const code = stripLiterals(src);
  const lines = src.split('\n').length;
  if (limits.fileLines && lines > limits.fileLines) out.push(`${lines} lines (max ${limits.fileLines})`);
  const spans = functionSpans(code);
  if (limits.functions && spans.length > limits.functions) out.push(`${spans.length} functions (max ${limits.functions})`);
  for (const n of spans) {
    if (limits.functionLines && n > limits.functionLines) out.push(`function of ${n} lines (max ${limits.functionLines})`);
  }
  for (const n of paramCounts(code)) {
    if (limits.params && n > limits.params) out.push(`function with ${n} params (max ${limits.params})`);
  }
  return out;
}

export function moduleFiles(base, dirs) {
  return dirs.flatMap((d) => readdirSync(join(base, d), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(mjs|js)$/.test(e.name))
    .map((e) => join(base, d, e.name)));
}

// Keep every byte at its original offset — blank the markup, restore the script
// bodies in place — so a reported span still counts lines of the real file. The
// JSON data island is data, not code.
function scriptText(html) {
  let out = blank(html);
  for (const m of html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)) {
    const at = m.index + m[0].indexOf(m[1]);
    out = out.slice(0, at) + m[1] + out.slice(at + m[1].length);
  }
  return out;
}

export function templateScripts(base) {
  const dir = join(base, 'assets');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => ({ file: join(dir, e.name), js: scriptText(readFileSync(join(dir, e.name), 'utf8')) }));
}
