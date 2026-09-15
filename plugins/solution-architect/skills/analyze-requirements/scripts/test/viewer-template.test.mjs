import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { embed } from '../lib/embed.mjs';

const tpl = readFileSync(new URL('../../assets/viewer-template.html', import.meta.url), 'utf8');

test('template has exactly the eight slots and no external URLs', () => {
  const markers = [...tpl.matchAll(/<!-- slot:(\w+) -->/g)].map((m) => m[1]).sort();
  assert.deepEqual(markers,
    ['DOC', 'FONTS', 'LIKEC4_BUNDLE', 'MERMAID_BUNDLE', 'NAV', 'SECTION_HELP', 'THEME', 'TITLE']);
  assert.doesNotMatch(tpl, /https?:\/\/(?!www\.w3\.org)/);
});

// The faces have to be declared before the stacks that name them, and the whole
// point is that the bytes are not in this file: 100KB of base64 would turn a
// readable design document into a blob with a stylesheet round it.
test('the font slot sits at the head of the stylesheet, not in the repo', () => {
  const style = tpl.indexOf('<style>');
  assert.ok(tpl.indexOf('<!-- slot:FONTS -->') > style);
  assert.ok(tpl.indexOf('<!-- slot:FONTS -->') < tpl.indexOf('--font-display'));
  assert.doesNotMatch(tpl, /base64,[A-Za-z0-9+/]{200,}/,
    'font bytes belong in the slot, not committed into the template');
});

test('template embeds cleanly and keeps required controls', () => {
  const out = embed({ template: tpl, slots: {
    TITLE: 't', NAV: '<a href="#x">x</a>', DOC: '<h2 id="x">x</h2>',
    LIKEC4_BUNDLE: '/*l*/', MERMAID_BUNDLE: '/*m*/', THEME: '{"themeVariables":{}}',
    FONTS: '/*fonts*/', SECTION_HELP: '{"spine":{},"companions":{}}',
  } });
  for (const control of ['data-zoom-in', 'data-zoom-out', 'data-zoom-reset', 'data-expand', 'data-fullscreen']) {
    assert.match(out, new RegExp(control));
  }
  assert.match(out, /registerLayoutLoaders/);
  assert.match(out, /theme:\s*'base'/);
});

test('the rail is a labelled landmark with a filter and a mobile toggle', () => {
  assert.match(tpl, /<nav[^>]*class="[^"]*sidebar[^"]*"[^>]*aria-label=/);
  assert.match(tpl, /id="nav-filter"/);
  assert.match(tpl, /id="nav-toggle"/);
  assert.match(tpl, /aria-expanded=/);
});

test('the rail tracks the reader with scroll spy over grouped links', () => {
  assert.match(tpl, /IntersectionObserver/);
  assert.match(tpl, /is-active/);
  assert.match(tpl, /nav-group/);
});

