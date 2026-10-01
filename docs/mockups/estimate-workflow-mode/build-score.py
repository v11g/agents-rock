# Score review mockup = v1 page CSS + engineering-feature body (score-review.body.html)
import pathlib, re
S = pathlib.Path(__file__).parent
v1 = (S / 'score-review.base.html').read_text()
head = v1[:v1.index('</style>')]
CSS = '''
/* capability map + links */
section.map .quiet { margin:.1rem 0 .6rem; }
.view { display:inline-flex; border:1px solid var(--rule); border-radius:.25rem; overflow:visible; background:var(--sheet); }
.view button { border:0; border-left:1px solid var(--rule); background:transparent; color:var(--ink-dim); font-size:.78rem; font-weight:600; padding:.3rem .75rem; cursor:pointer; }
.view button:first-child { border-left:0; }
.view button:hover { color:var(--ink); }
.view button[aria-pressed="true"] { background:var(--ink); color:var(--sheet); }
details.capsys { border-top:1px solid var(--rule); padding-top:.6rem; margin-top:.6rem; }
details.capsys summary { cursor:pointer; font-size:.82rem; font-weight:700; }
table.caps { width:100%; border-collapse:collapse; font-size:.82rem; margin:.5rem 0 .3rem; }
table.caps th { text-align:left; font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-dim); padding:.3rem .45rem; border-bottom:1px solid var(--rule); }
table.caps td { padding:.4rem .45rem; border-bottom:1px solid var(--grid); vertical-align:top; }
table.caps td:first-child { width:30%; } table.caps td:nth-child(2) { width:28%; }
table.caps tr[data-cap] { cursor:pointer; }
table.caps tr.hl td { background:var(--hi); }
table.caps tr.cur td { box-shadow:inset 0 2px 0 var(--hi-line), inset 0 -2px 0 var(--hi-line); }
table.caps tr.gap td { background:var(--mark-soft); }
table.caps tr.flash td { animation:flash 1.4s ease-out; }
.dim { color:var(--ink-dim); }
.chip.eng { cursor:pointer; border-color:var(--meter); }
.chip.hl { background:var(--hi); border-color:var(--hi-line); }
.gapnote { color:var(--mark); font-weight:700; font-size:.78rem; }
.ask { display:flex; flex-wrap:wrap; gap:.3rem .5rem; align-items:center; font-size:.78rem; }
.ask textarea { flex:1 1 100%; field-sizing:content; min-height:1.9rem; font-size:.8rem; padding:.25rem .4rem; border:1px solid var(--rule); border-radius:.2rem; background:var(--sheet); }
/* Builds: the link from this feature to the client's capabilities, tinted per system */
:root { --s1:#2f6fa3; --s2:#b5651d; --s3:#2f7d5b; --s4:#7b4fa8; }
@media (prefers-color-scheme:dark) { :root:not([data-theme="light"]) { --s1:#6fa8d6; --s2:#e09a5a; --s3:#6cc39a; --s4:#b190dc; } }
:root[data-theme="dark"] { --s1:#6fa8d6; --s2:#e09a5a; --s3:#6cc39a; --s4:#b190dc; }
.builds { margin-top:.55rem; padding:.5rem .65rem .55rem; border:1px solid var(--rule); border-left:3px solid var(--meter); border-radius:.3rem; background:var(--paper); }
.builds.none { border-color:var(--hi-line); border-left-color:var(--hi-line); border-style:dashed; border-left-style:solid; background:var(--hi); }
.bhead { font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-dim); margin-bottom:.4rem; }
.bhead b { color:var(--ink); }
.builds.none .bhead { color:var(--ink); margin-bottom:.35rem; }
.bhead .hint { text-transform:none; letter-spacing:0; font-weight:500; color:var(--ink-dim); margin-left:.25rem; }
.btags { display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; }
.cap { display:inline-flex; align-items:stretch; font-size:.78rem; border:1px solid var(--rule); border-left:3px solid var(--sc); border-radius:.3rem; background:var(--sheet); cursor:pointer; overflow:hidden; }
.cap > * { display:flex; align-items:center; padding:.18rem .45rem; }
.cap .cid { font-weight:700; font-size:.72rem; color:var(--sc); background:color-mix(in srgb, var(--sc) 12%, transparent); font-variant-numeric:tabular-nums; }
.cap .cname { font-weight:600; color:var(--ink); }
.cap .csys { font-size:.68rem; font-weight:600; color:var(--sc); padding-left:0; }
.cap button { all:unset; display:flex; align-items:center; cursor:pointer; color:var(--ink-dim); padding:0 .5rem; border-left:1px solid var(--grid); }
.cap button:hover { color:var(--mark); background:var(--mark-soft); }
.cap.added { box-shadow:0 0 0 1px var(--ok); }
.cap.added .cname::after { content:'new'; margin-left:.4rem; font-size:.62rem; font-weight:700; text-transform:uppercase; color:var(--ok); }
.cap.removed { opacity:.5; cursor:default; } .cap.removed .cname { text-decoration:line-through; }
.cap.hl { background:var(--hi); border-color:var(--hi-line); border-left-color:var(--sc); }
.builds select { font:inherit; font-size:.76rem; font-weight:600; color:var(--ink-dim); background:transparent; border:1px dashed var(--ink-dim); border-radius:.3rem; padding:.2rem .45rem; cursor:pointer; max-width:15rem; }
.builds select:hover { color:var(--ink); border-color:var(--ink); }
.note textarea { max-width:none; min-height:4.6rem; line-height:1.45; }
.feat.unasked .rail h3::after { content:' · not asked for'; font-family:var(--sans); font-size:.72rem; font-weight:600; color:var(--ink-dim); }
.warnbox.soft { background:var(--hi); color:var(--ink); }
/* nav: row 1 = system toggle + filters, row 2 = jump links; hints on hover */
nav.sys { flex-direction:column; align-items:stretch; gap:.45rem; }
nav.sys .navrow { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; }
nav.sys .filters { padding-left:1.5rem; }
nav.sys .navlbl { font-size:.68rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--ink-dim); margin:0 .2rem 0 0; cursor:help; border-bottom:1px dotted var(--ink-dim); }
nav.sys .cnt { font-variant-numeric:tabular-nums; opacity:.7; margin-left:.15rem; }
.seg button { font-size:.8rem; padding:.32rem .9rem; }
[data-tip] { position:relative; }
[data-tip]:hover::after, [data-tip]:focus-visible::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + .45rem); z-index:20; width:max-content; max-width:18rem;
  white-space:normal; text-transform:none; letter-spacing:0; font-size:.74rem; font-weight:500; line-height:1.4; color:var(--sheet); background:var(--ink); padding:.4rem .55rem; border-radius:.25rem; box-shadow:0 4px 14px #0003; pointer-events:none; }
nav.sys .filters [data-tip]:hover::after { left:auto; right:0; }
/* Built by: one row per component under the feature it builds */
.feat .builds { margin:.2rem 0 .1rem; }
.crows { display:flex; flex-direction:column; gap:.3rem; margin:.1rem 0 .45rem; }
.crow { display:grid; grid-template-columns:9.5rem minmax(12rem,1fr) auto auto auto; align-items:center; gap:.7rem; padding:.4rem .6rem; border:1px solid var(--grid); border-radius:.3rem; background:var(--sheet); font-size:.9rem; cursor:pointer; }
.crow .ccont { font-size:.76rem; font-weight:600; color:var(--ink-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.crow .cname { font-weight:600; }
.crow .calso { font-size:.82rem; color:var(--ink-dim); display:flex; flex-wrap:wrap; gap:.25rem; align-items:center; }
.crow .chrs { font-variant-numeric:tabular-nums; font-weight:700; }
.crow button { all:unset; cursor:pointer; color:var(--ink-dim); padding:0 .3rem; }
.crow button:hover { color:var(--mark); }
.crow.hl { background:var(--hi); border-color:var(--hi-line); }
.crow.added { box-shadow:0 0 0 1px var(--ok); } .crow.added .cname::after { content:' new'; font-size:.7rem; color:var(--ok); text-transform:uppercase; }
.crow.removed { opacity:.5; cursor:default; } .crow.removed .cname { text-decoration:line-through; }
.cmini { font-size:.74rem; font-weight:700; color:var(--sc); border:1px solid var(--rule); border-left:3px solid var(--sc); border-radius:.25rem; padding:0 .35rem; background:var(--paper); cursor:pointer; }
.cmini.hl { background:var(--hi); }
.bhead .arch { margin-left:.6rem; text-transform:none; letter-spacing:0; font-weight:600; }
.archlink { color:var(--ink); font-weight:600; text-transform:none; letter-spacing:0; text-decoration:underline; text-underline-offset:2px; }
.archlink:hover { color:var(--mark); }
@media (max-width:760px) { .crow { grid-template-columns:1fr auto; } .crow .ccont, .crow .calso { grid-column:1 / -1; } }
'''
body = (S / 'score-review.body.html').read_text()
anchor = re.search(r'^const ANCHOR = \{.*?\};?$', v1, re.S | re.M).group(0)
body = body.replace('/*ANCHOR*/', anchor).replace('/*ENG*/', (S / 'eng-data.js').read_text() + (S / 'cap-data.js').read_text())
src = head + CSS + (S / 'reading.css').read_text() + '</style>\n</head>\n<body>\n' + body
(S / 'score-review.src.html').write_text(src)
(S / 'score-review-mockup.html').write_text(src.replace('/*DATA*/', (S / 'score-data.js').read_text()))
print('ok', len(src))

