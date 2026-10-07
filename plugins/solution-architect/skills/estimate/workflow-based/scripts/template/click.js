function onEdit(e) {
  const b = e.target.closest('.pick button');
  if (b) { const { f, k } = b.dataset; cur[f][k] = +b.dataset.n; refresh(f); save(); return true; }
  const un = e.target.closest('[data-unlink]')?.dataset.unlink;
  if (un) { const [bid, c] = un.split(':'); links[bid] = links[bid].filter((x) => x !== c); relink(); return true; }
  const ask = e.target.closest('[data-ask-btn]')?.dataset.askBtn;
  if (ask) { asks[ask] = ''; relink(); $(`[data-ask="${ask}"]`)?.focus(); return true; }
  const unask = e.target.closest('[data-unask]')?.dataset.unask;
  if (unask) { delete asks[unask]; relink(); return true; }
  return false;
}
function onCards(cards) {
  sysFilter = cards === 'wf';
  if (!sysFilter) openSystem(null); // All: every card, every system collapsed
  if (sysFilter && !openSys) openSystem((DATA.systems.find((s) => s.features.some((c) => notBuilt(c.id))) || DATA.systems[0]).id);
  refresh(); if (sysFilter) $('#map').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function onNav(e) {
  const go = e.target.closest('[data-go]');
  if (go && $(`#c-${go.dataset.go}`).classList.contains('hide')) { filter = 'all'; sysFilter = false; refresh(); }
  const fl = e.target.closest('[data-filter]');
  if (fl) { filter = filter === fl.dataset.filter ? 'all' : fl.dataset.filter; refresh(); if (filter === 'unlinked') { lastC = null; nextItem(true); } }
  const sd = e.target.closest('[data-side]')?.dataset.side;
  if (sd) { side = sd; document.body.classList.toggle('side-effort-on', side === 'effort'); totals(); }
  const cards = e.target.closest('[data-cards]')?.dataset.cards;
  if (cards) onCards(cards);
}
document.addEventListener('click', (e) => { if (!onEdit(e)) onNav(e); });
