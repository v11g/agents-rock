// The workflow proposal's body and menu, rendered in Node from the page data
// (workflow-view.mjs), so the page script only draws diagrams and builds the
// downloads. Every value goes through esc().
import { escapeHtml as esc } from '../../../analyze-requirements/scripts/lib/md-render.mjs';

const para = (text) => (text ? `<p>${esc(text)}</p>` : '');
const cells = (tag, row) => row.map((c) => `<${tag}>${esc(c)}</${tag}>`).join('');
const table = (head, rows) => `<table><thead><tr>${cells('th', head)}</tr></thead><tbody>${rows.map((r) => `<tr>${cells('td', r)}</tr>`).join('')}</tbody></table>`;
const bullets = (items) => `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
const flowHtml = (f) => `<p class="flow-name">${esc(f.label)}</p><div class="diagram-shell"><div class="mermaid-canvas">${esc(f.code)}</div></div>`;

function scopeHtml({ scope }) {
  const head = scope.mapLabel ? ['System', scope.mapLabel] : ['System'];
  const rows = scope.systems.map((s) => (scope.mapLabel ? [s.name, s.map] : [s.name]));
  return `<section id="scope"><h2>Scope: what this proposal covers</h2>${para(scope.intro)}${table(head, rows)}${para(scope.outLine)}</section>`;
}

function systemHtml(s) {
  const features = table(['Feature', 'What it does'], s.features.map((f) => [f.name, f.does]));
  return `<section id="${s.anchor}" class="system"><h2><span class="sysno">System ${s.no}:</span> ${esc(s.name)}</h2>${para(s.purpose)}${para(s.extra)}${s.flows.map(flowHtml).join('')}${features}</section>`;
}

function closingHtml({ milestones, register, cost }) {
  const ms = table(['Milestone', 'Includes', 'What it demonstrates'], milestones.rows.map((m) => [m.title, m.includes, m.demonstrates]));
  const price = (label, value, note) => `<div><span>${esc(label)}</span><b>${esc(value)}</b><span>${esc(note)}</span></div>`;
  return `<section id="milestones"><h2>Milestones</h2>${para(milestones.lead)}${ms}</section>`
    + `<section id="register"><h2>Assumptions &amp; exclusions</h2>${para(register.lead)}<h3>Assumptions</h3>${bullets(register.assumptions)}<h3>Exclusions</h3>${bullets(register.exclusions)}</section>`
    + `<section id="cost"><h2>Cost estimate</h2>${para(cost.lead)}<div class="price">${price('Range', cost.range, cost.rangeNote)}${price('If one fixed number is needed', cost.single, cost.singleNote)}</div></section>`;
}

export function contentHtml(view) {
  return `<h1>${esc(view.title)}</h1><p class="byline">${esc(view.byline)}</p>${scopeHtml(view)}${view.systems.map(systemHtml).join('')}${closingHtml(view)}`;
}

export function navHtml(view) {
  const links = [['scope', 'Scope'], ...view.systems.map((s) => [s.anchor, `System ${s.no}: ${s.name}`]),
    ['milestones', 'Milestones'], ['register', 'Assumptions & exclusions'], ['cost', 'Cost estimate']];
  return links.map(([id, text]) => `<a href="#${id}">${esc(text)}</a>`).join('\n');
}