# ---- Feature page of the final estimate: the same page read-only (FINAL), plus the price sections ----
est = (S / 'estimate.src.html').read_text()
cut = lambda a, b: est[est.index(a):est.index(b)]
FCSS = '''
:root { --c1:#44586a; --c2:#7d96ab; }
@media (prefers-color-scheme:dark) { :root:not([data-theme="light"]) { --c1:#bacdda; --c2:#8fa8bb; } }
:root[data-theme="dark"] { --c1:#bacdda; --c2:#8fa8bb; }
section.card { background:var(--sheet); border:1px solid var(--rule); padding:1.3rem 1.4rem; margin-bottom:1.4rem; scroll-margin-top:3.5rem; }
section.card h2 { margin-bottom:.2rem; }
.sec-lead { margin:0 0 1rem; color:var(--ink-dim); max-width:72ch; font-size:.84rem; }
section.card h3 { font-size:.74rem; letter-spacing:.07em; text-transform:uppercase; color:var(--ink-dim); margin:1.2rem 0 .5rem; font-weight:700; }
section.card .internal { all:unset; display:revert; }
.num { font-variant-numeric:tabular-nums; }
.head-ctl { display:flex; gap:.5rem; align-items:center; }
.view.pages a { display:inline-block; text-decoration:none; color:var(--ink-dim); background:var(--sheet); font-size:.78rem; font-weight:600; padding:.3rem .75rem; border-left:1px solid var(--rule); }
.view.pages a:first-child { border-left:0; }
.view.pages a[aria-current="page"] { background:var(--ink); color:var(--sheet); }
.bar { display:none; }
body { padding-bottom:3rem; }
.pinbar { bottom:1.2rem; }
''' + cut('/* summary */', '/* systems */') + cut('/* roadmap */', '/* internal-only').replace('repeat(3,minmax(0,1fr))', 'repeat(4,minmax(0,1fr))') + '''
.factor.ro .ro-n { font-family:var(--serif); font-size:1.6rem; font-weight:600; line-height:1.1; margin:.25rem 0 .3rem; font-variant-numeric:tabular-nums; }
.factor.ro .ro-n span { font-size:.8rem; color:var(--ink-dim); margin-left:.1rem; }
.factor.ro .ro-n.hot { color:var(--mark); }
body:not(.side-effort-on) .side-effort, body.side-effort-on .side-score { display:none !important; }
nav.sys .navrow:first-child { gap:.6rem; }
.effort { text-align:right; } .effort b { display:block; font-family:var(--serif); font-size:1.5rem; font-variant-numeric:tabular-nums; } .effort span { font-size:.74rem; color:var(--ink-dim); }
table.caps th.c, table.caps td.c { text-align:center; } table.caps td.r, table.caps th.r { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.flag { font-size:.75rem; color:var(--hi-line); font-weight:700; }
details.tasks { margin-top:.7rem; border:1px solid var(--grid); border-radius:.3rem; background:var(--paper); }
details.tasks summary { cursor:pointer; padding:.45rem .7rem; font-size:.76rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--ink-dim); }
details.tasks table { width:100%; border-collapse:collapse; font-size:.8rem; }
details.tasks th { text-align:left; font-size:.68rem; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-dim); padding:.3rem .7rem; border-top:1px solid var(--rule); }
details.tasks td { padding:.35rem .7rem; border-top:1px solid var(--grid); vertical-align:top; }
details.tasks .r { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
details.tasks td .dim { font-size:.72rem; }
.conf { font-size:.7rem; font-weight:700; } .conf.c-LOW { color:var(--mark); } .conf.c-MED { color:var(--hi-line); } .conf.c-HIGH { color:var(--ok); }
'''
fb = (S / 'score-review.body.html').read_text()
def rep(old, new):
    global fb
    assert fb.count(old) == 1, (fb.count(old), old[:70]); fb = fb.replace(old, new)
