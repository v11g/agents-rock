// ---- price sections, shared by the Workflow-based and Component-based pages ----
// Every amount arrives computed in PAGE (scripts/lib/page-view.mjs); this
// formats and places them and prices nothing.
const viewMoney = (n) => `${PAGE.currency === 'USD' ? '$' : `${PAGE.currency} `}${Math.round(n).toLocaleString('en-US')}`;
const viewKv = (rows, sum) => rows.map(([a, b]) => `<tr><td>${a}</td><td class="r">${b}</td></tr>`).join('')
  + `<tr class="sum"><td>${sum[0]}</td><td class="r">${sum[1]}</td></tr>`;
function viewBuRow(r, max) {
  return `<div class="bu-row ${r.cls ?? ''}"><div class="lbl">${r.lbl}<small>${r.note}</small></div>
    <div class="bu-bar"><i style="left:${r.from / max * 100}%;width:${Math.max(0.4, (r.to - r.from) / max * 100)}%"></i></div><div class="amt">${r.amt}</div></div>`;
}
function viewHeadline(p) {
  $('#headline').innerHTML = `<div class="big"><span>Range to present</span><b>${viewMoney(p.presentLow)} – ${viewMoney(p.presentHigh)}</b><span>expected cost to worst realistic case</span></div>
    <div><span>If one fixed number is unavoidable</span><b>${viewMoney(p.singleNumber)}</b><span>confident figure (80% chance at or under)</span></div>
    <div><span>Expected cost</span><b>${viewMoney(p.p50)}</b><span>half the time lower, half higher</span></div>
    <div><span>Implied accuracy</span><b>±${Math.round(p.impliedAccuracy * 100)}%</b><span>under 30%: a ballpark you can quote</span></div>`;
}
function viewSummary(v) {
  const p = v.price; const base = p.adjustedBase; const out = base + p.overheads.amount;
  viewHeadline(p);
  const rows = [
    { lbl: 'Feature build', note: `${v.featureCount} scored features`, from: 0, to: p.featurePoints, amt: viewMoney(p.featurePoints) },
    { lbl: `× ${p.contextMultiplier.toFixed(2)} project context`, note: 'spec quality, decisions, compliance, familiarity', from: p.featurePoints, to: base, amt: `+${viewMoney(base - p.featurePoints)}` },
    { lbl: `+ ${Math.round(p.overheads.totalPct * 100)}% work outside features`, note: 'foundation, discovery, UX, QA, DevOps, docs, PM, integration', from: base, to: out, amt: `+${viewMoney(p.overheads.amount)}` },
    { lbl: `+ ${(p.contingencyRate * 100).toFixed(1)}% contingency`, note: 'known unknowns inside the agreed scope', from: out, to: p.p50, amt: `+${viewMoney(p.contingencyAmount)}` },
    { lbl: '= Expected cost', note: '', from: 0, to: p.p50, amt: viewMoney(p.p50), cls: 'total' },
    { lbl: 'Range to present', note: 'expected cost → worst realistic case, rounded up to 500', from: p.presentLow, to: p.presentHigh, amt: `${viewMoney(p.presentLow)}–${viewMoney(p.presentHigh)}`, cls: 'range' },
  ];
  $('#buildup').innerHTML = `<h3>How the price builds up</h3>${rows.map((r) => viewBuRow(r, p.presentHigh || 1)).join('')}`;
}
function viewMs(m) {
  const n = m.features.length;
  return `<div class="m"><div class="dim num">${n} feature${n === 1 ? '' : 's'} finished<span class="internal"> · ${m.components} components</span></div>
    <h4>${esc(m.title)}</h4>
    <div class="amt internal"><b>${viewMoney(m.low)}–${viewMoney(m.high)}</b> · ${Math.round(m.share * 100)}% of the build</div>
    <div>${m.features.map((f) => `<span class="chip" data-f="${esc(f.id)}" title="${esc(f.system ?? '')}">${esc(f.name)}</span>`).join('')}</div></div>`;
}
function viewRoadmap(page) {
  $('#ms').innerHTML = page.milestones.map(viewMs).join('');
  $('#assume').innerHTML = page.register.assumptions.map((a) => `<li>${esc(a)}</li>`).join('');
  $('#exclude').innerHTML = page.register.exclusions.map((a) => `<li>${esc(a)}</li>`).join('');
}
function viewContext(v) {
  $('#ctx').innerHTML = `<tr><th>Factor</th><th>Level</th><th class="r">Multiplier</th></tr>${v.context.map((c) =>
    `<tr><td>${esc(c.label)}</td><td>${c.level} · ${esc(c.anchor)}</td><td class="r">${c.multiplier.toFixed(2)}</td></tr>`).join('')}
    <tr class="sum"><td colspan="2">Composite (1 + sum of deviations, cap 2.5)</td><td class="r">${v.price.contextMultiplier.toFixed(2)}</td></tr>`;
}
function viewOverheads(v) {
  const o = v.price.overheads;
  $('#ovh').innerHTML = `<tr><th>Cost line</th><th class="r">% of base</th><th class="r">Amount</th></tr>${v.overheads.map((r) =>
    `<tr><td>${esc(r.label)}</td><td class="r">${Math.round(r.pct * 100)}%</td><td class="r">${viewMoney(r.amount)}</td></tr>`).join('')}
    <tr class="sum"><td>Total</td><td class="r">${Math.round(o.totalPct * 100)}%</td><td class="r">${viewMoney(o.amount)}</td></tr>`;
}
function viewMethod(v) {
  const p = v.price; const e = v.effort;
  viewContext(v); viewOverheads(v);
  $('#cont').innerHTML = viewKv([['Average uncertainty across features', v.avgUnc.toFixed(2)], ['Average risk across features', v.avgRisk.toFixed(2)],
    ['Rate: 5% + 2% × uncertainty + 2% × risk', `${(p.contingencyRate * 100).toFixed(1)}%`]], ['On build + outside work', viewMoney(p.contingencyAmount)]);
  $('#rng').innerHTML = viewKv([['Optimistic (20% chance at or under)', viewMoney(p.p20)], ['Expected cost', viewMoney(p.p50)],
    ['Confident (80%)', viewMoney(p.p80)], ['Worst realistic case (95%)', viewMoney(p.p95)]],
  ['Presented: expected → worst, rounded up to 500', `${viewMoney(p.presentLow)}–${viewMoney(p.presentHigh)}`]);
  $('#xcheck').innerHTML = viewKv([['Components', e.components], ['Tasks', e.tasks], ['Expected effort (agentic baselines)', `${Math.round(e.hours).toLocaleString('en-US')}h`]],
    ['Implied rate at the expected cost', e.rate === null ? '—' : `${viewMoney(e.rate)}/h`]);
}
