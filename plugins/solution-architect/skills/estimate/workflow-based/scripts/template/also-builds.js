// the other features a component builds: 3 or more fold to one chip and "…N more"
const ALSO_SHOWN = 1; const ALSO_FOLD = 3;
const alsoChip = (c, fold) => `<span class="cmini${fold ? ' more' : ''}" style="--sc:var(--s${sysNo(c)})" data-cap-chip="${c}" title="${esc(capById[c].name)}">${c}</span>`;
function alsoHtml(others) {
  if (!others.length) return '<span class="dim">only this feature</span>';
  const fold = others.length >= ALSO_FOLD;
  const chips = others.map((c, i) => alsoChip(c, fold && i >= ALSO_SHOWN)).join('');
  const more = fold ? `<button type="button" class="alsomore" data-also-more aria-expanded="false">…${others.length - ALSO_SHOWN} more</button>` : '';
  return `also builds ${chips}${more}`;
}
function toggleAlso(b) {
  const box = b.closest('.calso'); const open = box.classList.toggle('open');
  b.setAttribute('aria-expanded', String(open));
  b.textContent = open ? 'show less' : `…${box.querySelectorAll('.cmini.more').length} more`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-also-more]'); if (b) toggleAlso(b); });
