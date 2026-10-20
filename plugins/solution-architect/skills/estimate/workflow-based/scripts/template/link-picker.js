// "+ Link a component": a wide search box; typing filters by component or container name
const pickerHtml = (capId) => `<div class="lpick" data-lpick="${capId}"><input type="search" data-lpick-q placeholder="+ Link a component… type to filter" aria-label="Link a component" autocomplete="off"><div class="lpick-list hide" role="listbox"></div></div>`;
const pickOpt = (b) => `<div class="lpick-o" role="option" data-lpick-id="${b.id}">${esc(b.name)}${notAsked(b.id) ? '<span class="dim"> · builds nothing yet</span>' : ''}</div>`;
function pickList(capId, q) {
  const by = buildersOf(capId); const t = q.trim().toLowerCase();
  const hit = (b) => !by.includes(b.id) && `${b.name} ${b.container}`.toLowerCase().includes(t);
  const groups = [...new Set(COMPS.map((b) => b.container))].map((g) => [g, COMPS.filter((b) => b.container === g && hit(b))]).filter(([, bs]) => bs.length);
  if (!groups.length) return '<div class="lpick-none dim">No component matches</div>';
  return groups.map(([g, bs]) => `<div class="lpick-g">${esc(g)}</div>${bs.map(pickOpt).join('')}`).join('');
}
function openPick(inp) {
  const box = inp.closest('.lpick'); const list = $('.lpick-list', box);
  list.innerHTML = pickList(box.dataset.lpick, inp.value); list.classList.remove('hide');
  $('.lpick-o', list)?.classList.add('lpick-cur');
}
function movePick(list, d) {
  const os = [...list.querySelectorAll('.lpick-o')]; if (!os.length) return;
  const i = os.findIndex((o) => o.classList.contains('lpick-cur'));
  os.forEach((o) => o.classList.remove('lpick-cur'));
  const n = os[(i + d + os.length) % os.length]; n.classList.add('lpick-cur'); n.scrollIntoView({ block: 'nearest' });
}
function pickComp(capId, bid) { links[bid] = [...links[bid], capId]; relink(); }
function onPickKey(e) {
  const inp = e.target.closest?.('[data-lpick-q]'); if (!inp) return;
  const box = inp.closest('.lpick'); const list = $('.lpick-list', box); const cur = $('.lpick-o.lpick-cur', list);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.classList.contains('hide')) openPick(inp); else movePick(list, e.key === 'ArrowDown' ? 1 : -1); }
  if (e.key === 'Enter') { e.preventDefault(); if (cur && !list.classList.contains('hide')) pickComp(box.dataset.lpick, cur.dataset.lpickId); }
  if (e.key === 'Escape') { inp.value = ''; list.classList.add('hide'); }
}
const pickInput = (e) => e.target.closest?.('[data-lpick-q]');
document.addEventListener('focusin', (e) => { const q = pickInput(e); if (q) openPick(q); });
document.addEventListener('input', (e) => { const q = pickInput(e); if (q) openPick(q); });
document.addEventListener('focusout', (e) => { const q = pickInput(e); if (q) $('.lpick-list', q.closest('.lpick')).classList.add('hide'); });
document.addEventListener('keydown', onPickKey);
// mousedown would blur the box and close the list before the click lands
document.addEventListener('mousedown', (e) => { if (e.target.closest('.lpick-list')) e.preventDefault(); });
document.addEventListener('click', (e) => { const o = e.target.closest('.lpick-o'); if (o) pickComp(o.closest('.lpick').dataset.lpick, o.dataset.lpickId); });
// hovering a row moves the highlight, so mouse and keyboard never show two
document.addEventListener('mouseover', (e) => {
  const o = e.target.closest?.('.lpick-o'); if (!o) return;
  o.parentNode.querySelectorAll('.lpick-cur').forEach((x) => x.classList.remove('lpick-cur'));
  o.classList.add('lpick-cur');
});
