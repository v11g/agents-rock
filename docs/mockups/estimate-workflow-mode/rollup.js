// ---- project roll-up (scripts/lib/pricing.mjs + project-price.mjs), shared by the Workflow and Build pages ----
// Priced from the features scored in the score review: the business piece is
// what gets scored. The components under them are structure: each feature lands
// in the milestone of its main component, and the components' tasks and hours
// are a cross-check on the price.
const RK = ['tech', 'size', 'deps', 'unc', 'risk'];
const LEVELS = { codebaseMaturity: [1, 'Greenfield'], stackFamiliarity: [2, 'Adjacent, some learning'], specQuality: [3, 'Outline or slide deck'],
  compliance: [2, 'Handles PII'], clientDecisions: [3, 'Committee sign-off'] };
const ASSUME = ['Sin Kowa nominates a single approver per system for consolidated feedback.',
  'The 24-hour pack-trigger rule, rush-order handling and item-allocation priority are finalised in a discovery phase at kickoff; scope assumes standard-path behaviour only.',
  'No existing system is migrated; the previously purchased, unused inventory system is retired, not integrated against.',
  'Ship-side order intake stays email/phone/fax; no change to those channels is in scope.',
  'InvoiceNow scope is a Peppol-ready data model only; a live Access Point connection is a separately priced follow-on.',
  'Client confirms warehouse WiFi or cellular coverage is adequate for phone-based scanning.'];
const EXCLUDE = ['Hosting, infrastructure and third-party subscription fees (billed to Sin Kowa directly).',
  'A live InvoiceNow/Peppol Access Point subscription and its transaction fees.', 'Dedicated handheld barcode scanner hardware (phone-based scanning assumed).',
  'Last-mile delivery/logistics visibility and all AMR/autonomous-vehicle systems.', 'Load testing, penetration testing and formal security audit.',
  'Post-launch support and maintenance, quoted separately.'];
const RW = { tech: 0.2, size: 0.1, deps: 0.2, unc: 0.3, risk: 0.2 };
const RBANDS = [{ tier: 'S', start: 5, end: 11.5, lo: 500, hi: 1500 }, { tier: 'M', start: 11.5, end: 17.5, lo: 1500, hi: 4000 },
  { tier: 'L', start: 17.5, end: 22.5, lo: 4000, hi: 10000 }, { tier: 'XL', start: 22.5, end: 25, lo: 10000, hi: 25000 }];
const CTX = { codebaseMaturity: [1.0, 1.1, 1.2, 1.45], stackFamiliarity: [1.0, 1.15, 1.35, 1.35], specQuality: [0.95, 1.0, 1.2, 1.45], compliance: [1.0, 1.15, 1.4, 1.4], clientDecisions: [1.0, 1.1, 1.25, 1.4] };
const CTX_LABEL = { codebaseMaturity: 'Codebase maturity', stackFamiliarity: 'Stack & domain familiarity', specQuality: 'Specification quality', compliance: 'Compliance & data sensitivity', clientDecisions: 'Client decision structure' };
const OVH = { 'Shared foundation & scaffolding': 0.12, 'Discovery & specification': 0.06, 'UX / UI design': 0.08, 'QA & user acceptance testing': 0.08,
  'DevOps, environments & release': 0.05, 'Documentation & handover': 0.03, 'Project management & client comms': 0.10 };
