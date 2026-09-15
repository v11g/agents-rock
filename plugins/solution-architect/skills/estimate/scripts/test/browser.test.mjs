import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';

const skip = { skip: !findChrome() && 'no chrome on PATH' };
const fixture = new URL('./fixtures/booking-inputs.json', import.meta.url).pathname;

function buildPage(extra = [], inputsPath = fixture) {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-browser-'));
  const scripts = new URL('..', import.meta.url).pathname;
  const passMd = join(scripts, 'test/fixtures/estimation-pass.md');
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', inputsPath, '--out', join(dir, 'estimation.json')]);
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', join(dir, 'estimation.json'), '--md', passMd, '--out', dir, ...extra]);
  return pathToFileURL(join(dir, 'estimate.html')).href;
}

// The booking inputs with a mutation applied, for pages whose shape depends
// on the scenarios.
function buildPageWith(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-browser-inputs-'));
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  mutate(inputs);
  writeFileSync(join(dir, 'inputs.json'), JSON.stringify(inputs));
  return buildPage([], join(dir, 'inputs.json'));
}



test('every section explains itself: help icons plus a rendered method section', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.ok(await page.eval(`document.querySelectorAll('details.help').length >= 5`),
      'expected a help icon per section');
    const method = await page.eval(`document.getElementById('method').textContent`);
    assert.match(method, /three-point-pert/); // technique named from inputs
    assert.match(method, /PERT/);
    assert.match(method, /atomicobject\.com/);
    // open by default: the method explains the page up front; still collapsible
    assert.equal(await page.eval(`document.querySelector('#method details.method-fold').open`), true);
    await page.eval(`document.querySelector('#method details.method-fold summary').click()`);
    assert.equal(await page.eval(`document.querySelector('#method details.method-fold').open`), false);
  } finally { page.close(); }
});

test('client view hides internals; theme toggle flips the root attribute', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`document.getElementById('view-toggle').click()`);
    assert.equal(await page.eval(
      `getComputedStyle(document.querySelector('#summary .alts')).display`), 'none');
    await page.eval(`document.getElementById('theme-toggle').click()`);
    assert.equal(await page.eval(`document.documentElement.dataset.theme`), 'light');
  } finally { page.close(); }
});

test('the --client-only page boots clean without its stripped controls', skip, async () => {
  const page = await openPage(buildPage(['--client-only']));
  try {
    assert.deepEqual(page.errors, []); // stripped nodes must be null-guarded, not assumed
    assert.equal(await page.eval(`document.getElementById('ctl-team')`), null);
    for (const id of ['summary', 'feature-table', 'register', 'method', 'roadmap', 'containers']) {
      assert.ok(await page.eval(`document.getElementById('${id}').children.length > 0`),
        `${id} empty on client-only page`);
    }
  } finally { page.close(); }
});

test('feature breakdown absorbs the effort chart and the task register', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.equal(await page.eval(`document.getElementById('timeline')`), null);
    const names = await page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row td:first-child')].map((c) => c.textContent.trim())`);
    assert.equal(names.length, 2);
    assert.match(names[0], /book appointment/); // hours desc by default
    assert.equal(await page.eval(`document.querySelectorAll('#feature-table .bd-fill').length`), 2);
    // per-feature confidence chip is the worst task confidence (booking: HIGH+MED → MED)
    const conf = await page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row .conf')].map((c) => c.textContent)`);
    assert.deepEqual(conf, ['MED', 'MED']);
    // the flat task register is gone; the risk register keeps its own section
    const captions = await page.eval(
      `[...document.querySelectorAll('#register caption')].map((c) => c.textContent)`);
    assert.equal(captions.length, 1);
    assert.match(captions[0], /Risk register/);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('breakdown headers sort: effort toggles to ascending on click', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const firstRow = () => page.eval(
      `document.querySelector('#feature-table tr.feat-row td:first-child').textContent.trim()`);
    assert.match(await firstRow(), /book appointment/);
    await page.eval(`document.querySelector('#feature-table th button[data-sort="hours"]').click()`);
    assert.match(await firstRow(), /Email reminders/);
    assert.equal(await page.eval(
      `document.querySelector('#feature-table th button[data-sort="hours"]').closest('th').getAttribute('aria-sort')`),
    'ascending');
  } finally { page.close(); }
});

