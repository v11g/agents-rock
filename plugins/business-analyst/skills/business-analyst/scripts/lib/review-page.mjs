// Draws the read-only review page (spec R1): requirements.json in the shape
// of the PO's own document, static HTML, no script. The template holds the
// styles; two slots take the title and the body. A slot missing or doubled
// throws, so a template edit can never ship a page without its content.
import { readFileSync } from 'node:fs';
import { pageData } from './review-data.mjs';
import { layout } from './review-layout.mjs';

const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const TAG = '<span class="tag">★ New</span> ';
const src = (added) => `<span class="src">Added: ${esc(added)}</span>`;
const asset = (name) => readFileSync(new URL(`../../assets/${name}`, import.meta.url), 'utf8');

const cell = (area, cls, html) => `<div class="${cls}" style="grid-area:${area}">${html}</div>`;
const area = (row, col, span) => (span > 1 ? `${row}/${col}/auto/span ${span}` : `${row}/${col}`);
const wide = (cls, span) => (span > 1 ? `${cls} wide` : cls);

const stepCells = (lanes) => lanes.flatMap((l, i) => [...(i ? [cell(`1/${l.col - 1}`, 'arrow', '→')] : []),
  cell(area(1, l.col, l.span), wide('step', l.span), esc(l.name))]);

// Depth d: connector (line, label, arrowhead) in row 2d, the box in row 2d + 1.
const branchCells = ({ b, depth, col, span }) => [
  cell(area(2 * depth, col, span), 'down', b.label ? `<span class="lbl">${esc(b.label)}</span>` : ''),
  b.back ? cell(area(2 * depth + 1, col, span), 'step back', `↺ back to ${esc(b.to)}`)
    : cell(area(2 * depth + 1, col, span), wide('step alt', span), esc(b.to))];

function flowHtml(w) {
  const s = w.sub;
  const name = s ? 'Sub-workflow' : 'Main workflow';
  const sub = s ? ` — starts at ${esc(s.startsAt)}${s.rejoins ? `, rejoins ${esc(s.rejoins)}` : ''}${s.share ? ` · ${esc(s.share)}` : ''}` : '';
  const { lanes, boxes } = layout(w.steps, w.branches);
  return [`<p class="flow-name">${name} · ${esc(w.name)}${sub}</p>`, '<div class="flow">', '<div class="grid">',
    ...stepCells(lanes), ...boxes.flatMap(branchCells), '</div>', '</div>'].join('\n');
}

function featureRow(f) {
  if (!f.added) return `<tr><td>${esc(f.name)}</td><td>${esc(f.does)}</td></tr>`;
  return `<tr class="new"><td>${TAG}${esc(f.name)}${src(f.added)}</td><td>${esc(f.does)}</td></tr>`;
}

function systemHtml(s, i) {
  return ['<section>', `<h2><span class="sysno">System ${i + 1}:</span> ${esc(s.name)}</h2>`, `<p>${esc(s.purpose)}</p>`, ...s.flows.map(flowHtml),
    '<table>', '<tr><th>Feature</th><th>What it does</th></tr>', ...s.features.map(featureRow), '</table>', '</section>'].join('\n');
}

function assumptionsHtml(list) {
  if (!list.length) return [];
  const li = (a) => (a.added ? `<li class="new">${TAG}${esc(a.text)}${src(a.added)}</li>` : `<li>${esc(a.text)}</li>`);
  return ['<section>', '<h2>Assumptions</h2>', '<ul>', ...list.map(li), '</ul>', '</section>'];
}

function summary(d) {
  const feats = d.systems.flatMap((s) => s.features);
  const fresh = [...feats, ...d.assumptions].filter((r) => r.added).length;
  const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const parts = [n(d.systems.length, 'system'), n(feats.length, 'feature'), n(d.assumptions.length, 'assumption')];
  return parts.join(' · ') + (fresh ? ` · ${TAG}${fresh} added in interview` : '');
}

export function bodyHtml(d) {
  return ['<header>', `<h1>${esc(d.title)}</h1>`, `<p class="byline">Requirements review · ${esc(d.date)} · read-only</p>`,
    `<p class="summary">${summary(d)}</p>`, '</header>', ...d.systems.map(systemHtml), ...assumptionsHtml(d.assumptions)].join('\n');
}

function fill(template, slot, value) {
  const parts = template.split(slot);
  if (parts.length !== 2) throw new Error(`template slot ${slot} must appear once`);
  return parts.join(value);
}

export function fillPage(template, title, body) {
  return fill(fill(template, '<!--@TITLE@-->', esc(title)), '<!--@BODY@-->', body);
}

export function pageHtml(pkg, date) {
  const d = pageData(pkg, date);
  return fillPage(asset('review-page.html'), d.title, bodyHtml(d));
}