rep(fb[fb.index('<span class="mock">'):fb.index('</span>', fb.index('<span class="mock">')) + 7],
    '<span class="mock">MOCKUP — Sin Kowa component-based estimate: the signed-off score review, read-only, with tasks and hours</span>')
rep('<h1>Sin Kowa — score review <span class="internal">internal</span></h1>', '<h1>Sin Kowa — estimate <span class="internal">internal</span></h1>')
rep(fb[fb.index('<p class="sub">'):fb.index('</p>', fb.index('<p class="sub">')) + 4],
    '<p class="sub">Component-based view · 19 features in 4 systems, built by 22 components; systems · scores signed off in the score review · prices in USD</p>')
rep('    <button class="btn" id="theme" type="button">Dark</button>\n  </div>',
    '    <div class="head-ctl"><nav class="view pages" aria-label="Estimate view"><a href="estimate-mockup.html">Workflow-based</a><a href="estimate-feature-mockup.html" aria-current="page">Component-based</a></nav>\n    <button class="btn" id="theme" type="button">Dark</button></div>\n  </div>')
rep(fb[fb.index('<p class="lead">'):fb.index('</p>', fb.index('<p class="lead">')) + 4],
    '''<p class="lead">The engineer's view of the estimate: the signed-off score review, read-only, with the price on top. <b>Scoring</b> shows each feature's scores and price; <b>Effort</b> shows the components behind it, with their hours and tasks. The client sees the Workflow-based page.</p>
  <section class="card" id="summary"><h2>Summary</h2><p class="sec-lead">The price for this scope, from the features below.</p>
    <div class="headline" id="headline"></div><div class="buildup" id="buildup"></div></section>''')