test('expanding a feature reveals its tasks; client view hides the drill-down', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.equal(await page.eval(`document.querySelectorAll('#feature-table tr.task-row').length`), 0);
    await page.eval(`document.querySelector('#feature-table tr.feat-row .expand').click()`);
    const tasks = await page.eval(
      `[...document.querySelectorAll('#feature-table tr.task-row td:first-child')].map((c) => c.childNodes[0].textContent.trim())`);
    assert.deepEqual(tasks, ['Booking CRUD API', 'Slot conflict + cancellation rules']);
    await page.eval(`document.getElementById('view-toggle').click()`);
    assert.equal(await page.eval(
      `getComputedStyle(document.querySelector('#feature-table tr.task-row')).display`), 'none');
    assert.equal(await page.eval(
      `getComputedStyle(document.querySelector('#feature-table .expand')).display`), 'none');
  } finally { page.close(); }
});


test('expand all / collapse all toggle every task row and stay internal-only', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`document.querySelector('#feature-table button[data-expand="all"]').click()`);
    assert.equal(await page.eval(`document.querySelectorAll('#feature-table tr.task-row').length`), 3);
    await page.eval(`document.querySelector('#feature-table button[data-expand="none"]').click()`);
    assert.equal(await page.eval(`document.querySelectorAll('#feature-table tr.task-row').length`), 0);
    await page.eval(`document.getElementById('view-toggle').click()`);
    assert.equal(await page.eval(
      `getComputedStyle(document.querySelector('#feature-table button[data-expand="all"]').closest('.bd-filter-group')).display`), 'none');
  } finally { page.close(); }
});


const pickOption = (key, value) => `(() => {
  const sel = document.querySelector('#feature-table select[data-select="${key}"]');
  sel.value = ${JSON.stringify(value)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
})()`;

test('milestone select and provenance pills scope rows without rescaling bars', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const width = () => page.eval(
      `document.querySelector('#feature-table tr.feat-row[data-id="reminders"] .bd-fill').style.width`);
    const before = await width();
    await page.eval(pickOption('milestone', 'M2 - Notifications'));
    const visible = await page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row')].map((r) => r.dataset.id)`);
    assert.deepEqual(visible, ['reminders']);
    assert.equal(await width(), before, 'bar must keep its global scale under filters');
    await page.eval(pickOption('milestone', ''));
    await page.eval(`document.querySelector('#feature-table button[data-prov="stated"]').click()`);
    assert.deepEqual(await page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row')].map((r) => r.dataset.id)`), ['booking']);
  } finally { page.close(); }
});

