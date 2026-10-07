// Builds assets/score-review.html from the approved mockup sources. Slots
// replace the Sin Kowa data; every other change to the mockup is a rep()
// below, so a rebuild never silently undoes one (build-template.test.mjs
// pins the output to the committed asset). Usage: node build-template.mjs [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const M = at('../../../../../../docs/mockups/estimate-workflow-mode/');
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > 0 ? process.argv[outFlag + 1] : at('../assets/score-review.html');
const base = readFileSync(`${M}score-review.base.html`, 'utf8');
const py = readFileSync(`${M}build-score.py`, 'utf8');
const cssStart = py.indexOf("CSS = '''") + 9;
const css = py.slice(cssStart, py.indexOf("'''", cssStart));
let body = readFileSync(`${M}score-review.body.html`, 'utf8');

function rep(from, to) {
  const next = body.replace(from, to);
  if (next === body) throw new Error(`template builder: nothing matched ${String(from).slice(0, 60)}`);
  body = next;
}

// ---- data slots ----
rep(/\/\*DATA\*\/\s*\n\/\*ENG\*\//, [
  "const PAGE = JSON.parse(document.getElementById('page-data').textContent);",
  'const DATA = PAGE.data; const ENG = PAGE.eng; const IMPLEMENTS = PAGE.implements; const CAP_SCORES = PAGE.scores; const TASKS = {};',
].join('\n'));
rep('/*ANCHOR*/', 'const ANCHOR = PAGE.anchor;');
rep('const FINAL = false; /*FINAL*/', 'const FINAL = false;');
rep(/<span class="mock">[^<]*<\/span>\s*\n/, '');
rep('<h1>Sin Kowa — score review', '<h1><!-- slot:TITLE --> — score review');
rep(/19 features in 4 systems, built by 21 components/, '<span id="subcount"></span>');
rep('render(); CAPS.forEach((c) => paint(c.id));', "$('#subcount').textContent = `${CAPS.length} features in ${DATA.systems.length} systems, built by ${COMPS.length} components`;\nrender(); CAPS.forEach((c) => paint(c.id));");
rep('Review &amp; send →</button>', 'Review &amp; send →</button> <span class="quiet">You can reopen this page later; your changes stay in this browser.</span>');
rep('<script type="module">', '<script type="application/json" id="page-data"><!-- slot:DATA --></script>\n<script type="module">');
// saved edits belong to one baseline: a page rebuilt from changed inputs starts fresh
rep(/const STORE = `score-review:\$\{DATA\.project\}:v4`;/, 'const STORE = `score-review:${DATA.project}:v4:${PAGE.baseline}`;');

// ---- pricing: the shared module replaces the transcription ----
rep(/const WEIGHTS = \{[^\n]*\n(?:const BANDS = [^\n]*\n){1,2}[^\n]*\n?const weighted = [^\n]*\nconst bandFor = [^\n]*\n/, '<!-- slot:MATH -->\n');
rep('// ---- v2 pricing, transcribed from scripts/lib/pricing.mjs ----', '// ---- v2 pricing, inlined from shared/lib/pricing.mjs ----');
rep(/function price\(s\) \{\n[\s\S]*?\n\}\n/, 'const price = (s) => featurePrice(s);\n');

// ---- architecture links: from the roster, to the viewer beside the page (spec 3 E4) ----
rep(/\/\/ the architecture document holds the C4 views[^\n]*\n\/\/ \(C3 is the Backend API[^\n]*\nconst ARCH = 'architecture\.html';\nconst archLink = [\s\S]*?\.join\(' · '\); \};\n/,
  readFileSync(at('./template/arch-link.js'), 'utf8'));

// ---- the 22-line function gate (quality-gates.test.mjs) ----
// An apostrophe inside a template literal reads as a string quote to the gate.
rep("data-tip=\"Each feature's scores", 'data-tip="Each feature&#39;s scores');
rep("you can't send until each", 'you can&#39;t send until each');
rep(/document\.addEventListener\('click', \(e\) => \{\n  const b = e\.target\.closest\('\.pick button'\);[\s\S]*?\n  \}\n\}\);\n/,
  readFileSync(at('./template/click.js'), 'utf8'));
rep("  const count = { edits: CAPS.filter((c) => isChanged(c.id)).length,", "  repaintNav();\n}\nfunction repaintNav() {\n  const count = { edits: CAPS.filter((c) => isChanged(c.id)).length,");
rep('diagrams need a connection in this mockup', 'diagrams need a connection');

const head = base.slice(0, base.indexOf('</style>')).replace('<title>Sin Kowa — score review</title>', '<title><!-- slot:TITLE --> — score review</title>');
writeFileSync(OUT, `${head}${css}${readFileSync(`${M}reading.css`, 'utf8')}</style>\n</head>\n<body>\n${body}`);
console.log(OUT);