function featPrice(a) {
  const s = Object.fromEntries(RK.map((k, i) => [k, a[i]])); const score = RK.reduce((n, k) => n + s[k] * RW[k], 0) * 5;
  const b = RBANDS.reduce((x, c) => (score >= c.start ? c : x), RBANDS[0]);
  const point = b.lo + (Math.min(score, b.end) - b.start) / (b.end - b.start) * (b.hi - b.lo);
  const spread = 0.15 + Math.max(0, s.unc - 1) * 0.07 + Math.max(0, s.risk - 1) * 0.03;
  const flag = score >= 22.5 ? 'Deep estimate required' : spread >= 0.4 || point >= 6000 ? 'Deep estimate recommended' : '';
  return { ...s, score, tier: b.tier, point, spread, low: point * (1 - spread), high: point * (1 + spread), flag };
}
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const ceilTo = (n, st) => Math.ceil(n / st) * st;
const CAP_LIST = DATA.systems.flatMap((s) => s.features.map((c) => ({ ...c, sysName: s.name })));
const PRICED = CAP_LIST.map((c) => ({ ...c, p: featPrice(CAP_SCORES[c.id]) }));
const sub = PRICED.reduce((n, f) => n + f.p.point, 0);
const mult = Math.min(2.5, 1 + Object.entries(LEVELS).reduce((n, [k, [lv]]) => n + (CTX[k][lv - 1] - 1), 0));
const base = sub * mult;
const integ = Math.min(0.25, 0.02 * PRICED.length);
const ovhPct = Object.values(OVH).reduce((a, b) => a + b, 0) + integ;
const ovh = base * ovhPct;
const avg = (k) => PRICED.reduce((n, f) => n + f.p[k], 0) / PRICED.length;
const contRate = 0.05 + 0.02 * avg('unc') + 0.02 * avg('risk');
const cont = (base + ovh) * contRate;
const p50 = base + ovh + cont;
const sigma = Math.sqrt(PRICED.reduce((n, f) => n + (f.p.point * f.p.spread) ** 2, 0)) * p50 / sub;
const P = { p20: p50 - 0.84 * sigma, p80: p50 + 0.84 * sigma, p95: p50 + 1.645 * sigma };
const present = { low: ceilTo(p50, 500), high: ceilTo(P.p95, 500), single: ceilTo(P.p80, 500) };
// milestones: a client feature lands with its main builder, the engineering
// feature most specific to it (fewest other capabilities; earliest milestone on
// a tie), so shared work like Notifications does not drag everything to the end
const MS_ORDER = [...new Set(ENG.map((f) => f.milestone))].sort();
const buildersOf_ = (capId) => ENG.filter((f) => IMPLEMENTS[f.id]?.includes(capId));
const mainBuilder = (capId) => buildersOf_(capId).sort((a, b) => IMPLEMENTS[a.id].length - IMPLEMENTS[b.id].length || a.milestone.localeCompare(b.milestone))[0];
const capMilestone = (capId) => mainBuilder(capId)?.milestone;
// cross-check: the engineering hours behind the price
const pertH = ([, o, m, pp]) => (o + 4 * m + pp) / 6;
const ENG_HOURS = ENG.reduce((n, f) => n + Math.round((TASKS[f.id] || []).reduce((h, x) => h + pertH(x), 0)), 0); // per-feature rounded, as the cards show
const TASK_COUNT = ENG.reduce((n, f) => n + (TASKS[f.id] || []).length, 0);