rep('''  <details class="guide">''', '''  <section class="card" id="roadmap"><h2>Milestones</h2><p class="sec-lead">Each milestone lists the client's features it finishes. Its range is its share of the build applied to the project range.</p><div class="ms" id="ms"></div></section>
  <section class="card" id="register"><h2>Assumptions &amp; exclusions</h2><p class="sec-lead">Shared word for word with the proposal.</p>
    <div class="twocol"><div><h3>Assumptions</h3><ul id="assume"></ul></div><div><h3>Exclusions</h3><ul id="exclude"></ul></div></div></section>
  <section class="card" id="method"><h2>Method</h2><p class="sec-lead">Estimator v2: five weighted scores per feature price it on continuous bands; the project roll-up adds the work feature scoring never captures.</p>
    <div class="twocol"><div><h3>Project context factors</h3><table class="kv" id="ctx"></table></div><div><h3>Work outside the features</h3><table class="kv" id="ovh"></table></div></div>
    <div class="twocol"><div><h3>Contingency</h3><table class="kv" id="cont"></table></div><div><h3>Range</h3><table class="kv" id="rng"></table></div></div>
    <h3>Cross-check: the engineering work behind the price</h3><p class="sec-lead">If the implied rate sits far from what the team costs, the scores or the task list need another look.</p><table class="kv" id="xcheck" style="max-width:40rem"></table></section>
  <details class="guide">''')
rep('const FINAL = false; /*FINAL*/', 'const FINAL = true;')
rep('<span class="howto-page">You score the <b>features</b>; their scores set the price. The components under each feature show what will be built and carry no price of their own.</span>',
    '<span class="howto-page"><b>Scoring</b> shows each feature\'s scores and price; <b>Effort</b> the components behind it, with tasks and hours. The client sees the Workflow-based page, which shows features only.</span><span class="howto-page">Containers and components are the ones in the architecture document: <a class="archlink" href="architecture.html#panel-containers" target="_blank" rel="noopener">C2 containers ↗</a> · <a class="archlink" href="architecture.html#panel-components-api" target="_blank" rel="noopener">C3 Backend API components ↗</a> · <a class="archlink" href="architecture.html#6-core-components" target="_blank" rel="noopener">§6 Core components ↗</a></span>')
rollup = (S / 'rollup.js').read_text()
fb = fb.replace('/*ANCHOR*/', anchor).replace('/*ENG*/', (S / 'eng-data.js').read_text() + (S / 'final-data.js').read_text() + (S / 'cap-data.js').read_text()
  + '{ // price sections: the shared roll-up, block-scoped so its helpers do not collide with this page\'s\n' + rollup + 'renderSummary(); renderRoadmap(); renderMethod();\n}\n')
final = head.replace('<title>Sin Kowa — score review</title>', '<title>Sin Kowa — estimate (component-based)</title>') + CSS + FCSS + (S / 'reading.css').read_text() + '</style>\n</head>\n<body>\n' + fb
(S / 'estimate-feature-mockup.html').write_text(final.replace('/*DATA*/', (S / 'score-data.js').read_text()))
print('final ok', len(final))
