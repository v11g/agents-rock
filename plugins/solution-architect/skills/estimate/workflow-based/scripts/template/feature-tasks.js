// ---- components: tasks and hours, per feature (Component-based page only) ----
// TASKS[component]: [name, low, expected, high, confidence, assumptions, features].
// A task shared by k features counts 1/k of its hours on each card, so the
// cards add up to the project total.
const pert = (x) => x[2]; // expected hours from estimation.json (agentic baselines)
const hoursOf = (id) => Math.round((TASKS[id] || []).reduce((n, x) => n + pert(x), 0));
const tasksFor = (id, capId) => (TASKS[id] || []).filter((x) => x[6].includes(capId));
const hoursFor = (id, capId) => Math.round(tasksFor(id, capId).reduce((n, x) => n + pert(x) / x[6].length, 0));
const sysHours = (ids) => Math.round(COMPS.flatMap((b) => TASKS[b.id] || []).filter((x) => x[6].some((f) => ids.includes(f))).reduce((n, x) => n + pert(x), 0));
function sharedNote(x, capId) {
  const others = x[6].filter((f) => f !== capId);
  return others.length ? `<div class="dim">shared with ${others.map(esc).join(', ')} · 1/${x[6].length} of its hours counted here</div>` : '';
}
function taskRow(x, capId) {
  const note = x[5] ? `<div class="dim">${esc(x[5])}</div>` : '';
  return `<tr><td>${esc(x[0])}${note}${sharedNote(x, capId)}</td><td class="r">${x[1]} / ${x[2]} / ${x[3]}</td><td class="r"><b>${Math.round(pert(x))}h</b></td><td><span class="conf c-${x[4]}">${x[4]}</span></td></tr>`;
}
function tasksHtml(b, capId) {
  const ts = tasksFor(b.id, capId);
  return `<details class="tasks side-effort"><summary>${esc(b.name)} · ${ts.length} tasks · ${hoursFor(b.id, capId)}h for this feature</summary><table><tr><th>Task</th><th class="r">Low / Expected / High h</th><th class="r">Expected</th><th>Confidence</th></tr>${ts.map((x) => taskRow(x, capId)).join('')}</table></details>`;
}