function renderSummary() {
  $('#headline').innerHTML = `<div class="big"><span>Range to present</span><b>${money(present.low)} – ${money(present.high)}</b><span>expected cost to worst realistic case</span></div>
    <div><span>If one fixed number is unavoidable</span><b>${money(present.single)}</b><span>confident figure (80% chance at or under)</span></div>
    <div class="internal"><span>Expected cost</span><b>${money(p50)}</b><span>half the time lower, half higher</span></div>
    <div class="internal"><span>Implied accuracy</span><b>±${Math.round(sigma / p50 * 100)}%</b><span>under 30%: a ballpark you can quote</span></div>`;
  const max = present.high;
  const row = (lbl, note, from, to, amt, cls = '') => `<div class="bu-row ${cls}"><div class="lbl">${lbl}<small>${note}</small></div>
    <div class="bu-bar"><i style="left:${from / max * 100}%;width:${Math.max(0.4, (to - from) / max * 100)}%"></i></div><div class="amt">${amt}</div></div>`;
  $('#buildup').innerHTML = `<h3>How the price builds up</h3>
    ${row('Feature build', `${PRICED.length} scored features`, 0, sub, money(sub))}
    ${row(`× ${mult.toFixed(2)} project context`, 'spec quality, decisions, compliance, familiarity', sub, base, `+${money(base - sub)}`)}
    ${row(`+ ${Math.round(ovhPct * 100)}% work outside features`, 'foundation, discovery, UX, QA, DevOps, docs, PM, integration', base, base + ovh, `+${money(ovh)}`)}
    ${row(`+ ${(contRate * 100).toFixed(1)}% contingency`, 'known unknowns inside the agreed scope', base + ovh, p50, `+${money(cont)}`)}
    ${row('= Expected cost', '', 0, p50, money(p50), 'total')}
    ${row('Range to present', 'expected cost → worst realistic case, rounded up to $500', present.low, present.high, `${money(present.low)}–${money(present.high)}`, 'range')}`;
}
function renderRoadmap() {
  $('#ms').innerHTML = MS_ORDER.map((ms) => {
    const caps = CAP_LIST.filter((c) => capMilestone(c.id) === ms);
    const fs = ENG.filter((f) => f.milestone === ms); const sh = PRICED.filter((c) => capMilestone(c.id) === ms).reduce((n, c) => n + c.p.point, 0) / sub;
    return `<div class="m"><div class="dim num">${caps.length} feature${caps.length === 1 ? '' : 's'} finished<span class="internal"> · ${fs.length} components</span></div>
      <h4>${esc(ms.replace(/^M(\d) - /, '$1. '))}</h4><p class="demo">${esc(MS_TEXT[ms] || '')}</p>
      <div class="amt internal"><b>${money(present.low * sh)}–${money(present.high * sh)}</b> · ${(sh * 100).toFixed(0)}% of the build</div>
      <div>${caps.map((c) => `<span class="chip" data-f="${c.id}" title="${esc(c.sysName)}">${esc(c.name)}</span>`).join('')}</div></div>`; }).join('');
  $('#assume').innerHTML = ASSUME.map((a) => `<li>${esc(a)}</li>`).join('');
  $('#exclude').innerHTML = EXCLUDE.map((a) => `<li>${esc(a)}</li>`).join('');
}
function renderMethod() {
  $('#ctx').innerHTML = `<tr><th>Factor</th><th>Level</th><th class="r">Multiplier</th></tr>${Object.entries(LEVELS).map(([k, [lv, txt]]) =>
    `<tr><td>${CTX_LABEL[k]}</td><td>${lv} · ${esc(txt)}</td><td class="r">${CTX[k][lv - 1].toFixed(2)}</td></tr>`).join('')}
    <tr class="sum"><td colspan="2">Composite (1 + sum of deviations, cap 2.5)</td><td class="r">${mult.toFixed(2)}</td></tr>`;
  $('#ovh').innerHTML = `<tr><th>Cost line</th><th class="r">% of base</th><th class="r">Amount</th></tr>${Object.entries(OVH).map(([k, v]) =>
    `<tr><td>${k}</td><td class="r">${Math.round(v * 100)}%</td><td class="r">${money(base * v)}</td></tr>`).join('')}
    <tr><td>Cross-feature integration (2% × ${PRICED.length}, cap 25%)</td><td class="r">${Math.round(integ * 100)}%</td><td class="r">${money(base * integ)}</td></tr>
    <tr class="sum"><td>Total</td><td class="r">${Math.round(ovhPct * 100)}%</td><td class="r">${money(ovh)}</td></tr>`;
  $('#cont').innerHTML = `<tr><td>Average uncertainty across features</td><td class="r">${avg('unc').toFixed(2)}</td></tr><tr><td>Average risk across features</td><td class="r">${avg('risk').toFixed(2)}</td></tr>
    <tr><td>Rate: 5% + 2% × uncertainty + 2% × risk</td><td class="r">${(contRate * 100).toFixed(1)}%</td></tr>
    <tr class="sum"><td>On build + outside work (${money(base + ovh)})</td><td class="r">${money(cont)}</td></tr>`;
  $('#rng').innerHTML = `<tr><td>Optimistic (20% chance at or under)</td><td class="r">${money(P.p20)}</td></tr><tr><td>Expected cost</td><td class="r">${money(p50)}</td></tr>
    <tr><td>Confident (80%)</td><td class="r">${money(P.p80)}</td></tr><tr><td>Worst realistic case (95%)</td><td class="r">${money(P.p95)}</td></tr>
    <tr class="sum"><td>Presented: expected → worst, rounded up to $500</td><td class="r">${money(present.low)}–${money(present.high)}</td></tr>`;
  $('#xcheck').innerHTML = `<tr><td>Components</td><td class="r">${ENG.length}</td></tr><tr><td>Tasks</td><td class="r">${TASK_COUNT}</td></tr>
    <tr><td>Expected effort, (O + 4M + P) / 6 summed</td><td class="r">${Math.round(ENG_HOURS).toLocaleString('en-US')}h</td></tr>
    <tr class="sum"><td>Implied rate at the expected cost (${money(p50)} ÷ hours)</td><td class="r">${money(p50 / ENG_HOURS)}/h</td></tr>`;
}
