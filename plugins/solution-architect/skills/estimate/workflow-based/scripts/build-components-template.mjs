// Builds assets/estimate-components.html (the Component-based page) from the
// score-review template: the same page read-only (FINAL), plus tasks and
// hours, the price sections and the workbook export — what the mockup's
// build-score.py does for estimate-feature-mockup.html. Every change is a
// rep(); build-pages.test.mjs pins the output. Usage: node build-components-template.mjs [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const M = at('../../../../../../docs/mockups/estimate-workflow-mode/');
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > 0 ? process.argv[outFlag + 1] : at('../assets/estimate-components.html');
let html = readFileSync(at('../assets/score-review.html'), 'utf8');
const py = readFileSync(`${M}build-score.py`, 'utf8');
const est = readFileSync(`${M}estimate.src.html`, 'utf8');

// `to` may be a function; a string is wrapped so `$'` in inserted scripts is never expanded.
function rep(from, to) {
  const next = html.replace(from, typeof to === 'function' ? to : () => to);
  if (next === html) throw new Error(`components template builder: nothing matched ${String(from).slice(0, 60)}`);
  html = next;
}
function between(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`components template builder: no ${start}`);
  return src.slice(a + start.length, b);
}
// The final page's CSS, exactly as build-score.py assembles FCSS.
const cut = (a, b) => est.slice(est.indexOf(a), est.indexOf(b));
const fcss = between(py, "FCSS = '''", "'''") + cut('/* summary */', '/* systems */')
  + cut('/* roadmap */', '/* internal-only').replace('repeat(3,minmax(0,1fr))', 'repeat(4,minmax(0,1fr))')
  + between(py, "repeat(4,minmax(0,1fr))') + '''", "'''");

rep('</style>', `${fcss}</style>`);
rep('<title><!-- slot:TITLE --> — score review</title>', '<title><!-- slot:TITLE --> — estimate (component-based)</title>');
rep('<h1><!-- slot:TITLE --> — score review', '<h1><!-- slot:TITLE --> — estimate');
rep(/<p class="sub">After the PO's scope review · <span id="subcount"><\/span>[^<]*<\/p>/,
  '<p class="sub">Component-based view · <span id="subcount"></span> · scores signed off in the score review</p>');
rep('    <button class="btn" id="theme" type="button">Dark</button>\n  </div>',
  '    <div class="head-ctl"><nav class="view pages" aria-label="Estimate view"><a href="estimate.html">Workflow-based</a><a href="estimate-components.html" aria-current="page">Component-based</a></nav>\n    <button class="btn" id="theme" type="button">Dark</button></div>\n  </div>');
rep(/<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">The engineer's view of the estimate: the signed-off score review, read-only, with the price on top. <b>Scoring</b> shows each feature's scores and price; <b>Effort</b> shows the components behind it, with their hours and tasks. The client receives the proposal.</p>
  <section class="card" id="summary"><h2>Summary</h2><p class="sec-lead">The price for this scope, from the features below.</p>
    <div class="headline" id="headline"></div><div class="buildup" id="buildup"></div>
    <p><button class="btn" id="xlsx" type="button" title="every feature as the v2 estimator workbook">download xlsx</button> <span class="quiet">Adjust stack familiarity or any score in the workbook; it reprices itself.</span></p></section>`);
rep('  <details class="guide">', `  <section class="card" id="roadmap"><h2>Milestones</h2><p class="sec-lead">Each milestone lists the client's features it finishes. Its range is its share of the build applied to the project range.</p><div class="ms" id="ms"></div></section>
  <section class="card" id="register"><h2>Assumptions &amp; exclusions</h2><p class="sec-lead">Shared word for word with the proposal.</p>
    <div class="twocol"><div><h3>Assumptions</h3><ul id="assume"></ul></div><div><h3>Exclusions</h3><ul id="exclude"></ul></div></div></section>
  <section class="card" id="method"><h2>Method</h2><p class="sec-lead">Estimator v2: five weighted scores per feature price it on continuous bands; the project roll-up adds the work feature scoring never captures.</p>
    <div class="twocol"><div><h3>Project context factors</h3><table class="kv" id="ctx"></table></div><div><h3>Work outside the features</h3><table class="kv" id="ovh"></table></div></div>
    <div class="twocol"><div><h3>Contingency</h3><table class="kv" id="cont"></table></div><div><h3>Range</h3><table class="kv" id="rng"></table></div></div>
    <h3>Cross-check: the engineering work behind the price</h3><p class="sec-lead">If the implied rate sits far from what the team costs, the scores or the task list need another look.</p><table class="kv" id="xcheck" style="max-width:40rem"></table></section>
  <details class="guide">`);
rep(/<span class="howto-page">You score the <b>features<\/b>[\s\S]*?<\/span>/,
  '<span class="howto-page"><b>Scoring</b> shows each feature&#39;s scores and price; <b>Effort</b> the components behind it, with tasks and hours. Containers and components are the ones in the architecture document: <a class="archlink" href="index.html#panel-containers" target="_blank" rel="noopener">C2 containers ↗</a></span>');
rep('const FINAL = false;', 'const FINAL = true;');
rep('const TASKS = {};', 'const TASKS = PAGE.tasks;');
rep('const pert = ([, o, m, pp]) => (o + 4 * m + pp) / 6;', 'const pert = (x) => x[2]; // expected hours from estimation.json (agentic baselines)');
rep('<th class="r">O / M / P h</th>', '<th class="r">Low / Expected / High h</th>');
rep(/draw\(\)\.then\(\(\) => \{ if \(FINAL\) setTimeout\(pinFromHash, 150\); \}\);\n/, (m) => `${m}${readFileSync(at('./template/view.js'), 'utf8')}
viewSummary(PAGE.view); viewRoadmap(PAGE); viewMethod(PAGE.view);
const XLSX_SOURCE = {
  rows: () => PAGE.xlsx.rows, container: (row) => row.container, levels: () => PAGE.xlsx.levels,
  template: () => PAGE.xlsx.template, system: (row) => row.system, // the SYSTEM / MODULE workbook (estimator-system.xlsx)
  register: () => PAGE.xlsx.register, // project name, assumptions, exclusions
};
{ // the shared workbook export, block-scoped so its helpers never collide with this page's
<!-- slot:XLSX -->
}
$('#xlsx').onclick = () => { window.__downloadXlsx(); $('#xlsx-remind').showModal(); }; // the download runs on; the reminder shows meanwhile
`);

// After the download: the Roll-up tab holds what the scores never price.
rep('<dialog id="dlg">', `<dialog id="xlsx-remind" aria-labelledby="xlsx-remind-title" style="max-width:32rem"><p><b id="xlsx-remind-title">Review the Project Roll-up tab</b></p>
  <p>The workbook's last tab, Project Roll-up, sets the project context levels, the work outside features (foundation, QA, DevOps, PM…) and contingency. These change the final cost. Review and update them before you use the workbook's price.</p>
  <div class="dlg-foot"><form method="dialog"><button class="btn primary">Got it</button></form></div></dialog>
<dialog id="dlg">`);

writeFileSync(OUT, html);
console.log(OUT);