test('the effort-by-container donut shows shares and names the honest gaps', skip, async () => {
  const page = await openPage(buildPage());
  try {
    // one slice per estimated container, hours desc — the excused one never gets a slice
    const slices = await page.eval(`[...document.querySelectorAll('#containers svg .pie-slice')].map((s) => ({
      title: s.querySelector('title').textContent, dash: s.getAttribute('stroke-dasharray') }))`);
    assert.equal(slices.length, 2);
    assert.match(slices[0].title, /Booking API · 69\.33h \(76%\)/);
    assert.match(slices[1].title, /Notification Service · 21\.33h \(24%\)/);
    assert.match(slices[0].dash, /^76(\.\d+)? /, 'slice arc length must be its share');
    const legend = await page.eval(`[...document.querySelectorAll('#containers .pie-legend li')].map((r) =>
      r.textContent.trim().replace(/\\s+/g, ' '))`);
    assert.deepEqual(legend, ['Booking API 69.33h 76%', 'Notification Service 21.33h 24%']);
    // the roster-excused container stays visible as words — an honest gap, not a hidden zero
    const note = await page.eval(`document.querySelector('#containers .pie-note').textContent`);
    assert.match(note, /not estimated/i);
    assert.match(note, /Admin Console/);
    assert.match(note, /out of v1 scope/);
    // hovering a slice lights up its legend row, so a thin slice is still nameable
    const hot = (type) => page.eval(`(() => {
      document.querySelector('#containers .pie-slice[data-ct="notify"]')
        .dispatchEvent(new MouseEvent('${type}', { bubbles: true }));
      return [...document.querySelectorAll('#containers .pie-legend li.hot')].map((r) => r.dataset.ct);
    })()`);
    assert.deepEqual(await hot('mouseover'), ['notify']);
    assert.deepEqual(await hot('mouseout'), []);
    // and the reverse: hovering a legend row lights its slice on the donut
    const hotSlices = (type) => page.eval(`(() => {
      document.querySelector('#containers .pie-legend li[data-ct="api"]')
        .dispatchEvent(new MouseEvent('${type}', { bubbles: true }));
      return [...document.querySelectorAll('#containers .pie-slice.hot')].map((s) => s.dataset.ct);
    })()`);
    assert.deepEqual(await hotSlices('mouseover'), ['api']);
    assert.equal(await page.eval(
      `getComputedStyle(document.querySelector('#containers .pie-slice[data-ct="api"]')).opacity`),
    '0.75', 'the lit slice must read as highlighted');
    assert.deepEqual(await hotSlices('mouseout'), []);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('no roster → the containers section is absent, no placeholder', skip, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-browser-'));
  const scripts = new URL('..', import.meta.url).pathname;
  const bare = JSON.parse(readFileSync(fixture, 'utf8'));
  delete bare.components;
  for (const f of bare.features) delete f.component;
  writeFileSync(join(dir, 'inputs.json'), JSON.stringify(bare));
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', join(dir, 'inputs.json'), '--out', join(dir, 'estimation.json')]);
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', join(dir, 'estimation.json'), '--md', join(scripts, 'test/fixtures/estimation-pass.md'), '--out', dir]);
  const page = await openPage(pathToFileURL(join(dir, 'estimate.html')).href);
  try {
    assert.equal(await page.eval(`document.getElementById('containers')`), null);
    // no roster → no segments either; the band falls back to the solid accent fill
    assert.equal(await page.eval(`document.querySelectorAll('#roadmap .roadmap-seg').length`), 0);
    assert.ok(await page.eval(`document.querySelectorAll('#roadmap .roadmap-band').length > 0`));
    // and the breakdown rows carry no container stripes
    assert.equal(await page.eval(`document.querySelectorAll('#feature-table td.ct-edge').length`), 0);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('container select filters rows by container', skip, async () => {
  const page = await openPage(buildPage());
  try {
    // options name containers from the roster — never leaf components, never admin (no rows)
    const options = await page.eval(
      `[...document.querySelectorAll('#feature-table select[data-select="component"] option')].map((o) => o.textContent)`);
    assert.deepEqual(options, ['all containers', 'Booking API', 'Notification Service']);
    // each row's first cell carries its container's stripe on the left edge,
    // named on hover — same palette as the donut
    const stripes = await page.eval(`[...document.querySelectorAll('#feature-table tr.feat-row td.ct-edge')]
      .map((c) => ({ title: c.title, shadow: getComputedStyle(c).boxShadow, inline: c.style.boxShadow }))`);
    assert.deepEqual(stripes.map((s) => s.title), ['Booking API', 'Notification Service']);
    assert.ok(stripes.every((s) => /inset/.test(s.shadow)), 'stripe must be an inset edge, no gap');
    assert.notEqual(stripes[0].shadow, stripes[1].shadow, 'containers must differ in color');
    assert.ok(stripes.every((s) => s.inline === ''),
      'the shadow lives in the ct-edge class — inline style carries only the color variable');
    await page.eval(pickOption('component', 'notify'));
    assert.deepEqual(await page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row')].map((r) => r.dataset.id)`), ['reminders']);
    await page.eval(pickOption('component', ''));
    assert.equal(await page.eval(`document.querySelectorAll('#feature-table tr.feat-row').length`), 2);
    // expanded task rows belong to the feature's container — same stripe
    await page.eval(`document.querySelector('#feature-table tr.feat-row .expand').click()`);
    const taskStripe = await page.eval(
      `getComputedStyle(document.querySelector('#feature-table tr.task-row td.ct-edge')).boxShadow`);
    assert.equal(taskStripe, stripes[0].shadow);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('roadmap bands segment by container; clicking a row drives the breakdown', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const segs = await page.eval(`[...document.querySelectorAll('#roadmap .roadmap-row')].map((r) =>
      [...r.querySelectorAll('.roadmap-seg')].map((s) => s.title))`);
    assert.deepEqual(segs, [['Booking API · 69.33h (100%)'], ['Notification Service · 21.33h (100%)']]);
    // a stale container filter would hide the milestone's rows — the click clears it first
    await page.eval(pickOption('component', 'api'));
    await page.eval(`document.querySelector('#roadmap .roadmap-row[data-milestone="M2 - Notifications"]').click()`);
    assert.deepEqual(await page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row')].map((r) => r.dataset.id)`), ['reminders']);
    assert.equal(await page.eval(
      `document.querySelector('#feature-table select[data-select="milestone"]').value`), 'M2 - Notifications');
    assert.equal(await page.eval(
      `document.querySelector('#feature-table select[data-select="component"]').value`), '');
    // same row again → the filter clears, every feature returns
    await page.eval(`document.querySelector('#roadmap .roadmap-row[data-milestone="M2 - Notifications"]').click()`);
    assert.equal(await page.eval(`document.querySelectorAll('#feature-table tr.feat-row').length`), 2);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

// Clicking a roadmap row filters to its milestone AND groups the surviving
// rows by container, so the stripe colors cluster the way the band's segments
// do — the roadmap colors and the breakdown colors tell the same story.
test('a roadmap click groups the breakdown rows by container', skip, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-browser-'));
  const scripts = new URL('..', import.meta.url).pathname;
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  inputs.features.push({
    id: 'audit', name: 'Booking audit log', provenance: 'proposed',
    component: 'api', milestone: 'M2 - Notifications',
    scores: {
      tech: { n: 1, anchor: 'Standard CRUD, well-documented library usage, copy-paste patterns', cite: 'append-only log write' },
      size: { n: 1, anchor: 'Single UI element or micro-function, <1 day of work', cite: 'one write call' },
      deps: { n: 2, anchor: 'One internal dependency (e.g. auth check)', cite: 'writes to the booking API' },
      unc: { n: 1, anchor: 'Fully defined spec, clear acceptance criteria, precedent exists', cite: 'standard audit log shape' },
      risk: { n: 2, anchor: 'Low stakes, easy rollback, minimal user impact', cite: 'log-only, no user-facing effect' },
    },
    scoreNote: 'Writes an append-only audit log entry alongside booking changes',
    scoreProvenance: 'proposed',
    tasks: [{ id: 'audit-log', name: 'Audit log writes', category: 'boilerplate',
      o: 4, m: 6, p: 10, confidence: 'MED', assumptions: [], provenance: 'proposed' }],
  });
  writeFileSync(join(dir, 'inputs.json'), JSON.stringify(inputs));
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', join(dir, 'inputs.json'), '--out', join(dir, 'estimation.json')]);
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', join(dir, 'estimation.json'), '--md', join(scripts, 'test/fixtures/estimation-pass.md'), '--out', dir]);
  const page = await openPage(pathToFileURL(join(dir, 'estimate.html')).href);
  try {
    const ids = () => page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row')].map((r) => r.dataset.id)`);
    await page.eval(`document.querySelector('#roadmap .roadmap-row[data-milestone="M2 - Notifications"]').click()`);
    // hours desc would put reminders first; container grouping puts the api row first
    assert.deepEqual(await ids(), ['audit', 'reminders']);
    // no header may claim a sort the grouping just overrode
    assert.deepEqual(await page.eval(
      `[...document.querySelectorAll('#feature-table th')].map((t) => t.getAttribute('aria-sort'))`),
    ['none', 'none', 'none', 'none']);
    // an explicit header sort takes control back from the grouping, starting
    // fresh at the column's default direction — not toggling a stale one
    await page.eval(`document.querySelector('#feature-table th button[data-sort="hours"]').click()`);
    assert.deepEqual(await ids(), ['reminders', 'audit']);
    assert.equal(await page.eval(
      `document.querySelector('#feature-table th button[data-sort="hours"]').closest('th').getAttribute('aria-sort')`),
    'descending');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('the container donut and roadmap sit directly above the feature breakdown', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const ids = await page.eval(`[...document.querySelectorAll('main section[id]')].map((s) => s.id)`);
    const [c, r, f] = ['containers', 'roadmap', 'feature-table'].map((id) => ids.indexOf(id));
    assert.ok(c >= 0 && c < r && r + 1 === f, `order wrong: ${ids}`);
  } finally { page.close(); }
});

test('roadmap renders the committed milestone bands', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const labels = await page.eval(
      `[...document.querySelectorAll('#roadmap .roadmap-label')].map((l) => l.textContent)`);
    assert.equal(labels.length, 2);
    assert.match(labels[0], /M1 - Booking core/);
    assert.match(labels[1], /M2 - Notifications/);
  } finally { page.close(); }
});

// 150px of label column against milestone names that read "M1 - Foundation: the
// governed write path": every row clips, and a clipped Gantt label names nothing.
// The row carries the full text as its hover title so the axis stays narrow.
test('a clipped roadmap label still names its milestone on hover', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const rows = await page.eval(`[...document.querySelectorAll('#roadmap .roadmap-row')].map((r) => ({
      name: r.querySelector('.roadmap-name').textContent,
      nameTitle: r.querySelector('.roadmap-name').title,
      featTitle: r.querySelector('.roadmap-feature-names').title,
      feats: r.querySelector('.roadmap-feature-names').textContent,
    }))`);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.nameTitle, row.name, 'milestone name must carry its own full text');
      assert.equal(row.featTitle, row.feats, 'feature list must carry its own full text');
    }
  } finally { page.close(); }
});

// A page that declares no color-scheme is the page a force-dark browser rewrites,
// and the toggle then flips data-theme with nothing visible changing — the button
// reads as broken. Declared per theme, forced dark is off and the toggle bites.
const READ_THEME = `({
  theme: document.documentElement.dataset.theme || null,
  scheme: getComputedStyle(document.documentElement).colorScheme,
  bg: getComputedStyle(document.body).backgroundColor,
})`;

test('the page opens dark, declares its scheme, and the toggle flips both', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const before = await page.eval(READ_THEME);
    assert.equal(before.theme, 'dark');
    assert.equal(before.scheme, 'dark');
    await page.eval(`document.getElementById('theme-toggle').click()`);
    const after = await page.eval(READ_THEME);
    assert.equal(after.theme, 'light');
    assert.equal(after.scheme, 'light');
    assert.notEqual(after.bg, before.bg, 'the first click must change what the reader sees');
  } finally { page.close(); }
});

// The estimate is a document that gets printed and handed over. A dark screen
// default must not follow it onto paper — that is a full-bleed ink page and grey
// text on it. The dark palette is scoped to screen so paper keeps the light one.
test('the dark default stops at the screen — paper stays light', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const screen = await page.eval(READ_THEME);
    await page.send('Emulation.setEmulatedMedia', { media: 'print' });
    const paper = await page.eval(READ_THEME);
    assert.equal(paper.bg, 'rgb(247, 245, 240)');
    assert.notEqual(paper.bg, screen.bg, 'print must not inherit the dark background');
  } finally { page.close(); }
});

test('no milestones → the roadmap section is absent, no placeholder', skip, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-browser-'));
  const scripts = new URL('..', import.meta.url).pathname;
  const bare = JSON.parse(readFileSync(fixture, 'utf8'));
  for (const f of bare.features) delete f.milestone;
  writeFileSync(join(dir, 'inputs.json'), JSON.stringify(bare));
  const md = readFileSync(join(scripts, 'test/fixtures/estimation-pass.md'), 'utf8')
    .replace(/### Roadmap[\s\S]*?(?=### Assumptions)/, '');
  writeFileSync(join(dir, 'bare.md'), md);
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', join(dir, 'inputs.json'), '--out', join(dir, 'estimation.json')]);
  execFileSync('node', [join(scripts, 'render.mjs'), '--json', join(dir, 'estimation.json'), '--md', join(dir, 'bare.md'), '--out', dir]);
  const page = await openPage(pathToFileURL(join(dir, 'estimate.html')).href);
  try {
    assert.equal(await page.eval(`document.getElementById('roadmap')`), null);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

// --- breakdown scoring mode: the workbook's five scores rendered in-page ---

const HEADS = `[...document.querySelectorAll('#feature-table th')].map((h) => h.textContent.trim())`;
const enterScoring = (page) => page.eval(`document.querySelector('#feature-table [data-mode="scores"]').click()`);

test('a columns pill swaps the breakdown to workbook scores and back', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.ok((await page.eval(HEADS)).includes('Confidence'), 'estimate columns by default');
    await enterScoring(page);
    const heads = await page.eval(HEADS);
    for (const h of ['Tech', 'Size', 'Deps', 'Unc', 'Risk', 'Σ', 'Tier']) {
      assert.ok(heads.includes(h), `scoring header ${h} missing: ${heads}`);
    }
    assert.ok(!heads.includes('Confidence'), 'estimate columns must swap out');
    const booking = await page.eval(
      `[...document.querySelectorAll('#feature-table tr.feat-row')[0].querySelectorAll('td.score')].map((c) => c.textContent.trim())`);
    assert.deepEqual(booking, ['2', '4', '2', '4', '3', '15', 'M']);
    await page.eval(`document.querySelector('#feature-table [data-mode="estimate"]').click()`);
    assert.ok((await page.eval(HEADS)).includes('Confidence'), 'estimate pill must swap back');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

test('scoring-mode task rows show each task\'s input to every score', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await enterScoring(page);
    await page.eval(`document.querySelector('#feature-table tr.feat-row .expand').click()`);
    const rows = await page.eval(
      `[...document.querySelectorAll('#feature-table tr.task-row')].map((r) => r.textContent.replace(/\\s+/g, ' ').trim())`);
    assert.equal(rows.length, 2);
    assert.match(rows[0], /boilerplate ×1\.5/);
    assert.match(rows[0], /25\.3h/);
    assert.match(rows[1], /logic ×3/);
    assert.match(rows[1], /44(\.0)?h/);
  } finally { page.close(); }
});

test('the scoring guide fold explains the anchors in the workbook\'s words', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.equal(await page.eval(`document.querySelector('#feature-table details.guide')`), null,
      'no guide fold in estimate mode');
    await enterScoring(page);
    assert.ok(await page.eval(`document.querySelector('#feature-table details.guide').open`),
      'guide must open on first switch');
    const text = await page.eval(`document.querySelector('#feature-table details.guide').textContent`);
    for (const anchor of ['Standard CRUD, well-documented library usage',
      'Epic-scale feature', 'Deep cross-system dependencies', 'Highly experimental',
      'Core infrastructure, compliance requirements']) {
      assert.ok(text.includes(anchor), `guide missing workbook anchor: ${anchor}`);
    }
    assert.match(text, /hours-weighted/); // each dimension states its derivation
  } finally { page.close(); }
});

test('scoring mode is internal-only: client view resets and hides the pill', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await enterScoring(page);
    await page.eval(`document.getElementById('view-toggle').click()`);
    assert.ok((await page.eval(HEADS)).includes('Confidence'), 'client view must reset to estimate columns');
    assert.equal(await page.eval(
      `getComputedStyle(document.querySelector('#feature-table [data-mode="scores"]').closest('.bd-filter-group')).display`),
    'none');
  } finally { page.close(); }
});

