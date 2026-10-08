// Builds assets/estimate-template.html (the Workflow-based page) from the
// approved mockup. Like build-template.mjs, every change to the mockup is a
// rep() below; build-pages.test.mjs pins the output to the committed asset.
// Usage: node build-workflow-template.mjs [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const M = at('../../../../../../docs/mockups/estimate-workflow-mode/');
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > 0 ? process.argv[outFlag + 1] : at('../assets/estimate-template.html');
let html = readFileSync(`${M}estimate.src.html`, 'utf8');

// A function replacement: the inserted scripts contain `$'`, which a string
// replacement would expand.
function rep(from, to) {
  const next = html.replace(from, () => to);
  if (next === html) throw new Error(`workflow template builder: nothing matched ${String(from).slice(0, 60)}`);
  html = next;
}

rep('<title>Sin Kowa — estimate</title>', '<title><!-- slot:TITLE --> — estimate</title>');
rep('</style>', `${readFileSync(`${M}reading.css`, 'utf8')}</style>`); // as build-workflow.py
rep('<body class="client">', '<body>'); // internal page (spec 3 E8): the client gets the proposal
rep(/<span class="mock">[^<]*<\/span>\s*\n/, '');
rep('<h1>Sin Kowa Digital Transformation — estimate', '<h1><!-- slot:TITLE --> — estimate');
rep(/<p class="sub">[^<]*<\/p>/, '<p class="sub" id="subline"></p>');
rep('<a href="estimate-mockup.html" aria-current="page">', '<a href="estimate.html" aria-current="page">');
rep('<a href="estimate-feature-mockup.html">Component-based</a>', '<a href="estimate-components.html">Component-based</a>');
rep('`estimate-feature-mockup.html#step=', '`estimate-components.html#step=');
rep('What Sin Kowa can use at the end of each milestone.', 'What the client can use at the end of each milestone.');
rep('<script type="module">\n/*DATA*/\n/*ENG*/\n/*ROLLUP*/', [
  '<script type="application/json" id="page-data"><!-- slot:DATA --></script>',
  '<script type="module">',
  readFileSync(at('./template/prelude.js'), 'utf8'),
  readFileSync(at('./template/view.js'), 'utf8'),
].join('\n'));
rep('renderSummary(); renderSystems(); renderBreakdown(); renderRoadmap(); renderMethod();', [
  "$('#subline').textContent = `${DATA.systems.length} systems · ${DATA.systems.reduce((n, s) => n + s.features.length, 0)} features · scope reviewed by the PO, scores reviewed internally · prices in ${PAGE.currency}`;",
  'viewSummary(PAGE.view); renderSystems(); renderBreakdown(); viewRoadmap(PAGE); viewMethod(PAGE.view);',
].join('\n'));

rep('diagrams need a connection in this mockup', 'diagrams need a connection');
rep('if (id) return { hit: fromFeat(id)', 'if (id && byId[id]) return { hit: fromFeat(id)'); // a milestone feature in no system has no diagram steps
rep('byId[id].sys.id === c.dataset.sys', 'byId[id]?.sys.id === c.dataset.sys');
// A system may have no workflow (BA 0.4.0): s.main is null, and nothing sets `missing`.
rep("${s.main.missing ? 'workflow suggested by us, confirmed by PO' : 'workflow from the PO\\'s document'}", "${s.main ? 'workflow from the PO\\'s document' : 'no workflow in the PO\\'s document'}");
rep('Each system has its workflows; each feature sits on the workflow steps it serves.', "A system has the workflows the PO's document draws; each feature sits on the steps it serves, or on none when its system has no workflow.");

writeFileSync(OUT, html);
console.log(OUT);
