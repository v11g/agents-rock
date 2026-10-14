import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixtures = new URL('./fixtures/docs-pass/', import.meta.url).pathname;

// Shaped like a real likec4 1.59.2 bundle: a serialised theme carrying the
// shared brand hex, and nodes resolving to a palette colour name. render.mjs
// refuses a bundle without this, because that is precisely what a model with no
// palette generates — valid, clean, and blue.
const THEME = JSON.parse(readFileSync(
  new URL('../../assets/mermaid-theme.json', import.meta.url), 'utf8'));
const LIKEC4_STUB = '/*likec4*/`@font-face{src:url(https://cdn.jsdelivr.net/f.woff2)format("woff2")}`'
  + `;primary:{elements:{fill:\`${THEME.likec4.brand}\`,stroke:\`#00524b\`,`
  + 'hiContrast:`#c7ffff`,loContrast:`#b2ffff`}};shape:`rectangle`,color:`primary`';

test('render.mjs produces a self-contained index.html', () => {
  const out = mkdtempSync(join(tmpdir(), 'analyze-requirements-render-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', fixtures, '--arch', `${fixtures}ARCHITECTURE.md`,
    '--docs', `${fixtures}docs/adr/0001-sample.md`,
    '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<h2 id="core-components">/);
  assert.match(html, /href="#core-components"/);
  assert.match(html, /\/\*likec4\*\//);
  assert.match(html, /\/\*mermaid\*\//);
  // The stacks named IBM Plex on every platform and it resolved on almost none.
  // Embedded at render time rather than committed, like the two bundles above.
  assert.match(html, /@font-face\{font-family:'IBM Plex Sans'/);
  assert.match(html, /url\(data:font\/woff2;base64,/);
  assert.doesNotMatch(html, /url\(https?:/);
  // Self-contained means nothing *loads* from the network, while research.md §3
  // requires every researched fact to carry a source URL as visible text. So
  // rather than forbid http outright (or blocklist loadable positions, which a
  // later srcset/fetch/@import would slip past), every URL in the page must
  // originate in the rendered documents — bundles and template code contribute
  // none, in any syntactic position. The one exception is svg's xmlns.
  const docs = readFileSync(join(fixtures, 'ARCHITECTURE.md'), 'utf8')
    + readFileSync(join(fixtures, 'docs/adr/0001-sample.md'), 'utf8');
  for (const url of html.match(/https?:\/\/[^\s"'`)\]<]+/g) ?? []) {
    assert.ok(url.startsWith('http://www.w3.org/') || docs.includes(url),
      `${url} does not come from the documents — the page must stay self-contained`);
  }
  assert.match(html, /researched \[https:\/\/docs\.stripe\.com\/api\]/,
    'a researched fact\'s source URL must survive into the page as visible text');
  // ARCHITECTURE.md heads its own section. Anything under docs/adr/ is a record:
  // §14 Decisions already tables every one of them, so it opens in a drawer over
  // that table and gets no rail row of its own.
  assert.match(html, /nav-sec__title[^>]*>Architecture</);
  assert.doesNotMatch(html, /nav-sec__title[^>]*>Decision Records</);
  // Still in the document, though — a drawer needs something to show, and the
  // route is what makes it linkable.
  assert.match(html, /<div class="doc-section"[^>]*data-drawer/);
  assert.match(html, /class="page"[^>]*data-route="0001-sample"/);
});

// A companion at the set root has no meaningful directory name — dirname is ".",
// and that string reached the rail as a section title. ARCHITECTURE.md was already
// special-cased out of this, but only by its index, so every *other* root-level
// document fell through to a row labelled ".". They belong with the spine they
// accompany.
test('root-level companions head the Architecture section, not "."', () => {
  const out = mkdtempSync(join(tmpdir(), 'analyze-requirements-render-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', fixtures, '--arch', `${fixtures}ARCHITECTURE.md`,
    '--docs', `${fixtures}threat-model.md`, `${fixtures}docs/adr/0001-sample.md`,
    '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  // Absolute --docs took the set directory's own name; relative --docs took ".".
  // Neither is a section a reader would recognise.
  assert.doesNotMatch(html, /nav-sec__title[^>]*>Docs pass</);
  assert.doesNotMatch(html, /data-section="\."/);
  // Still reachable, under the spine's own section.
  assert.match(html, /nav-sec__title[^>]*>Architecture</);
  assert.match(html, /class="page"[^>]*data-route="threat-model"/);
});

// The same set, spelled the way a caller in the set directory spells it. The
// label must not depend on how the path was written — that is what made this
// invisible to the fixture and visible in a real run.
test('a root-level companion is spelling-independent', () => {
  const out = mkdtempSync(join(tmpdir(), 'analyze-requirements-render-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  const skill = new URL('../../', import.meta.url).pathname;
  execFileSync('node', [
    `${skill}scripts/render.mjs`,
    '--root', '.', '--arch', 'ARCHITECTURE.md',
    '--docs', 'threat-model.md', 'docs/adr/0001-sample.md',
    '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', `${skill}assets/mermaid-theme.json`,
  ], { cwd: fixtures });
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /data-section="\."/);
  assert.match(html, /nav-sec__title[^>]*>Architecture</);
});

// The estimation companion is the argument; the estimate skill's page beside
// it is the same numbers made interactive. The viewer links it when — and only
// when — the file exists, so an md-only run renders exactly as before.
test('the estimation companion links a sibling estimate.html', () => {
  const out = mkdtempSync(join(tmpdir(), 'analyze-requirements-render-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', fixtures, '--arch', `${fixtures}ARCHITECTURE.md`,
    '--docs', `${fixtures}docs/estimation.md`,
    '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /class="page"[^>]*data-kind="estimation"/);
  assert.match(html, /class="estimate-link"><a href="[^"]*estimate\.html"/);
});

test('render.mjs fails loudly on a missing bundle', () => {
  assert.throws(() => execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', fixtures, '--arch', `${fixtures}ARCHITECTURE.md`,
    '--out', mkdtempSync(join(tmpdir(), 'analyze-requirements-render-')),
    '--likec4-bundle', '/nope/l.js', '--mermaid-bundle', '/nope/m.js',
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]));
});

test('render.mjs throws loudly if a bundle contains a literal </script>', () => {
  const out = mkdtempSync(join(tmpdir(), 'analyze-requirements-render-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  assert.throws(() => execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', fixtures, '--arch', `${fixtures}ARCHITECTURE.md`,
    '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB + 'var s = "</script>";'),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]));
});

// The failure this exists for: a valid model with no palette generates a clean
// bundle, exit 0, every node LikeC4 default blue, and nothing anywhere says so.
test('render.mjs refuses a likec4 bundle with no palette', () => {
  const out = mkdtempSync(join(tmpdir(), 'analyze-requirements-render-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  assert.throws(() => execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', fixtures, '--arch', `${fixtures}ARCHITECTURE.md`,
    '--out', out,
    '--likec4-bundle', stub('l.js', '/*likec4*/;shape:`rectangle`,color:`primary`'),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]), /palette|likec4\.config\.json/i);
});

test('a citation to an interview answer jumps to that answer, not the spine heading of the same name', () => {
  const root = mkdtempSync(join(tmpdir(), 'render-anchor-'));
  cpSync(fixtures, root, { recursive: true });
  const arch = join(root, 'ARCHITECTURE.md');
  const log = join(root, 'interview-log.md');
  writeFileSync(arch, `${readFileSync(arch, 'utf8')}\n### Q3\n\nOwner: stated [Q3 · 2026-10-14](interview-log.md#q3)\n`);
  writeFileSync(log, '# Interview log\n\n### Q3\n**Answer** Confirm top 3\n');
  const out = mkdtempSync(join(tmpdir(), 'render-anchor-out-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', root, '--arch', arch, '--docs', log, '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<h3 id="q3">Q3<\/h3>/);
  assert.match(html, /<h3 id="interview-log__q3">Q3<\/h3>/);
  assert.match(html, /<a href="#interview-log__q3">Q3 · 2026-10-14<\/a>/);
});

test('two documents with the same file name get different id prefixes', () => {
  const root = mkdtempSync(join(tmpdir(), 'render-prefix-'));
  cpSync(fixtures, root, { recursive: true });
  for (const d of ['a', 'b']) {
    mkdirSync(join(root, d));
    writeFileSync(join(root, d, 'notes.md'), `# Notes ${d}\n\n## Context\n`);
  }
  const out = mkdtempSync(join(tmpdir(), 'render-prefix-out-'));
  const stub = (name, content) => { const p = join(out, name); writeFileSync(p, content); return p; };
  execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/render.mjs',
    '--root', root, '--arch', join(root, 'ARCHITECTURE.md'),
    '--docs', join(root, 'a', 'notes.md'), join(root, 'b', 'notes.md'), '--out', out,
    '--likec4-bundle', stub('l.js', LIKEC4_STUB),
    '--mermaid-bundle', stub('m.js', '/*mermaid*/'),
    '--theme', 'plugins/solution-architect/skills/analyze-requirements/assets/mermaid-theme.json',
  ]);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<h2 id="notes__context">/);
  assert.match(html, /<h2 id="notes-2__context">/);
});