test('the rail styles and scripts a section level above the document groups', () => {
  assert.match(tpl, /\.nav-sec__head\s*\{/);
  assert.match(tpl, /\.nav-sec\[open\]/);
  // The filter and the scroll spy both have to reach through the section, or a
  // hit inside a collapsed Decision Records block is invisible.
  assert.match(tpl, /sections\s*=\s*\[\]\.slice\.call\(document\.querySelectorAll\('\.nav-sec'\)\)/);
  assert.match(tpl, /closest\('\.nav-sec'\)/);
});

test('live counts use tabular figures so filtering does not jiggle the rail', () => {
  const counts = tpl.match(/\.nav-sec__count,\s*\.nav-group__count \{[\s\S]*?\}/)[0];
  assert.match(counts, /font-variant-numeric:\s*tabular-nums/);
});

test('icon buttons carry a 40px hit area without overlapping each other', () => {
  const hit = tpl.match(/\.icon-btn::after \{[\s\S]*?\}/)[0];
  assert.match(hit, /inset:\s*-(\d+)px/);
  assert.match(tpl, /\.icon-btn:active \{[^}]*scale:\s*\.96/);
});

test('the theme icons cross-fade instead of popping via display', () => {
  assert.doesNotMatch(tpl, /\.i-sun \{ display: none; \}/);
  assert.match(tpl, /filter:\s*blur\(4px\)/);
  assert.match(tpl, /cubic-bezier\(\.2, 0, 0, 1\)/);
});

test('layout is responsive and honours reduced motion', () => {
  assert.match(tpl, /@media\s*\(max-width:/);
  assert.match(tpl, /prefers-reduced-motion/);
});

test('long-form reading defaults are set on the content column', () => {
  assert.match(tpl, /--measure:/);
  assert.match(tpl, /scroll-margin-top:/);
});

test('code blocks keep their own line breaks so tree connectors stay aligned', () => {
  const pre = tpl.match(/\npre \{[\s\S]*?\}/)[0];
  assert.match(pre, /white-space:\s*pre\s*;/);
  assert.doesNotMatch(pre, /pre-wrap/);
  assert.doesNotMatch(pre, /word-break/);
  assert.match(pre, /overflow:\s*auto/);
});

const bodyRule = tpl.match(/\nbody \{[\s\S]*?\n\}/)[0];
const num = (src, prop) => Number(src.match(new RegExp(`${prop}:\\s*([\\d.]+)`))[1]);

test('sub-headings outrank body text so a long document keeps its structure', () => {
  // h3 was 16px against 16.5px body: sub-sections read as bold paragraphs, and
  // a 21-document scroll loses its second level entirely.
  const h3 = num(tpl.match(/\.main h3 \{[\s\S]*?\}/)[0], 'font-size');
  assert.ok(h3 > num(bodyRule, 'font-size'), `h3 ${h3}px must outrank body text`);
});

test('paragraphs are separated by at least a full line', () => {
  const gap = Number(tpl.match(/\.main p \{[\s\S]*?margin:\s*0 0 ([\d.]+)px/)[1]);
  const line = num(bodyRule, 'font-size') * num(bodyRule, 'line-height');
  assert.ok(gap >= line * 0.8, `${gap}px gap is short against a ${line.toFixed(1)}px line`);
});

test('headings balance their line breaks', () => {
  assert.match(tpl, /\.main :is\(h2, h3\) \{[^}]*text-wrap: balance/);
});

test('a code block too wide for the column scrolls inside it', () => {
  // It used to break out to a 1080px track. A block wider than the prose above
  // it moves the left edge, and the reader re-finds it on every one.
  const pre = tpl.match(/\npre \{[\s\S]*?\}/)[0];
  assert.match(pre, /overflow:\s*auto/);
  assert.match(pre, /max-height:/);
});

test('inline code inside a heading drops the chip it wears in prose', () => {
  // A .855em chip on a clamp(30px, 3.4vw, 43px) display heading is a 37px grey
  // box that outweighs the words around it.
  const rule = tpl.match(/:is\(\.doc-head, \.main h2, \.main h3\) code \{[\s\S]*?\}/)[0];
  assert.match(rule, /background:\s*none/);
  assert.match(rule, /padding:\s*0/);
});

test('a deep-linked heading marks where the reader landed', () => {
  assert.match(tpl, /:target/);
});

test('table figures line up down their column', () => {
  assert.match(tpl, /\ntd \{[^}]*tabular-nums/);
});

test('diagram controls are icon buttons with accessible names', () => {
  assert.match(tpl, /aria-label="Zoom in"/);
  assert.match(tpl, /aria-label="Fullscreen"/);
  assert.doesNotMatch(tpl, />Exp</);
});

test('mermaid theme json parses and bans color in classDefs', () => {
  const theme = JSON.parse(readFileSync(new URL('../../assets/mermaid-theme.json', import.meta.url), 'utf8'));
  assert.ok(theme.themeVariables.fontFamily.includes('IBM Plex'));
  assert.doesNotMatch(JSON.stringify(theme), /"color"/);
});

// The toggle re-rendered mermaid and left LikeC4 in whichever mode it booted
// in, so dark mode showed a light diagram on a dark page. The webcomponent
// reads a color-scheme attribute; the viewer never set it.
test('the theme toggle reaches LikeC4, not just mermaid', () => {
  assert.match(tpl, /setAttribute\('color-scheme'/);
  assert.match(tpl, /querySelectorAll\('c4-view'\)/);
  // Both renderers move on one call, or they drift apart again the next time
  // somebody adds a third thing to the toggle.
  const toggle = tpl.match(/theme-toggle'\)\.addEventListener[\s\S]*?\n\}\);/)[0];
  assert.match(toggle, /syncDiagramTheme|applyTheme/);
});

// One file is the palette for both renderers: mermaid reads it at runtime,
// LikeC4 bakes it in at generate time. Leaving them in two places is how the
// diagrams drifted to teal and blue in the first place.
const theme = JSON.parse(readFileSync(new URL('../../assets/mermaid-theme.json', import.meta.url), 'utf8'));

// The two renderers were teal-on-pale and teal-on-solid: mermaid drew a light
// tinted fill with a dark border, LikeC4 a solid fill with light text. LikeC4's
// leaf fill cannot be softened — opacity reaches the node data but its renderer
// only applies it to compound groups — so mermaid is the one that moves.
test('mermaid fills match the exact hexes LikeC4 derives from the same brand', () => {
  assert.match(theme.likec4.brand, /^#[0-9a-f]{6}$/, 'brand is not a hex');
  assert.equal(theme.themeVariables.primaryColor, theme.likec4.brand);
  assert.equal(theme.themeVariables.primaryBorderColor, theme.likec4.brandStroke);
  assert.equal(theme.themeVariables.primaryTextColor, theme.likec4.brandText);
  assert.equal(theme.themeVariables.secondaryColor, theme.likec4.muted);
  assert.equal(theme.themeVariables.secondaryBorderColor, theme.likec4.mutedStroke);
});

// A solid fill carries its own text colour, so it is legible in either mode.
// LikeC4 proves the point: sampled pixel-for-pixel, its node fill is #0f766e in
// light AND dark — only the canvas behind it flips.
test('the element palette does not change between light and dark', () => {
  for (const key of ['primaryColor', 'primaryBorderColor', 'primaryTextColor',
    'secondaryColor', 'lineColor']) {
    assert.equal(theme.dark[key], undefined, `${key} must not be re-stated per mode`);
    assert.equal(theme.light[key], undefined, `${key} must not be re-stated per mode`);
  }
});

// Merged, not swapped: the mode block holds only what genuinely differs, so a
// shared value cannot be updated in one mode and forgotten in the other.
test('the mode palette is merged over the shared one', () => {
  assert.match(tpl, /Object\.assign\(\{\}, t\.themeVariables/);
  assert.match(tpl, /isDark\(\) \? t\.dark : t\.light/);
  assert.match(tpl, /ARCH_DOCS_THEME/);
  assert.match(tpl, /rerenderDiagrams\(\)/);
});

// A subgraph panel, an edge-label chip and the prose ink are chrome, not
// elements: they sit against the canvas, so they have to flip with it. Holding
// only one mode's values is what put black boundary panels on a cream page.
// Both blocks state the same keys, or the next palette edit lands in one mode
// and the other keeps a stale hex with nothing to flag it.
test('every chrome value is stated for both modes, never only one', () => {
  const l = Object.keys(theme.light).sort();
  const d = Object.keys(theme.dark).sort();
  assert.deepEqual(l, d, 'light and dark must state the same keys');
  assert.ok(l.length >= 4, 'the mode blocks look empty');
  for (const key of l) {
    assert.equal(theme.themeVariables[key], undefined,
      `${key} is per-mode, so a shared value for it only looks authoritative`);
    assert.notEqual(theme.light[key], theme.dark[key], `${key} is the same in both modes`);
  }
});

// The sync contract, measured rather than guessed: LikeC4's own render sampled
// pixel-for-pixel in each mode, and mermaid told to paint the same hex with the
// same chrome. Which mermaid variable paints which part was also found by
// rendering with marker colours — a subgraph takes clusterBkg/clusterBorder and
// its title takes titleColor, none of which fall back to the tertiary trio once
// they are set.
test('mermaid chrome matches the hexes LikeC4 paints in the same mode', () => {
  const map = {
    clusterBkg: 'groupFill',
    clusterBorder: 'groupStroke',
    titleColor: 'groupText',
  };
  for (const mode of ['light', 'dark']) {
    for (const [mermaidVar, likec4Role] of Object.entries(map)) {
      assert.equal(theme[mode][mermaidVar], theme.likec4[mode][likec4Role],
        `${mode} ${mermaidVar} does not match LikeC4's ${likec4Role}`);
    }
  }
});

// WCAG relative luminance and contrast ratio. Diagram text is baked into the
// SVG, so an unreadable pairing cannot be fixed by the reader or by the theme
// toggle — it has to be caught here.
const lum = (h) => {
  const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('every diagram text pairing clears the WCAG AA ratio', () => {
  const v = theme.themeVariables;
  const pairs = [
    ['entity name on its fill', v.primaryColor, v.primaryTextColor],
    ['secondary node label', v.secondaryColor, v.secondaryTextColor],
    // An ER attribute row is a second fill inside the entity, and the row text is
    // locked to primaryTextColor with the entity name. Left unstated, mermaid
    // derives the odd row by lightening primaryColor 75 points, which on a teal
    // brand clamps to white and hides every other line of §8's ER diagram.
    ['ER attribute row, odd', v.rowOdd, v.primaryTextColor],
    ['ER attribute row, even', v.rowEven, v.primaryTextColor],
  ];
  // The chrome pairings are per mode, and a ratio that only holds in one of them
  // is the bug this pass exists to close.
  for (const mode of ['light', 'dark']) {
    const m = theme[mode];
    pairs.push([`${mode} DFD boundary title on its panel`, m.clusterBkg, m.titleColor]);
  }
  for (const [what, bg, fg] of pairs) {
    const ratio = contrast(bg, fg);
    assert.ok(ratio >= 4.5, `${what}: ${fg} on ${bg} is only ${ratio.toFixed(2)}:1`);
  }
});

// A relation label ("owns", "HTTPS + session cookie") is a word on a line, not a
// component, and no mermaid variable can say that: the label text is locked to
// primaryTextColor — the light ink solid teal fills need — so any chip mermaid
// paints has to be dark to stay legible, which on a cream page is a dark blob.
// Mermaid's SVG is in the page's own DOM, not a shadow root, so the viewer takes
// the label back instead: page surface behind it, page ink in front, both already
// flipping with the theme. That leaves no per-mode hex to state, which is why
// edgeLabelBackground is gone from the palette rather than tuned.
test('the viewer, not mermaid, paints the relation label', () => {
  const rule = tpl.match(/\n\.diagram-canvas \.labelBkg,[\s\S]*?\n\}/)[0];
  assert.match(rule, /background-color:\s*var\(--surface\)\s*!important/);
  assert.match(rule, /color:\s*var\(--text\)\s*!important/);
  // Per diagram type mermaid colours a different layer: the ER label its
  // wrapping div, the flowchart label the innermost <p>. Missing one leaves that
  // diagram type with a chip nothing else has.
  for (const layer of [/\.labelBkg/, /span\.edgeLabel,/, /span\.edgeLabel p/]) {
    assert.match(rule, layer, 'a label layer mermaid paints is not covered');
  }
  for (const block of ['themeVariables', 'light', 'dark']) {
    assert.equal(theme[block].edgeLabelBackground, undefined,
      `edgeLabelBackground in ${block} is overridden by the viewer, so it only misleads`);
  }
});

// The same label, the other renderer. LikeC4 draws its relation label as
// div.likec4-edge-label inside a nested — but open — shadow root, so page CSS
// cannot select it and the chip survived while every mermaid label lost one:
// §10 stayed a dark blob on a cream page next to a §12 that did not. A style
// element pushed into the shadow root reaches it, and because custom properties
// inherit across the shadow boundary the same var() flips with the toggle
// without re-injecting anything.
test('the relation label loses its chip in LikeC4 too, not just mermaid', () => {
  const css = tpl.match(/var CHIP_CSS =[\s\S]*?;\n/)[0];
  assert.match(css, /\.likec4-edge-label/);
  assert.match(css, /color:var\(--text\) !important/);
  // transparent, not var(--surface) like the mermaid rule: LikeC4 breaks its edge
  // line around the label, so an opaque chip is a white blob over a compound
  // panel and masks nothing that needed masking.
  assert.match(css, /background:transparent !important/);

  const fn = tpl.match(/function stripEdgeChips[\s\S]*?\n\}\n/)[0];
  // Nested roots: the label is not in the root c4-view opens, and the inner one
  // is opened later, so descending only once silently reaches nothing.
  assert.match(fn, /walk\(el\.shadowRoot\)/);
  assert.match(tpl, /\[0, 200, 600, 1500, 3000\][\s\S]*?pinEdgeChips/,
    'a shadow root cannot be observed into existence, so the walk has to retry');
  assert.match(tpl, /pinEdgeChips/, 'the helper is never called');
});

// No fill may be semi-transparent any more. An 8-digit hex was how the old
// tinted fills were built, and it is exactly what LikeC4 cannot reproduce.
test('no fill is semi-transparent, because LikeC4 has no way to match one', () => {
  const alpha = Object.entries(theme.themeVariables)
    .filter(([, v]) => typeof v === 'string' && /^#[0-9a-f]{8}$/i.test(v));
  assert.deepEqual(alpha, [], '8-digit hex fills cannot be matched by LikeC4');
});

/* ---------- one column ---------- */

// Diagrams and wide tables took a 1080px track centred on a 689px prose column,
// so every one of them started ~190px to the left of the paragraph above it.
// One column for everything: a block may be narrower than the measure, never
// wider, and every block shares the same left edge.
test('nothing breaks out of the content column', () => {
  assert.doesNotMatch(tpl, /var\(--wide\)/);
  assert.doesNotMatch(tpl, /--measure-wide/);
  assert.doesNotMatch(tpl, /is-wide/);
  assert.doesNotMatch(tpl, /sizeTables|sizeCode/);
});

// Content-width made every narrow table a different width, so a page of them read
// as a ragged right edge against a fixed prose column. One width for all of them.
test('a table fills the column rather than hugging its content', () => {
  const rule = tpl.match(/\n\.table-wrap \{[^}]*\}/)[0];
  assert.match(rule, /width:\s*100%/);
  assert.doesNotMatch(rule, /max-content/, 'content width is what made them ragged');
  assert.match(tpl, /\.table-scroll \{[^}]*overflow-x:\s*auto/);
});

// Full width is a floor as well as a ceiling, so the cap still has to be there:
// without it a wide table pushes past the column instead of wrapping its cells,
// and 15 of the 18 tables in a real set grew a sideways scrollbar inside a
// vertical read.
test('a table too wide for the column wraps rather than scrolling sideways', () => {
  const rule = tpl.match(/\ntable \{[\s\S]*?\}/)[0];
  assert.match(rule, /width:\s*100%/);
  assert.match(rule, /max-width:\s*100%/);
  assert.doesNotMatch(rule, /max-content/);
  const th = tpl.match(/\nth \{[\s\S]*?\}/)[0];
  assert.doesNotMatch(th, /white-space:\s*nowrap/, 'a nowrap header sets a floor the cap cannot beat');
  const td = tpl.match(/\ntd \{[\s\S]*?\}/)[0];
  // Seven columns in an 891px measure is ~110px each, narrower than the words in
  // them. `overflow-wrap: anywhere` does remove the resulting scroll — it is the
  // only value min-content sizing reads — but it breaks every cell mid-word, and
  // a table nobody can read is worse than one that scrolls. A tighter scale buys
  // the columns real width instead.
  assert.doesNotMatch(td, /overflow-wrap:\s*anywhere/, 'anywhere breaks cells mid-word');
  assert.match(tpl, /\.table--wide \{[^}]*font-size:\s*12px/);
  assert.match(tpl, /\.table--wide :is\(th, td\) \{[^}]*padding/);
});

// LikeC4 fits a view once, at boot, against whatever box it has then. The
// router reveals a section before the element is upgraded, so that box is zero
// and the view renders at its natural size — off the edge of a 689px column.
test('a diagram is refit once its webcomponent boots', () => {
  assert.match(tpl, /whenDefined\('c4-view'\)/);
  assert.match(tpl, /new Event\('resize'\)/);
});

test('a diagram is the width of the column, not of the viewport', () => {
  const rule = tpl.match(/\n\.diagram-shell \{[\s\S]*?\}/)[0];
  assert.doesNotMatch(rule, /margin-left/);
  assert.doesNotMatch(rule, /width:/);
});

/* ---------- scrollbars ---------- */

// The platform default is a ~15px grey slab. Inside a code block or a table
// card that is an object wider than the hairline border around it, and there
// are a dozen of them in a real set.
test('every scroll container in the page gets the same thin scrollbar', () => {
  assert.match(tpl, /scrollbar-width:\s*thin/);
  assert.match(tpl, /scrollbar-color:/);
  const bar = tpl.match(/\n::-webkit-scrollbar \{[^}]*\}/)[0];
  assert.match(bar, /width:\s*\d+px/);
  assert.match(bar, /height:\s*\d+px/, 'a horizontal bar needs a height, not a width');
  assert.match(tpl, /::-webkit-scrollbar-thumb \{[^}]*border-radius/);
});

test('the rail does not carry a second, different scrollbar', () => {
  assert.doesNotMatch(tpl, /\.rail-scroll::-webkit-scrollbar/);
});

test('the page itself never scrolls sideways', () => {
  assert.match(tpl, /\nbody \{[\s\S]*?overflow-x:\s*clip/);
});

// overflow-x: auto computes the other axis from visible to auto, so the tab bar
// grew a vertical scrollbar for the 5px its tabs' hit areas stuck out of it.
test('the view tab bar cannot grow a scrollbar across its short axis', () => {
  const bar = tpl.match(/\.view-tabs__bar \{[\s\S]*?\}/)[0];
  assert.match(bar, /overflow-y:\s*hidden/);
});

test('a tab hit area fits inside the bar that holds it', () => {
  const pad = Number(tpl.match(/\.view-tabs__bar \{[\s\S]*?padding:\s*(\d+)px/)[1]);
  const reach = Number(tpl.match(/\.view-tab::after \{[^}]*inset:\s*-(\d+)px/)[1]);
  assert.equal(reach, pad, 'a hit area larger than the padding overflows the bar');
});

/* ---------- page routes ---------- */

// A 21-document scroll is not a page. Every document is its own page with its
// own route and its own progress: #/threat-model is the threat model, not an
// offset into a scroll that also holds twenty other documents.
test('one page is in the layout at a time, addressed by its own route', () => {
  assert.match(tpl, /\.page\[hidden\] \{[^}]*display:\s*none/);
  assert.match(tpl, /querySelectorAll\('\.page\[data-route\]'\)/);
  assert.match(tpl, /'#\/'/);
});

test('a bare element id still resolves to the page that holds it', () => {
  // Every in-page anchor the renderer writes is a bare id, and so is every rail
  // link. Routing must not require rewriting them.
  assert.match(tpl, /closest\('\.page'\)/);
});

test('the wider column is not the old prose measure', () => {
  const width = Number(tpl.match(/--measure:\s*min\((\d+)ch/)[1]);
  assert.ok(width >= 90, `${width}ch is still the narrow column`);
});

// A second `--prose` track capping paragraphs to 72ch was tried and reverted.
// The number is defensible on its own — 96ch renders ~108 characters a line on a
// real set, against the 66-75 the typographic convention asks for — but every h2
// here carries a full-width rule and the sections are dense with full-width
// tables. Capping only the paragraphs left the text ending ~240px short of both,
// and pushed trailing provenance markers onto their own line. Bringing the line
// length down means bringing `--measure` down and giving the tables somewhere
// else to go; it is not a thing paragraphs can be given on their own.
test('the column is one track, so prose and blocks share both edges', () => {
  assert.doesNotMatch(tpl, /--prose:/, 'a second width track is back');
  assert.match(tpl, /\.doc \{[^}]*max-width:\s*var\(--measure\)/, '.doc owns the column');
  assert.doesNotMatch(tpl, /\.main :is\(p[^)]*\) \{[^}]*max-width/,
    'running prose is capped separately from the blocks it sits between');
});

test('the top bar shows the progress of the open section, not of the whole set', () => {
  const js = tpl.match(/---- reading progress ----[\s\S]*?passive: true \}\)/)[0];
  assert.doesNotMatch(js, /document\.body\.scrollHeight/);
  assert.match(js, /getBoundingClientRect/);
  assert.match(tpl, /id="route-pos"/);
  assert.match(tpl, /\.route-pos \{[^}]*tabular-nums/);
});

// A section shorter than the viewport has nothing to scroll, and "100%" on a
// page the reader has not touched reads as a bug rather than as a fact.
test('the readout is blank when the whole section already fits on screen', () => {
  assert.match(tpl, /routePos\.textContent = span > 0 \?/);
});

test('the progress line sits on the top bar rather than above it', () => {
  assert.match(tpl, /#progress \{[^}]*top:\s*calc\(var\(--topbar-h\)/);
});

// A CSS counter cannot count pages that are not in the layout: with one
// document on screen the band read "Document 01" on every one of them. The bar
// carries "2 / 5", which is the thing the number was standing in for.
test('the document band is gone and the bar carries the position', () => {
  assert.doesNotMatch(tpl, /counter-increment/);
  assert.doesNotMatch(tpl, /counter\(doc/);
  assert.match(tpl, /\.page-pos \{[^}]*tabular-nums/);
});

// `.main a` is (0,1,1) and beats a bare class, so a row, a hit and a chip all
// grew the prose underline meant for links inside a sentence.
test('block links are not underlined like words in a sentence', () => {
  const rule = tpl.match(/\.main :is\([^)]*\.record-row[^)]*\) \{[^}]*\}/)[0];
  assert.match(rule, /\.page-chip/);
  assert.match(rule, /text-decoration:\s*none/);
});

test('every page gets a position and prev/next across its own section', () => {
  assert.match(tpl, /page-bar/);
  assert.match(tpl, /data-prev/);
  assert.match(tpl, /data-next/);
});

test('the rail routes from both levels instead of only toggling', () => {
  assert.match(tpl, /data-route/);
  assert.match(tpl, /nav-sec__head'\)/);
  assert.match(tpl, /nav-group__head'\)/);
});

/* ---------- view tabs ---------- */

test('view tab groups are styled and only the selected panel shows', () => {
  assert.match(tpl, /\.view-tabs \{/);
  assert.match(tpl, /\.view-tab\[aria-selected="true"\]/);
  assert.match(tpl, /\.view-panel\[hidden\] \{[^}]*display:\s*none/);
});

test('clicking a view tab swaps the panel and moves selection', () => {
  assert.match(tpl, /querySelectorAll\('\.view-tabs'\)/);
  assert.match(tpl, /ArrowRight/, 'tablist must be keyboard navigable');
});

/* ---------- definition grids and dead references ---------- */

test('definition grids lay out as a grid, not a stack of rows', () => {
  const rule = tpl.match(/\n\.def-grid \{[^}]*\}/)[0];
  assert.match(rule, /display:\s*grid/);
  assert.match(rule, /repeat\(auto-fill/);
});

test('a definition term outranks its body without being a heading', () => {
  assert.match(tpl, /\.def dt \{/);
  assert.match(tpl, /\.def dd \{/);
});

// A reference the viewer does not contain is rendered as text, so it must not
// borrow the link colour — that is the whole point of unwrapping it.
test('an external reference is visually distinct from a live link', () => {
  const rule = tpl.match(/\n\.ext-ref \{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /var\(--accent\)/);
  assert.match(rule, /var\(--font-mono\)/);
});

/* ---------- routed sections ---------- */

test('a section with an index is browsed from it', () => {
  assert.match(tpl, /querySelectorAll\('\.doc-section\[data-routed\]'\)/);
  assert.match(tpl, /dataset\.landing/);
});

test('the router reads and writes the hash so deep links survive', () => {
  assert.match(tpl, /hashchange/);
  assert.match(tpl, /location\.hash/);
});

test('a record inside an indexed section also gets a link back to the index', () => {
  assert.match(tpl, /data-back/);
  assert.match(tpl, /'\u2039 All records'/);
});

// The author's own index is prose and goes stale. This set's docs/adr/README.md
// lists four records by filenames the repository never had; behind a routed
// section that hid the other eleven completely. So it is counted, not assumed.
test('the index lists every record when the author list does not', () => {
  assert.match(tpl, /record-list/);
  assert.match(tpl, /linksAll/);
});

// Hiding 15 of 17 documents breaks Ctrl+F across them. The text is still in the
// DOM, so the index searches it directly and names the record that matched.
test('the index searches the bodies of the records it hides', () => {
  assert.match(tpl, /record-search/);
  assert.match(tpl, /record-hits/);
});

test('a deep link into a hidden record opens it before scrolling', () => {
  assert.match(tpl, /showPage/);
  assert.match(tpl, /scrollIntoView|scrollTo/);
});

// "One index page with comprehensive information" — a list of titles is not
// comprehensive. Each record states its own status under a Status heading, so
// the index can total them without the renderer parsing anything.
test('the index totals the statuses of the records it lists', () => {
  assert.match(tpl, /record-summary/);
  assert.match(tpl, /statusOf/);
  assert.match(tpl, /'status'/);
});

test('the search box goes after the index prose, not between it and the title', () => {
  assert.match(tpl, /tagName === 'P'/);
});

// The record bar sits above the record's title, so scrolling to the title
// itself puts the bar off screen and the reader loses prev/next.
test('landing on a page scrolls to the page, not past its bar', () => {
  assert.match(tpl, /\.page \{[^}]*scroll-margin-top/);
  assert.match(tpl, /classList\.contains\('doc-head'\)/);
});

// One record in a real set writes "**Status:** Accepted" as an inline label in
// its header block instead of under a Status heading. Both conventions count.
test('the status total reads an inline Status label as well as a heading', () => {
  assert.match(tpl, /Status:\\s\*\(\[A-Za-z\]\+\)|Status:\\s\*/);
});

/* ---------- record drawer ---------- */

// §14 Decisions tables every ADR, so a Decision Records rail section was the same
// set a second time. A record now opens over the page that referenced it — the
// reader keeps the row they clicked from in view behind the panel.
test('the drawer exists as chrome, with a scrim and a close control', () => {
  assert.match(tpl, /id="drawer"/);
  assert.match(tpl, /id="drawer-scrim"/);
  assert.match(tpl, /id="drawer-close"/);
  assert.match(tpl, /aria-label="Close record"/);
  // A dialog, not a div: the role is what tells a screen reader the page behind it
  // is not the thing to read.
  assert.match(tpl, /id="drawer"[^>]*role="dialog"/);
  assert.match(tpl, /id="drawer"[^>]*aria-modal="true"/);
});

test('the drawer slides rather than appearing, and is off-screen when shut', () => {
  const rule = tpl.match(/\n#drawer \{[^}]*\}/)[0];
  assert.match(rule, /position:\s*fixed/);
  assert.match(rule, /transform:\s*translateX\(100%\)/);
  assert.match(rule, /transition:[^;]*transform/);
  assert.match(tpl, /#drawer\.is-open \{[^}]*translateX\(0\)/);
});

// The record moves into the drawer rather than being cloned: a clone duplicates
// every heading id in it, and the first getElementById after that resolves to the
// copy nobody can see.
test('the record is moved into the drawer and put back on close', () => {
  const fn = tpl.match(/function openDrawer[\s\S]*?\n\}/)[0];
  assert.match(fn, /appendChild\(page\)/);
  assert.doesNotMatch(fn, /cloneNode/);
  const close = tpl.match(/function closeDrawer[\s\S]*?\n\}/)[0];
  assert.match(close, /appendChild/, 'the record has to go back where it came from');
});

// The hash is the point: a drawer nobody can link to cannot be pasted to a
// colleague or survive a reload.
test('opening a record puts its own route in the hash', () => {
  // Every anchor the renderer writes is a bare element id, and the router resolves
  // either form — but left alone the address bar would read
  // #doc-adr-0002-multi-tenancy while the panel says ADR 0002, and neither is the
  // route somebody would paste.
  assert.match(tpl, /location\.hash = '#\/' \+ page\.dataset\.route/);
  const nav = tpl.match(/function navigate\([\s\S]*?\n\}/)[0];
  assert.match(nav, /openDrawer/);
  assert.match(nav, /closeDrawer/);
  // The host page has to be in the layout before the record goes over it, or a
  // cold load at #/0002 opens the drawer onto nothing.
  assert.ok(nav.indexOf('showPage(page)') < nav.indexOf('openDrawer('),
    'the record must open after its host page is shown');
});

// Escape and Back are the two ways every drawer on the web closes; a panel that
// traps the reader is worse than no panel.
test('escape, the scrim and the close button all leave by the same path', () => {
  assert.match(tpl, /key === 'Escape' && openRecord\) leaveRecord\(\)/);
  assert.match(tpl, /drawerScrim\.addEventListener\('click', leaveRecord\)/);
  assert.match(tpl, /drawerClose\.addEventListener\('click', leaveRecord\)/);
  // Closing goes through the hash, so Back does the same thing by the ordinary
  // route and the panel can never disagree with the address bar.
  const leave = tpl.match(/function leaveRecord[\s\S]*?\n\}/)[0];
  assert.match(leave, /closeDrawer\(\)/);
  assert.match(leave, /location\.hash/);
  assert.match(tpl, /hashchange/);
});

// A record left hidden by the page router would open into an empty drawer.
test('the page router leaves record pages alone', () => {
  const show = tpl.match(/function showPage\([\s\S]*?\n\}/)[0];
  assert.match(show, /if \(!isRecord\(p\)\) p\.hidden/,
    'hiding a record that is in the drawer opens an empty drawer');
  // A record belongs to the section it came from, which is how it gets put back.
  assert.match(tpl, /recordHome\.set\(p, sec\)/);
  assert.match(tpl, /recordHome\.get\(openRecord\)\.appendChild/);
});

// Closing a record went through the host page's own route, and the router treats
// any route without an element id as "new page, start at the top" — so Escape
// threw the reader from §14 back to §1, and Back did the same. A route that
// resolves to the page already on screen is not a move.
test('closing a record leaves the host page where the reader left it', () => {
  const nav = tpl.match(/function navigate\([\s\S]*?\n\}/)[0];
  assert.match(nav, /var moved = page !== activePage/);
  assert.match(nav, /if \(moved\) scrollTo\(/);
  assert.doesNotMatch(nav, /\n\s*\{ scrollTo\(/,
    'an unconditional jump to the top is what lost the reader their place');
  // showPage assigns activePage, so the comparison has to happen before it.
  assert.ok(nav.indexOf('var moved') < nav.indexOf('showPage(page)'),
    'moved must be computed before showPage overwrites activePage');
});

/* ---------- state, focus, and the drawer's own label ---------- */

// The pill painted Accepted, Proposed and Superseded identically — text-faint on
// surface-3 — so the two records still up for decision in a set of fifteen looked
// exactly like the thirteen that were settled. statusOf() already extracts the
// leading word; nothing was reading it.
test('a status pill encodes which status it is', () => {
  assert.match(tpl, /\.record-row__s\[data-status="proposed"\]/);
  assert.match(tpl, /\.record-row__s\[data-status="superseded"\]/);
  assert.match(tpl, /\.record-row__s\[data-status="unrecorded"\]/);
  // Semantic colour is its own scale, not the teal accent: the accent already
  // means "link or brand" everywhere else in the page.
  assert.match(tpl, /--state-open:/);
  assert.match(tpl, /--state-stop:/);
  assert.doesNotMatch(tpl, /data-status="proposed"\] \{[^}]*var\(--accent\)/);
  // Both themes, or the ochre that reads on cream disappears on near-black.
  assert.ok(tpl.match(/--state-open:/g).length >= 2, 'state colours need a dark set too');
});

test('a superseded record is struck through, not merely recoloured', () => {
  const rule = tpl.match(/\.record-row__s\[data-status="superseded"\][^{]*\{[^}]*\}/)[0];
  assert.match(rule, /line-through/);
});

// An absent status is not a status. An outline says "nothing recorded here" where
// a filled pill would claim a value the record never gave.
test('an unrecorded status reads as absence', () => {
  const rule = tpl.match(/\.record-row__s\[data-status="unrecorded"\][^{]*\{[^}]*\}/)[0];
  assert.match(rule, /dashed/);
  assert.match(rule, /background:\s*none|background:\s*transparent/);
});

test('the pill carries the status it is painted from', () => {
  assert.match(tpl, /status\.dataset\.status = /);
});

// role="dialog" aria-modal="true" with focus left outside it: a keyboard reader
// opened a record and their next Tab walked the page behind the scrim. `inert`
// does the containment the manual trap would, and takes the page out of the
// accessibility tree at the same time.
test('the drawer takes focus and gives it back', () => {
  const open = tpl.match(/function openDrawer[\s\S]*?\n\}/)[0];
  assert.match(open, /document\.activeElement/, 'nothing remembers where focus came from');
  assert.match(open, /\.focus\(\)/);
  const close = tpl.match(/function closeDrawer[\s\S]*?\n\}/)[0];
  assert.match(close, /\.focus\(\)/, 'focus has to return to the row that opened it');
});

test('the page behind the drawer is inert while it is open', () => {
  assert.match(tpl, /function setBehindInert/);
  assert.match(tpl, /\.inert = /);
});

// A 90-char ADR title in 10.5px uppercase letter-spaced mono is an eyebrow
// treatment applied to a paragraph. The H1 two lines below already says it.
test('the drawer bar names the record rather than repeating its title', () => {
  assert.match(tpl, /function recordLabel/);
  const fn = tpl.match(/function recordLabel[\s\S]*?\n\}/)[0];
  assert.match(fn, /split\(':'\)/);
  // The full title is still the dialog's accessible name.
  assert.match(tpl, /drawerEl\.setAttribute\('aria-label'/);
});

test('the drawer bar shows the record status beside its name', () => {
  assert.match(tpl, /id="drawer-status"/);
});

// The four provenance words are a closed vocabulary and now render as their own
// element; they need a treatment that is not the code chip they used to borrow.
test('a provenance marker is styled as evidence, not as code', () => {
  assert.match(tpl, /\.prov \{/);
  const rule = tpl.match(/\.prov \{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /var\(--accent-soft\)/, 'that is the code chip it was mistaken for');
});

// ---------------------------------------------------------------------------
// Robustness and consistency pass. Each of these was a rule the template states
// somewhere else and then breaks here, or a failure with no visible state.
// ---------------------------------------------------------------------------

const ref = readFileSync(new URL('../../references/viewer.md', import.meta.url), 'utf8');

// `overflow-x: auto` computes overflow-y from `visible` to `auto` — the same fact
// the tab bar's rule already documents. So .table-scroll is a scrollport, and
// without a height it never scrolls: the sticky header sticks to a box that
// cannot move, and a 40-row table scrolls its heading off under the top bar.
test('a table taller than the screen keeps its header in view', () => {
  const scroll = tpl.match(/\.table-scroll \{[\s\S]*?\}/)[0];
  assert.match(scroll, /max-height:/, 'a scrollport with no height never scrolls');
  assert.match(tpl, /\nth \{[\s\S]*?position:\s*sticky/);
});

// The boot script runs before the body paints. localStorage throws when site
// data is blocked and in some file:// contexts, and this viewer is meant to open
// by double-click off a filesystem — an unguarded throw loses the theme and
// every script after it.
test('a blocked or file:// localStorage cannot stop the page painting', () => {
  const uses = [...tpl.matchAll(/localStorage\.\w+/g)];
  assert.ok(uses.length >= 2, 'the theme is still read and written');
  for (const use of uses) {
    const before = tpl.slice(Math.max(0, use.index - 300), use.index);
    assert.match(before, /try\s*\{/, `unguarded ${use[0]}`);
  }
});

// mermaid.render rejects on a syntax error. Unhandled, the element keeps its raw
// source text and the reader sees a slab of DSL in a diagram shell.
test('a diagram that fails to render says so instead of going blank', () => {
  const fn = tpl.match(/async function renderMermaid[\s\S]*?\n\}/)[0];
  assert.match(fn, /catch/);
  assert.match(tpl, /\.diagram-error/);
});

// The 2px accent ring is the one focus treatment every interactive surface
// gets. Each entry here is a real tab stop with its own :focus-visible rule.
test('every interactive surface shows the same focus ring', () => {
  const surfaces = [
    '.nav-link', '.icon-btn', '.view-tab', '.page-chip', '.record-row',
    '.record-hit', '.nav-sec__head', '.nav-group__head',
    '.diagram-toolbar button', '.diagram-viewport', '.help-btn',
  ];
  for (const sel of surfaces) {
    assert.match(tpl, new RegExp(`\\${sel}[^{]*:focus-visible`), `${sel} has no focus ring`);
  }
});

// .main is already offset by the rail and its own padding, so subtracting them
// again from 100vw restates the layout — and 100vw counts the scrollbar gutter,
// clipping ~15px of every block on Windows and Linux.
test('the measure is the column it sits in, not the viewport minus the rail', () => {
  const measure = tpl.match(/--measure:[^;]+;/)[0];
  assert.doesNotMatch(measure, /100vw/, 'includes the scrollbar gutter');
  assert.match(measure, /min\(96ch,\s*100%\)/);
  const narrow = tpl.match(/@media \(max-width: 960px\) \{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(narrow, /--measure:/, '96ch already loses to 100% at this width');
});

// Without a declared scheme the browser paints the canvas white before the boot
// script runs, so a dark-mode reader gets a flash — and the UA scrollbar and the
// search field's clear button stay light inside a dark page.
test('the head states its colour scheme (dark first), its icon and its description', () => {
  assert.match(tpl, /<meta name="color-scheme" content="dark light">/);
  assert.match(tpl, /<html lang="en" data-theme="dark">/);
  assert.match(tpl, /<link rel="icon"[^>]*data:image\/svg\+xml/);
  assert.match(tpl, /<meta name="description"/);
});

test('the scroll spy reads the bar height rather than restating it', () => {
  assert.doesNotMatch(tpl, /'-' \+ \(60\) \+ 'px/);
  assert.match(tpl, /getPropertyValue\('--topbar-h'\)/);
});

test('no rule is declared twice', () => {
  const preCode = tpl.match(/^pre code \{/gm) || [];
  assert.equal(preCode.length, 1, `pre code declared ${preCode.length} times`);
});

// The reference describes the rejected design: content-width tables were what
// gave a page of them a ragged right edge, and the template has shipped a single
// full width for a while.
test('the viewer reference describes the table rule the template ships', () => {
  assert.doesNotMatch(ref, /width:\s*max-content/);
  assert.match(tpl.match(/\ntable \{[\s\S]*?\}/)[0], /width:\s*100%/);
});

// Step 2 used to say: npm pack mermaid, read the built ESM off disk, splice it
// in. Mermaid 11.x ships code-split ESM — no single file on disk carries the
// whole library, and none of them leaves a top-level `mermaid` binding once
// inlined, which is the one thing the template's init line needs. The procedure
// could not be followed, and nothing failed until a human tried it.
test('the documented mermaid bundle step produces the bindings the template needs', () => {
  const entry = ref.match(/```js\n([^`]*globalThis\.mermaid[^`]*)```/);
  assert.ok(entry, 'no entry file is shown that binds mermaid globally');
  assert.match(entry[1], /globalThis\.mermaid\s*=/);
  assert.match(entry[1], /globalThis\.elkLayouts\s*=/);
  const cmd = ref.match(/npx esbuild[^\n]*/);
  assert.ok(cmd, 'no bundling command is given');
  assert.match(cmd[0], /--bundle/);
  // IIFE, not esm: an inlined `export` has nothing to bind to, which is the
  // failure the old wording walked into.
  assert.match(cmd[0], /--format=iife/);
});

test('the reference no longer claims the ESM ships ready to splice', () => {
  const step = ref.match(/\n2\. \*\*[\s\S]*?\n3\. \*\*/)[0];
  assert.doesNotMatch(step, /read the built ESM file\s*\n?\s*off disk/);
  // `npm pack` was the whole of the old procedure. Naming it as the source of a
  // spliceable file is the same instruction under another verb.
  assert.doesNotMatch(step, /`npm pack`[^\n]*then read/);
  assert.match(step, /code-split/, 'the reason a bundling step exists is the fact worth keeping');
});

// ---------------------------------------------------------------------------
// Pinning a diagram. Diagrams are the payload of an architecture set and they
// sit inline in the flow, so scrolling to the paragraph that explains a
// container scrolls the container view off the screen. Expand and fullscreen
// both cover the prose, which answers a different question.
// ---------------------------------------------------------------------------

test('the diagram toolbar offers a pin', () => {
  const bar = tpl.match(/function buildToolbar[\s\S]*?\n\}/)[0];
  assert.match(bar, /data-pin/);
  assert.match(bar, /data-pin aria-pressed="false"/, 'a toggle has to say which way it is');
});

test('a pinned diagram stops scrolling with the document', () => {
  const rule = tpl.match(/\.diagram-shell\.is-pinned \{[^}]*\}/)[0];
  assert.match(rule, /position:\s*fixed/);
  assert.match(rule, /width:\s*var\(--pin-w\)/);
});

// A fixed pane over the column would cover the prose it was pinned to read
// alongside, which is the whole point lost.
test('the pinned pane is given its own gutter rather than covering the column', () => {
  assert.match(tpl, /body\.has-pin \.main \{[^}]*padding-right/);
});

// Removing 320px+ from the flow shortens the document under the reader, and the
// browser keeps the scroll offset — so the page jumps by the height of whatever
// was pinned.
test('the vacated space is held open while a diagram is pinned', () => {
  assert.match(tpl, /\.diagram-slot \{/);
  const js = tpl.match(/function slotFor[\s\S]*?\n\}/)[0];
  assert.match(js, /offsetHeight/, 'the placeholder has to be the height it replaced');
});

test('pinning a second diagram releases the first', () => {
  const fn = tpl.match(/function pinDiagram[\s\S]*?\n\}/)[0];
  assert.match(fn, /unpinDiagram\(\)/, 'nothing releases the diagram already pinned');
});

// The same exit the expand overlay got, for the same reason: a state entered by
// a button the reader has since scrolled away from needs a key that always works.
// Anchored on the diagram handler by name: there is a second Escape listener for
// the rail filter, and a generic `e.key !== 'Escape'` match finds whichever the
// file happens to declare first.
test('escape releases a pinned diagram', () => {
  const handler = tpl.match(/if \(e\.key !== 'Escape'\) return;[\s\S]*?is-expanded[\s\S]*?\n\}\);/)[0];
  assert.match(handler, /unpinDiagram\(\)/);
});

// Paper has no viewport to pin against. A fixed pane prints once, over page one.
test('print puts a pinned diagram back in the flow', () => {
  const print = tpl.match(/@media print \{[\s\S]*?\n\}/)[0];
  assert.match(print, /\.is-pinned[^}]*position:\s*static/);
  assert.match(print, /\.diagram-slot[^}]*display:\s*none/);
});

// Below the breakpoint the column already has the screen to itself, so there is
// no gutter to put a pane in — offering the control would promise a layout the
// viewport cannot give.
test('the pin is withdrawn where there is no room for a pane', () => {
  const narrow = tpl.match(/@media \(max-width: 1200px\) \{[\s\S]*?\n\}/);
  assert.ok(narrow, 'no breakpoint withdraws the pin');
  assert.match(narrow[0], /\[data-pin\][^}]*display:\s*none/);
  assert.match(narrow[0], /\.diagram-shell\.is-pinned[^}]*position:\s*(relative|static)/,
    'a diagram pinned before the resize stays stuck to a viewport with no gutter');
});

// The cap that makes the sticky header work is a screen affordance: paper has no
// scrollport, so a table taller than it would simply lose its last rows.
test('a capped table is uncapped for print', () => {
  const print = tpl.match(/@media print \{[\s\S]*?\n\}/)[0];
  assert.match(print, /\.table-scroll[^}]*max-height:\s*none/);
});

// ---------------------------------------------------------------------------
// Reaching the page without a mouse, and reaching a diagram without either a
// mouse or a keyboard-shaped assumption about who is reading.
// ---------------------------------------------------------------------------

// DOM order is topbar, rail, prose. A real set puts ~120 rail links between the
// two, and a keyboard reader had to walk every one of them to reach a sentence.
test('a keyboard reader can reach the document without walking the rail', () => {
  assert.match(tpl, /class="skip"[^>]*href="#main-content"/);
  assert.match(tpl, /<main[^>]*id="main-content"/);
  // Focus has to be able to land there, or the link moves the viewport and
  // leaves the tab position back up in the rail.
  assert.match(tpl, /<main[^>]*tabindex="-1"/);
  const body = tpl.slice(tpl.indexOf('<body>'));
  assert.ok(body.indexOf('class="skip"') < body.indexOf('<button'),
    'the skip link is not the first focusable thing in the body');
});

// It sits outside .main, so the drawer's own inert call does not cover it — and
// a skip link that works from behind a modal scrim lands the reader nowhere.
test('the skip link goes inert with the rest of the page behind a record', () => {
  const fn = tpl.match(/function setBehindInert[\s\S]*?\n\}/)[0];
  assert.match(fn, /\.skip/);
});

// The mouse pair never fires for touch, so a diagram on a phone could be zoomed
// and then not moved. Capture also retires the two document-level listeners this
// added once per diagram.
test('a diagram pans by pointer capture rather than by mouse events', () => {
  assert.match(tpl, /pointerdown/);
  assert.match(tpl, /setPointerCapture/);
  assert.doesNotMatch(tpl, /addEventListener\('mousedown'/);
  assert.doesNotMatch(tpl, /addEventListener\('mousemove'/);
});

// `touch-action: none` on a diagram sitting at 1:1 eats the page scroll of any
// reader whose finger happens to land on it while reading.
test('touch panning is claimed only when there is something to pan', () => {
  assert.match(tpl, /\.diagram-viewport\.is-pannable[^{]*\{[^}]*touch-action:\s*none/);
  assert.match(tpl, /function pannable/);
  const base = tpl.match(/\n\.diagram-viewport \{[\s\S]*?\}/)[0];
  assert.doesNotMatch(base, /cursor:\s*grab/, 'a grab cursor promises movement that cannot happen');
});

test('a zoomed diagram can be panned from the keyboard', () => {
  assert.match(tpl, /viewport\.tabIndex\s*=\s*0/);
  assert.match(tpl, /ArrowLeft/);
  // At 1:1 the arrows belong to the page: a reader who tabbed into a diagram on
  // the way down the document must not find their scroll keys taken.
  const keys = tpl.match(/function wireKeys[\s\S]*?\n\}/)[0];
  assert.match(keys, /is-pannable/);
  assert.match(tpl, /\.diagram-viewport:focus-visible/);
  // The viewport is built in script, so its name is set rather than written.
  assert.match(tpl, /setAttribute\('aria-label',[\s\S]{0,40}'Diagram\. Arrow keys pan/);
});

// The fullscreen path gets Escape from the browser. The expand path is an
// ordinary fixed overlay covering the viewport, and had no way out but the
// button that opened it.
test('the expand overlay can be left by Escape and reports its state', () => {
  assert.match(tpl, /data-expand aria-pressed="false"/);
  // Named against the expanded-shell query, because the rail filter now has an
  // Escape guard of its own and it comes first in the file.
  assert.match(tpl,
    /if \(e\.key !== 'Escape'\) return;[\s\S]{0,240}?querySelectorAll\('\.diagram-shell\.is-expanded'\)/,
    'no Escape handler for the expanded overlay');
});

// ---------------------------------------------------------------------------
// Searching and printing the set rather than the page that happens to be open.
// ---------------------------------------------------------------------------

// Ctrl+F reaches the open page; a routed section's index reaches its records.
// Every other document in the set was reachable by neither — the rail filter
// only ever matched heading labels.
test('the whole set is searchable, not only the page on screen', () => {
  assert.match(tpl, /docText/);
  const grp = tpl.match(/function filterGroup[\s\S]*?\n\}/)[0];
  assert.match(grp, /docText|bodyHas/, 'the rail filter still reads headings only');
});

// The bar prepends "All records 3 / 15 Prev Next" to every page. Captured after
// it, those become words the filter matches in every document at once.
test('document text is captured before the page bars are prepended', () => {
  const captured = tpl.indexOf('docText.set');
  const bars = tpl.indexOf('barEl(walk, i');
  assert.ok(captured > 0, 'nothing captures document text');
  assert.ok(captured < bars, 'document text is captured after the bars are added');
});

// The reader typed a phrase and got back a row whose visible labels do not
// contain it. Unexplained, that row reads as a bug in the filter.
test('a document matched only on its body text says so', () => {
  assert.match(tpl, /is-body-hit/);
});

test('a record search with no hits says so rather than going blank', () => {
  assert.match(tpl, /record-empty/);
});

// Every page is already in the DOM, only hidden. Paper has no router.
test('printing prints the whole set, not the page on screen', () => {
  const print = tpl.match(/@media print \{[\s\S]*?\n\}/)[0];
  assert.match(print, /\.doc-section\[hidden\]/);
  assert.match(print, /\.page-bar/, 'prev/next chips are navigation, not content');
  assert.match(print, /#drawer/, 'an open record prints from the drawer or not at all');
});

test('the filter is one keystroke away and Escape leaves it', () => {
  assert.match(tpl, /e\.key === '\/'/);
  assert.match(tpl, /e\.metaKey \|\| e\.ctrlKey/);
  const esc = tpl.match(/filter\.addEventListener\('keydown'[\s\S]*?\n\}\);/)[0];
  assert.match(esc, /Escape/);
  // The same key closes the mobile rail and any open record, and a reader
  // clearing a search asked for neither.
  assert.match(esc, /stopPropagation/);
});

// ---------------------------------------------------------------------------
// Diagram state the reader can see, movement they cannot lose, and a router
// that does not animate its way across a document nobody asked to read.
// ---------------------------------------------------------------------------

// The button said 1:1 at every zoom level, so the only readout of the diagram's
// state was the diagram, and the only way to learn what the button did was to
// press it.
test('the zoom control reads out the level it resets', () => {
  assert.match(tpl, /Math\.round\(zoom \* 100\)/);
  const css = tpl.match(/\[data-zoom-reset\] \{[\s\S]*?\}/)[0];
  assert.match(css, /tabular-nums/, 'a live number in proportional digits shoves its neighbours');
});

// Pan was unbounded: the canvas could be thrown clear of the viewport, and the
// way back was a button the reader had to already know was a reset.
test('a panned diagram cannot be dragged out of its own frame', () => {
  assert.match(tpl, /function panLimit/);
  // Clamped on the way to every transform write, so zoom, pan and reset all get
  // it rather than three call sites each remembering to.
  assert.match(tpl, /clampPan\(\);\s*canvas\.style\.transform/);
});

test('a route change lands instantly and an in-page anchor still glides', () => {
  const nav = tpl.match(/function navigate[\s\S]*?\n\}/)[0];
  assert.match(nav, /'instant'/);
  assert.match(nav, /moved/);
  // Passing behavior explicitly outranks the CSS, so the reduced-motion rule
  // that used to cover this no longer does on its own.
  assert.match(tpl, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
});

/* ---------- section explainers ---------- */

// The viewer explains the system and never the sections themselves, so a reader
// who lands on a heading they do not recognise has nowhere to turn. arc42 heads
// each chapter with a fixed explanation; this is the same affordance.
test('a spine heading gets a help toggle bound to a details panel', () => {
  const fn = tpl.match(/function helpEntryFor[\s\S]*?\n\}/)[0];
  // Keyed on heading text, not on the id: slugify keeps both spaces around a
  // stripped "&", and h2/h3 share one dedupe registry, so the slug can shift
  // under a heading without anything failing.
  assert.doesNotMatch(fn, /\.id\]/, 'keying on the id is the bug this avoids');
  assert.match(fn, /ARCH_DOCS_HELP/);
  // The <details> element itself is built in helpPanel, not injectSectionHelp.
  const panel = tpl.match(/function helpPanel[\s\S]*?\n\}/)[0];
  assert.match(panel, /'details'/);
  assert.match(panel, /help__body/);
});

// The anchor loop prepends a '#' to the heading, so reading textContent after it
// runs looks up "#Core Components" and finds nothing. Scoped to the loop body,
// because `function injectSectionHelp(h, title)` also contains the call pattern
// and sits above the loop — matching against the whole file would pass on the
// declaration and prove nothing about the order things actually happen in.
test('the heading text is read before the deep-link anchor is prepended', () => {
  const loop = tpl.match(/document\.querySelectorAll\('\.doc h1[\s\S]*?\n\}\);/)[0];
  const read = loop.indexOf('h.textContent');
  const call = loop.indexOf('injectSectionHelp(');
  const prepend = loop.indexOf('h.prepend(a)');
  assert.ok(read >= 0, 'the loop never reads the heading text');
  assert.ok(call >= 0, 'help is not injected in the heading pass');
  assert.ok(read < prepend, 'the title is read after the anchor is prepended');
  assert.ok(call < prepend, 'the explainer is injected after the anchor is prepended');
});

// A toggle that does not say which way it is set is unreadable to a screen
// reader, and the viewer already holds this line for its other toggles.
test('the help toggle reports its own state and names what it controls', () => {
  const fn = tpl.match(/function helpButton[\s\S]*?\n\}/)[0];
  assert.match(fn, /aria-expanded/);
  assert.match(fn, /aria-label/, 'the button needs an accessible name');
  // The panel's summary is hidden because the button drives it, so aria-controls
  // is the only thing tying the state to the thing in that state.
  assert.match(fn, /aria-controls/);
  assert.match(fn, /panel\.id/);
});

// Reading progress is derived from scroll offsets, so a panel opening under the
// heading moves the readout. The move is reader-initiated, so recomputing is
// enough — but nothing recomputes on its own.
test('opening a panel resettles the reading progress readout', () => {
  const fn = tpl.match(/function wireHelpToggle[\s\S]*?\n\}/)[0];
  assert.match(fn, /tick\(\)/, 'the progress readout keeps a stale span');
});

// Companion documents get one explainer under the h1, keyed by kind rather than
// by heading text — the spec scopes per-heading explainers to the spine only.
test('a companion document is explained once, at its title', () => {
  const fn = tpl.match(/function helpEntryFor[\s\S]*?\n\}/)[0];
  assert.match(fn, /companions/);
  // Read via the DOM property, not the attribute string: data-kind itself is
  // written by pageEl in doc-sections.mjs, not spelled out in the template.
  assert.match(fn, /dataset\.kind/);
  assert.match(fn, /tagName === 'H1'/);
});

// Excluded by the spec: §14 Decisions is already a spine section and already the
// home for what an ADR is, so a per-record explainer is that guidance a second
// time across seventeen records.
test('only the spine gets per-heading explainers', () => {
  const fn = tpl.match(/function helpEntryFor[\s\S]*?\n\}/)[0];
  assert.match(fn, /\[data-kind="spine"\]|kind === 'spine'/);
  assert.doesNotMatch(fn, /h3/, 'subheadings are out of scope');
});

// The button is chrome. Paper gets the prose, and a closed panel prints closed.
test('print drops the help toggle', () => {
  const print = tpl.match(/@media print \{[\s\S]*?\n\}/)[0];
  assert.match(print, /\.help-btn/);
});

// The <details> stays in the flow even with its toggle hidden, and it still
// carries its own margin — hiding only the button leaves a blank box the
// height of a collapsed panel behind every heading.
test('print drops the whole help panel, not just its toggle', () => {
  const print = tpl.match(/@media print \{[\s\S]*?\n\}/)[0];
  assert.match(print, /details\.help[^{]*\{[^}]*display:\s*none/);
});

test('the help panel and its toggle are styled', () => {
  assert.match(tpl, /\.help-btn \{/);
  assert.match(tpl, /details\.help \{|\.help \{/);
  // A 40px hit area is the standard this template already holds for icon buttons.
  assert.match(tpl, /\.help-btn::after \{[^}]*inset:/);
});
