// scripts/lib/map-nodes.mjs
// new-lead-dashboard v3
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Everything the three skills write. What is left in the lead directory is what
// the human put there, which is exactly the evidence.
const GENERATED = new Set([
  'ARCHITECTURE.md', 'estimation.md', 'estimation.json', 'estimation-inputs.json',
  'proposal.md', 'proposal-figures.json', 'notes.md', 'brief.md', 'dist',
  'CONTEXT.md', 'CONTEXT-MAP.md', 'DOMAIN-OVERVIEW.md', 'threat-model.md', 'docs',
]);

// proposal.md plus every proposal-* variant (client, non-tech, ...) — all
// written by the proposal skill, so never evidence.
const isProposalMd = (name) => name.startsWith('proposal') && name.endsWith('.md');

// The dist/ pages the pipeline owns by name; every other html in dist/ becomes
// a generic page node unless a proposal-family md already claims it.
const NAMED_PAGES = { arch: 'index.html', estimate: 'estimate.html', proposal: 'proposal.html' };

const htmlFor = (md) => md.replace(/\.md$/, '.html');

// One readdir per directory; every builder below is a pure function over the
// two listings, carried in ctx: { id, src, names (lead dir), pages (dist/) }.
export async function leadNodes(id, dir, src) {
  const [entries, distEntries] = await Promise.all([
    readdir(dir, { withFileTypes: true }).catch(() => []),
    readdir(join(dir, 'dist'), { withFileTypes: true }).catch(() => []),
  ]);
  const ctx = {
    id,
    src,
    names: new Set(entries.map((e) => e.name)),
    pages: new Set(distEntries.filter((e) => e.isFile()).map((e) => e.name)),
  };
  const proposalMds = [...ctx.names].filter((n) => isProposalMd(n) && n !== 'proposal.md');
  const claimed = new Set([...Object.values(NAMED_PAGES), ...proposalMds.map(htmlFor)]);
  return [
    ...evidenceNodes(ctx, entries),
    ...docNodes(ctx),
    ...proposalMds.map((n) => docNode(ctx, { key: n, label: n, page: htmlFor(n), exists: true })),
    ...pageNodes(ctx, claimed),
  ];
}

function isEvidence(entry) {
  return !entry.name.startsWith('.')
    && !GENERATED.has(entry.name)
    && !entry.name.endsWith('.c4')
    && !isProposalMd(entry.name);
}

// Doc extensions the dashboard server serves from the lead root (serve.mjs DOC_RE).
const VIEWABLE_RE = /\.(?:md|txt|csv|json|pdf)$/;

function evidenceNodes(ctx, entries) {
  return entries.filter(isEvidence).map((entry) => ({
    id: `evidence-${entry.name}`,
    type: 'evidence',
    position: { x: 0, y: 0 },
    data: {
      label: entry.name,
      status: 'ready',
      href: entry.isFile() && VIEWABLE_RE.test(entry.name) ? `/leads/${ctx.id}/${entry.name}` : null,
      detail: null,
    },
  }));
}

function docNode(ctx, spec) {
  const href = spec.exists && ctx.pages.has(spec.page)
    ? `/leads/${ctx.id}/dist/${spec.page}` : null;
  return {
    id: spec.key,
    type: 'doc',
    position: { x: 0, y: 0 },
    data: { label: spec.label, status: spec.exists ? 'ready' : 'pending', href, detail: null },
  };
}

function docNodes(ctx) {
  return [
    docNode(ctx, { key: 'arch', label: 'Architecture', page: NAMED_PAGES.arch, exists: !!ctx.src.arch }),
    ...componentNodes(ctx.src.arch),
    docNode(ctx, { key: 'estimate', label: 'Estimate', page: NAMED_PAGES.estimate, exists: !!ctx.src.estimation }),
    ...scenarioNodes(ctx.src.estimation),
    docNode(ctx, { key: 'proposal', label: 'Proposal', page: NAMED_PAGES.proposal, exists: ctx.names.has('proposal.md') }),
  ];
}

// Any unclaimed page in dist/ is still a rendered deliverable: give it a
// clickable node beside the ones the pipeline knows by name.
function pageNodes(ctx, claimed) {
  return [...ctx.pages]
    .filter((name) => name.endsWith('.html') && !claimed.has(name))
    .map((name) => docNode(ctx, { key: `page-${name}`, label: name, page: name, exists: true }));
}

function sliceSection(archMd) {
  const start = archMd.match(/^##\s*6\..*$/m);
  if (!start) return '';
  const rest = archMd.slice(start.index + start[0].length);
  const end = rest.match(/^##\s/m);
  return end ? rest.slice(0, end.index) : rest;
}

function parseComponents(archMd) {
  if (!archMd) return [];
  const rows = sliceSection(archMd).split('\n').filter((l) => l.trim().startsWith('|'));
  return rows.slice(1)
    .filter((l) => !/^\|\s*-+\s*\|/.test(l.trim()))
    .map((l) => l.split('|')[1].trim().replace(/`/g, ''));
}

function componentNodes(archMd) {
  return parseComponents(archMd).map((name) => ({
    id: `component-${name}`,
    type: 'component',
    position: { x: 0, y: 0 },
    data: { label: name, status: 'ready', href: null, detail: null },
  }));
}

function scenarioNodes(est) {
  return (est?.scenarios ?? []).map((s) => ({
    id: `scenario-${s.id ?? s.name}`,
    type: 'scenario',
    position: { x: 0, y: 0 },
    data: { label: s.label ?? s.plan ?? String(s.id ?? s.name), status: 'ready', href: null, detail: null },
  }));
}