// The Summary is the one place team, months and cost appear. The booking
// fixture recommends the AI-assisted senior+mid pair; the unaided trio is a
// different roster, so it is an alternative row, not a collapsed line.
test('the summary states the recommended scenario once and lists team alternatives', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const lead = await page.eval(`document.querySelector('#summary .lead').textContent`);
    assert.equal(lead, '2 engineers (senior · mid), AI-assisted');
    const figures = await page.eval(`document.querySelector('#summary .figures').textContent`);
    assert.match(figures, /0\.40 months/);
    assert.match(figures, /\$5,993/);
    const alts = await page.eval(`[...document.querySelectorAll('#summary .alts tbody tr td:first-child')].map((c) => c.textContent)`);
    assert.deepEqual(alts, ['3 engineers (mid · mid · junior), humans unaided']);
    assert.equal(await page.eval(`document.querySelector('#summary .insight')`), null); // slower and pricier: no insight
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

// Same roster, AI on vs off: not a staffing choice, so it collapses to one
// line under the recommendation instead of an alternatives table.
test('a same-team AI-only variant collapses to one line, not a table', skip, async () => {
  const page = await openPage(buildPageWith((inputs) => {
    const rec = inputs.scenarios.find((s) => s.id === inputs.recommendedScenario);
    const other = inputs.scenarios.find((s) => s.id !== rec.id);
    other.team = rec.team.map((m) => ({ ...m }));
  }));
  try {
    assert.equal(await page.eval(`document.querySelector('#summary .alts table')`), null);
    const line = await page.eval(`document.querySelector('#summary .alts .meta').textContent`);
    assert.match(line, /^Without AI assistance: 0\.\d\d months · \$[\d,]+ \(\+0\.\d\d mo · \+\$[\d,]+\)$/);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

// One scenario is the default interview answer: no alternatives block at all.
test('a single-scenario estimate shows the summary with no alternatives block', skip, async () => {
  const page = await openPage(buildPageWith((inputs) => {
    inputs.scenarios = inputs.scenarios.filter((s) => s.id === inputs.recommendedScenario);
  }));
  try {
    assert.equal(await page.eval(`document.querySelector('#summary .alts')`), null);
    assert.equal(await page.eval(`document.querySelector('#summary .lead').textContent`), '2 engineers (senior · mid), AI-assisted');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});
