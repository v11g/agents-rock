# Real Scores at STANDARD Depth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At STANDARD/DEEP depth, persist the five human-judged factor scores per feature (with rubric anchor, evidence cite and a plain-words note), validate them, and read them verbatim in the page and xlsx instead of deriving fake scores from hours.

**Architecture:** Scores become an input field on `features[]`, checked by a new `scoring-schema.mjs` against a rubric that moves out of the HTML into `references/scoring-guide.md`. `rollup.mjs` copies Σ and tier into `computed.features`; the page and the xlsx export read those. A new `score-review.mjs` CLI writes a CSV or an HTML review page from the agent's draft and diffs the human's edits back. QUICK depth, compute math, scenarios, Summary block, roadmap and `/proposal` do not change.

**Tech Stack:** Node ≥ 20 ESM, `node:test`, dependency-free. Browser tests drive headless Chrome through `analyze-requirements/scripts/lib/{chrome,cdp}.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-15-scoring-path-design.md`

## Global Constraints

- Quality gates (`analyze-requirements/scripts/lib/quality-gate.mjs`): module files ≤ 200 lines, ≤ 10 functions (a `function` declaration or an `=> {` arrow each count), ≤ 22 code lines per function, ≤ 3 parameters. Template `<script>` blocks: per-function limits only.
- `estimate-math.mjs`, `rollup.mjs`, `checks.mjs` are each at 10 functions already. New logic goes in new modules; those files get imports and one-line calls only.
- Test command from repo root: `npm test` (runs `node --test tests/*.test.mjs plugins/*/skills/*/scripts/test/*.test.mjs`). Single file: `node --test plugins/solution-architect/skills/estimate/scripts/test/<file>`.
- TDD: write the failing test, run it, see it fail, then implement.
- Commits: Conventional Commits, imperative, ≤ 50 char subject, no AI attribution lines.
- Spec deviation, agreed here: the estimate page reads `computed.features[].tier` and does not inline `tierFor` (D4 said "inlined beside `pert`"). `tierFor` is inlined into the **review** page instead, where Σ/tier update live as the human edits.
- Every anchor string in fixtures and tests must match `references/scoring-guide.md` byte for byte (en dash `–`, em dash `—`, `<1 day`, `R&D`).
- Paths below are relative to `plugins/solution-architect/skills/estimate/` unless they start with `docs/` or `~/`.

---

## File map

| File | Role |
| --- | --- |
| `references/scoring-guide.md` (new) | The rubric: 5 rows × 5 anchors, tier scale, provenance note. Single source for interview, validator, page, review page. |
| `scripts/lib/scoring.mjs` (new) | `SCORE_FACTORS`, `FACTOR_LABELS`, `loadGuide()`, `guideTableHtml()`, `scoreNumbers()`, `scoreSummary()`, `bandFor()`. |
| `scripts/lib/scoring-schema.mjs` (new) | `checkScoring(inputs, out)`: depth enum, per-feature score rules by depth. |
| `scripts/lib/md-tables.mjs` (new) | `heading()`, `tables()` moved out of `checks.mjs` so two check modules share them. |
| `scripts/lib/scoring-checks.mjs` (new) | `scoringFindings({ md, estimation })`: Summary `Tier` cell equals computed tier. |
| `scripts/lib/estimate-math.mjs` | `TIER_BREAKS` → S ≤ 11 / M ≤ 17 / L ≤ 22 / XL. |
| `scripts/lib/schema.mjs` | one import, one call. |
| `scripts/lib/rollup.mjs` | one import, spread `scoreSummary(feature)` into `features[id]`. |
| `scripts/lib/checks.mjs` | imports `heading`/`tables` from `md-tables.mjs` (re-exported for `agentic-checks.mjs`), calls `scoringFindings`. |
| `scripts/render.mjs` | `GUIDE` slot for the team template. |
| `assets/estimate-template.html` | delete derivation + mode toggle; scored column set; anchors on hover; ⚑ / ⚠; note subline; guide from slot; xlsx column N + Score Rationale tab. |
| `scripts/lib/score-csv.mjs` (new) | `toCsv(draft)`, `parseCsv(text)`, `fromCsv(text)`. |
| `scripts/lib/score-diff.mjs` (new) | `diffScores(draft, edited)`, `applyDiff({ draft, diff, guide })`. |
| `scripts/lib/score-html.mjs` (new) | `toHtml({ draft, template, guideHtml, mathSrc })`. |
| `assets/scores-review-template.html` (new) | Review page: one `<select>` per score, live Σ/tier, copy-feedback block. |
| `scripts/score-review.mjs` (new) | CLI: `--write` / `--read`. |
| `scripts/test/fixtures/booking-inputs.json` | scores on both features, `XL` calibration band. |
| Tests | `scoring.test.mjs`, `score-review.test.mjs` new; `schema`, `estimate-math`, `compute`, `validate`, `render`, `browser`, `xlsx-export`, `references` extended. |
| Docs | `references/interview.md`, `references/techniques.md`, `references/writing.md`, `SKILL.md`, `README.md`. |

---

### Task 1: Scoring guide file, tier scale, and the `scoring.mjs` helpers

**Files:**
- Create: `references/scoring-guide.md`
- Create: `scripts/lib/scoring.mjs`
- Create: `scripts/test/scoring.test.mjs`
- Modify: `scripts/lib/estimate-math.mjs:13-15` (`TIER_BREAKS`)
- Modify: `scripts/test/estimate-math.test.mjs:21-27`
- Modify: `scripts/test/references.test.mjs:8-9, 23-30`

**Interfaces:**
- Produces: `SCORE_FACTORS = ['tech','size','deps','unc','risk']`; `FACTOR_LABELS` (`tech → 'Tech complexity'`, `size → 'Feature size'`, `deps → 'Dependencies'`, `unc → 'Uncertainty'`, `risk → 'Risk'`); `loadGuide(path?) → { tech: [a1..a5], size: [...], deps, unc, risk }`; `guideTableHtml(guide) → '<table class="guide-table">…</table>'`; `scoreNumbers(scores) → { tech: n, … }`; `scoreSummary(feature) → { scoreTotal, tier } | {}`; `bandFor(tier, calibration) → [low, high] | undefined`.
- `TIER_BREAKS` becomes `[{max:11,'S'},{max:17,'M'},{max:22,'L'},{max:Infinity,'XL'}]`; `tierFor(scores)` unchanged (sums `Object.values`).

- [ ] **Step 1: Write the guide**

Create `references/scoring-guide.md`:

````markdown
# Scoring guide — five factors, 1–5 each

Read before proposing any score (interview step 3). Every anchor below is
quoted verbatim on a score card, in `estimation-inputs.json`
(`scores.<factor>.anchor`), on the page and in the xlsx Score Rationale tab.
`schema.mjs` refuses an anchor that is not one of these sentences.

| Dimension | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Tech complexity | Standard CRUD, well-documented library usage, copy-paste patterns | Minor customisation of standard patterns, simple state management | Custom business logic, moderate algorithm complexity, multiple states | Non-trivial algorithms, real-time systems, ML inference, complex data transforms | Novel architecture, distributed systems, low-level optimisation, R&D territory |
| Feature size | Single UI element or micro-function, <1 day of work | Small self-contained feature, simple form or display component | Medium feature with multiple components and backend logic | Large feature spanning frontend, backend, DB, and tests | Epic-scale feature, multiple sub-features or screens |
| Dependencies | Fully standalone, no external services or shared state | One internal dependency (e.g. auth check) | 2–3 internal services or one third-party API | Multiple third-party APIs or tightly coupled internal systems | Deep cross-system dependencies, legacy integrations, or shared infrastructure changes |
| Uncertainty | Fully defined spec, clear acceptance criteria, precedent exists | Minor ambiguities, can be resolved with one clarifying question | Some open questions, design decisions to be made during build | Significant unknowns, exploratory work needed, spec may change | Highly experimental, no clear solution path, outcomes unclear |
| Risk | Fully reversible, no user data, isolated module | Low stakes, easy rollback, minimal user impact | Moderate impact if broken, requires testing, affects multiple users | Payments, auth, data migrations, or PII — high business impact | Core infrastructure, compliance requirements, irreversible operations |

Tier scale (sum of the five scores): S ≤ 11 · M 12–17 · L 18–22 · XL 23+.
Default calibration bands when the org has no history: S 20–60 h · M 60–160 h
· L 160–400 h · XL 400–800 h. A card at Σ 11, 17 or 22 sits one point from
the next tier and says so; Σ 23+ recommends splitting the feature.

Provenance: a score the human accepted as the agent proposed it is
`proposed`; a score the human changed — or a rewritten plain-words note — is
`stated`. One `scoreProvenance` per feature: `stated` if any cell changed.
````

- [ ] **Step 2: Write the failing tests**

Create `scripts/test/scoring.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE_FACTORS, FACTOR_LABELS, loadGuide, guideTableHtml, scoreNumbers, scoreSummary, bandFor,
} from '../lib/scoring.mjs';

test('the guide loads five factors with five anchors each, in factor order', () => {
  const guide = loadGuide();
  assert.deepEqual(Object.keys(guide), SCORE_FACTORS);
  for (const k of SCORE_FACTORS) assert.equal(guide[k].length, 5, `${k} needs 5 anchors`);
  assert.equal(guide.risk[3], 'Payments, auth, data migrations, or PII — high business impact');
  assert.equal(guide.deps[2], '2–3 internal services or one third-party API');
  assert.equal(guide.size[0], 'Single UI element or micro-function, <1 day of work');
});

test('guideTableHtml escapes and labels every row', () => {
  const html = guideTableHtml(loadGuide());
  assert.match(html, /<table class="guide-table">/);
  for (const label of Object.values(FACTOR_LABELS)) assert.ok(html.includes(label), label);
  assert.ok(html.includes('&lt;1 day of work'), 'anchors are HTML-escaped');
  assert.equal((html.match(/<tr>/g) ?? []).length, 6); // header + 5 rows
});

const scored = {
  id: 'f', scores: {
    tech: { n: 3, anchor: 'a', cite: 'c' }, size: { n: 3, anchor: 'a', cite: 'c' },
    deps: { n: 2, anchor: 'a', cite: 'c' }, unc: { n: 3, anchor: 'a', cite: 'c' },
    risk: { n: 3, anchor: 'a', cite: 'c' },
  },
};

test('scoreNumbers strips anchors and cites; scoreSummary sums and tiers', () => {
  assert.deepEqual(scoreNumbers(scored.scores), { tech: 3, size: 3, deps: 2, unc: 3, risk: 3 });
  assert.deepEqual(scoreSummary(scored), { scoreTotal: 14, tier: 'M' });
  assert.deepEqual(scoreSummary({ id: 'q', tasks: [] }), {});
});

test('bandFor reads the calibration table by tier', () => {
  const cal = { S: [20, 60], M: [60, 160], L: [160, 400], XL: [400, 800] };
  assert.deepEqual(bandFor('L', cal), [160, 400]);
  assert.equal(bandFor('XL', { S: [20, 60] }), undefined);
  assert.equal(bandFor(undefined, cal), undefined);
});
```

Append to `scripts/test/estimate-math.test.mjs` after the existing tier test:

```js
test('tier breaks are the workbook scale: S ≤ 11, M ≤ 17, L ≤ 22, XL above', () => {
  const at = (total) => tierFor({ a: total }).tier;
  assert.equal(at(11), 'S');
  assert.equal(at(12), 'M');
  assert.equal(at(17), 'M');
  assert.equal(at(18), 'L');
  assert.equal(at(22), 'L');
  assert.equal(at(23), 'XL');
});
```

In `scripts/test/references.test.mjs`: add `'scoring-guide.md'` to `ALL`; change the techniques assertion line to

```js
  assert.ok(doc.includes('12–17 M') || doc.includes('12-17 M'), 'tier breaks must match TIER_BREAKS');
```

and append:

```js
test('scoring-guide.md carries five rows of five anchors and the tier scale', () => {
  const doc = ref('scoring-guide.md');
  const rows = doc.split('\n').filter((l) => /^\| (Tech complexity|Feature size|Dependencies|Uncertainty|Risk) \|/.test(l));
  assert.equal(rows.length, 5);
  for (const r of rows) assert.equal(r.split('|').length - 2, 6, r); // label + 5 anchors
  assert.match(doc, /S ≤ 11 · M 12–17 · L 18–22 · XL 23\+/);
  assert.match(doc, /XL 400–800 h/);
  assert.doesNotMatch(doc, /derived:/);
});
```

- [ ] **Step 3: Run the tests to see them fail**

```bash
node --test scripts/test/scoring.test.mjs scripts/test/estimate-math.test.mjs scripts/test/references.test.mjs
```

Expected: `scoring.test.mjs` fails with `Cannot find module '../lib/scoring.mjs'`; the new tier test fails (`at(11)` is `'M'`, `at(23)` is `'L'`); the references test fails on `12–17 M` (doc still says `11-17 M`) and on the missing guide file.

- [ ] **Step 4: Update `TIER_BREAKS`**

In `scripts/lib/estimate-math.mjs` replace lines 13–15 with:

```js
// The team workbook's tier scale (its sheet-1 formula and Tier Reference tab):
// one scale for the interview, the validator, the page and the xlsx export.
export const TIER_BREAKS = [
  { max: 11, tier: 'S' }, { max: 17, tier: 'M' }, { max: 22, tier: 'L' }, { max: Infinity, tier: 'XL' },
];
```

- [ ] **Step 5: Write `scripts/lib/scoring.mjs`**

```js
// Factor scores are human judgments recorded in estimation-inputs.json.
// This module owns their vocabulary, the rubric loader (references/
// scoring-guide.md is the single source of anchor text), and the two
// derived facts compute copies into estimation.json: Σ and tier.
import { readFileSync } from 'node:fs';
import { escapeHtml } from '../../../analyze-requirements/scripts/lib/md-inline.mjs';
import { tierFor } from './estimate-math.mjs';

export const SCORE_FACTORS = ['tech', 'size', 'deps', 'unc', 'risk'];
export const FACTOR_LABELS = {
  tech: 'Tech complexity', size: 'Feature size', deps: 'Dependencies', unc: 'Uncertainty', risk: 'Risk',
};
const GUIDE_PATH = new URL('../../references/scoring-guide.md', import.meta.url);

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());

// Returns { tech: [a1..a5], ... } from the guide's one table. Rows are found
// by their label, so the doc may reorder them; anchors may not contain `|`.
export function loadGuide(path = GUIDE_PATH) {
  const rows = readFileSync(path, 'utf8').split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l));
  const byLabel = Object.fromEntries(rows.map(cells).map((c) => [c[0], c.slice(1)]));
  return Object.fromEntries(SCORE_FACTORS.map((k) => [k, byLabel[FACTOR_LABELS[k]]]));
}

export function guideTableHtml(guide) {
  const head = `<tr><th>Dimension</th>${[1, 2, 3, 4, 5].map((n) => `<th class="score">${n}</th>`).join('')}</tr>`;
  const body = SCORE_FACTORS.map((k) => `<tr><td class="dim">${FACTOR_LABELS[k]}</td>${
    guide[k].map((a) => `<td>${escapeHtml(a)}</td>`).join('')}</tr>`).join('');
  return `<table class="guide-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export const scoreNumbers = (scores) => Object.fromEntries(SCORE_FACTORS.map((k) => [k, scores[k].n]));

// Copied into computed.features[id] at STANDARD/DEEP so page, checks and
// xlsx read one object; QUICK features carry no scores and get nothing.
export function scoreSummary(feature) {
  if (!feature.scores) return {};
  const { total, tier } = tierFor(scoreNumbers(feature.scores));
  return { scoreTotal: total, tier };
}

export const bandFor = (tier, calibration) => (tier ? calibration?.[tier] : undefined);
```

- [ ] **Step 6: Run the tests**

```bash
node --test scripts/test/scoring.test.mjs scripts/test/estimate-math.test.mjs scripts/test/references.test.mjs
```

Expected: all pass. If `escapeHtml` is not exported by `md-inline.mjs` under that name, check `grep -n "export" ../analyze-requirements/scripts/lib/md-inline.mjs` and use the exported escaper (render.mjs imports `escapeHtml` from it today, so it exists).

- [ ] **Step 7: Update `techniques.md` tier line now, so the references test stays green in isolation**

In `references/techniques.md` line 32 replace

```
Sum the five scores per feature. Tier breaks: ≤10 S / 11-17 M / ≥18 L.
```

with

```
Sum the five scores per feature. Tier breaks: ≤11 S / 12–17 M / 18–22 L / 23+ XL
(the team workbook's scale; `TIER_BREAKS` in `estimate-math.mjs`).
```

and in the calibration sentence two paragraphs down change ``or the defaults `S 20-60h, M 60-160h, L 160-400h` if not`` to ``or the defaults `S 20-60h, M 60-160h, L 160-400h, XL 400-800h` if not``.

- [ ] **Step 8: Run the whole suite, then commit**

```bash
npm test 2>&1 | tail -5
```

Expected: `fail 0`. If the browser/xlsx tests fail on tier expectations for the booking fixture, note it — Task 5/6 rewrites those tests — and continue only if the failures are in `xlsx-export.test.mjs`'s "derived 1-5 scores" tests (those are deleted in Task 6). Any other failure: fix before committing.

```bash
git add references/scoring-guide.md references/techniques.md scripts/lib/scoring.mjs scripts/lib/estimate-math.mjs scripts/test/scoring.test.mjs scripts/test/estimate-math.test.mjs scripts/test/references.test.mjs
git commit -m "feat(estimate): add scoring guide file and one tier scale"
```

---

### Task 2: Validate scores in inputs (`scoring-schema.mjs`) and score the booking fixture

**Files:**
- Create: `scripts/lib/scoring-schema.mjs`
- Modify: `scripts/lib/schema.mjs:5, 158`
- Modify: `scripts/test/fixtures/booking-inputs.json`
- Modify: `scripts/test/schema.test.mjs`

**Interfaces:**
- Consumes: `SCORE_FACTORS`, `loadGuide` from Task 1.
- Produces: `checkScoring(inputs, out)`; feature fields `scores.<k> = { n, anchor, cite }`, `scoreNote`, `scoreProvenance`.

- [ ] **Step 1: Score the booking fixture**

In `scripts/test/fixtures/booking-inputs.json` change the calibration line to

```json
  "calibration": { "S": [20, 60], "M": [60, 160], "L": [160, 400], "XL": [400, 800] },
```

Insert after `"milestone": "M1 - Booking core",` in the `booking` feature:

```json
      "scores": {
        "tech": { "n": 3, "anchor": "Custom business logic, moderate algorithm complexity, multiple states", "cite": "slot conflict + cancellation rules" },
        "size": { "n": 3, "anchor": "Medium feature with multiple components and backend logic", "cite": "CRUD API + rules engine" },
        "deps": { "n": 2, "anchor": "One internal dependency (e.g. auth check)", "cite": "reads the user session" },
        "unc": { "n": 3, "anchor": "Some open questions, design decisions to be made during build", "cite": "recurring bookings undecided" },
        "risk": { "n": 3, "anchor": "Moderate impact if broken, requires testing, affects multiple users", "cite": "double booking hits every customer" }
      },
      "scoreNote": "Core booking rules with a few open questions; touches every customer if it breaks",
      "scoreProvenance": "stated",
```

Insert after `"milestone": "M2 - Notifications",` in the `reminders` feature:

```json
      "scores": {
        "tech": { "n": 2, "anchor": "Minor customisation of standard patterns, simple state management", "cite": "scheduled job + template" },
        "size": { "n": 2, "anchor": "Small self-contained feature, simple form or display component", "cite": "one job, one template" },
        "deps": { "n": 3, "anchor": "2–3 internal services or one third-party API", "cite": "transactional email provider" },
        "unc": { "n": 2, "anchor": "Minor ambiguities, can be resolved with one clarifying question", "cite": "send-time rule to confirm" },
        "risk": { "n": 2, "anchor": "Low stakes, easy rollback, minimal user impact", "cite": "a missed reminder is recoverable" },
      },
      "scoreNote": "Sends reminder emails through an outside provider; low stakes if one is missed",
      "scoreProvenance": "proposed",
```

(Remove the trailing comma after the `risk` line inside `scores` — JSON has no trailing commas.) Booking Σ = 14 → M, matching the pass fixture's `M`; reminders Σ = 11 → S, matching `S` and sitting on a tier edge.

- [ ] **Step 2: Write the failing tests**

Append to `scripts/test/schema.test.mjs`:

```js
const GUIDE_RISK_4 = 'Payments, auth, data migrations, or PII — high business impact';

test('scores are required at STANDARD depth, complete, 1–5, anchored to the guide, cited', () => {
  const bad = fixture();
  delete bad.features[1].scores;
  bad.features[0].scores.risk = { n: 6, anchor: GUIDE_RISK_4, cite: 'x' };
  bad.features[0].scores.tech.anchor = 'hard';
  bad.features[0].scores.size.cite = '';
  const findings = checkInputs(bad);
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('scores object is required')));
  assert.ok(findings.some((f) => f.includes('booking') && f.includes('scores.risk.n must be an integer 1–5')));
  assert.ok(findings.some((f) => f.includes('booking') && f.includes('scores.tech.anchor is not the guide')));
  assert.ok(findings.some((f) => f.includes('booking') && f.includes('scores.size.cite is required')));
});

test('an anchor must be the guide sentence for that factor and score, not another score', () => {
  const bad = fixture();
  bad.features[0].scores.risk = { n: 3, anchor: GUIDE_RISK_4, cite: 'payments' }; // risk 4's sentence on a 3
  assert.ok(checkInputs(bad).some((f) => f.includes("scores.risk.anchor is not the guide's sentence for risk = 3")));
});

test('the plain-words note refuses jargon and provenance is stated|proposed', () => {
  const bad = fixture();
  bad.features[0].scoreNote = 'Risk 4 per ARCHITECTURE.md §6';
  bad.features[1].scoreNote = '';
  bad.features[1].scoreProvenance = 'observed';
  const findings = checkInputs(bad);
  assert.equal(findings.filter((f) => f.includes('scoreNote must be one plain sentence')).length, 2);
  assert.ok(findings.some((f) => f.includes('reminders') && f.includes('scoreProvenance must be stated|proposed')));
});

test('scores must have exactly the five factors', () => {
  const bad = fixture();
  bad.features[0].scores.extra = { n: 1, anchor: 'x', cite: 'y' };
  assert.ok(checkInputs(bad).some((f) => f.includes('exactly tech, size, deps, unc, risk')));
});

test('QUICK depth refuses persisted scores and needs no scores', () => {
  const quick = fixture();
  quick.depth = 'QUICK';
  for (const f of quick.features) {
    f.tasks = [{ ...f.tasks[0], id: `${f.id}-band`, o: 60, m: 110, p: 160 }];
  }
  assert.ok(checkInputs(quick).some((f) => f.includes('booking') && f.includes('scores is not persisted at QUICK depth')));
  for (const f of quick.features) { delete f.scores; delete f.scoreNote; delete f.scoreProvenance; }
  assert.deepEqual(checkInputs(quick), []);
});

test('depth must be one of the three named depths', () => {
  const bad = fixture();
  bad.depth = 'SCORING';
  assert.ok(checkInputs(bad).some((f) => f === 'depth must be QUICK|STANDARD|DEEP'));
});
```

- [ ] **Step 3: Run the tests to see them fail**

```bash
node --test scripts/test/schema.test.mjs
```

Expected: the six new tests fail (no findings produced); the existing "booking fixture is valid" test still passes (unknown fields are ignored today).

- [ ] **Step 4: Write `scripts/lib/scoring-schema.mjs`**

```js
// Score rules for estimation-inputs.json. Scores exist only at STANDARD and
// DEEP depth (QUICK uses them for a tier and does not persist them), so the
// rules run by depth. Anchors must be the guide's own sentence for that
// factor and score, which is what stops a reason from drifting away from
// the rubric the way derived scores drifted away from the hours.
import { SCORE_FACTORS, loadGuide } from './scoring.mjs';

const DEPTHS = ['QUICK', 'STANDARD', 'DEEP'];
const SCORE_FIELDS = ['scores', 'scoreNote', 'scoreProvenance'];
// A client-facing sentence: no factor names, no file names, no section marks.
const NOTE_BANNED = /\.md\b|§|\b(tech|size|deps|unc|risk)\b/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

function checkScore({ id, key, score, guide }, out) {
  const n = score?.n;
  if (!(Number.isInteger(n) && n >= 1 && n <= 5)) { out.push(`feature ${id}: scores.${key}.n must be an integer 1–5`); return; }
  if (score.anchor !== guide[key][n - 1]) out.push(`feature ${id}: scores.${key}.anchor is not the guide's sentence for ${key} = ${n}`);
  if (!nonEmpty(score.cite)) out.push(`feature ${id}: scores.${key}.cite is required`);
}

function checkScoredFeature(feature, guide, out) {
  const s = feature.scores;
  if (typeof s !== 'object' || s === null) { out.push(`feature ${feature.id}: scores object is required at STANDARD/DEEP depth`); return; }
  if (Object.keys(s).sort().join() !== [...SCORE_FACTORS].sort().join()) {
    out.push(`feature ${feature.id}: scores must have exactly ${SCORE_FACTORS.join(', ')}`);
  }
  for (const key of SCORE_FACTORS) if (s[key] !== undefined) checkScore({ id: feature.id, key, score: s[key], guide }, out);
  if (!nonEmpty(feature.scoreNote) || NOTE_BANNED.test(feature.scoreNote)) {
    out.push(`feature ${feature.id}: scoreNote must be one plain sentence (no file names, factor names or section marks)`);
  }
  if (!['stated', 'proposed'].includes(feature.scoreProvenance)) out.push(`feature ${feature.id}: scoreProvenance must be stated|proposed`);
}

function checkQuickFeature(feature, out) {
  for (const key of SCORE_FIELDS) {
    if (key in feature) out.push(`feature ${feature.id}: ${key} is not persisted at QUICK depth`);
  }
}

export function checkScoring(inputs, out) {
  if (!DEPTHS.includes(inputs.depth)) { out.push('depth must be QUICK|STANDARD|DEEP'); return; }
  if (inputs.deliveryMode === 'agentic') return;
  const guide = inputs.depth === 'QUICK' ? null : loadGuide();
  for (const feature of inputs.features ?? []) {
    if (guide) checkScoredFeature(feature, guide, out);
    else checkQuickFeature(feature, out);
  }
}
```

- [ ] **Step 5: Wire it into `schema.mjs`**

Line 5 area, add the import after the `checkScenarios` import:

```js
import { checkScoring } from './scoring-schema.mjs';
```

In `checkInputs`, after `checkScenarios(inputs, out);` add:

```js
  checkScoring(inputs, out);
```

- [ ] **Step 6: Run the tests**

```bash
node --test scripts/test/schema.test.mjs scripts/test/compute.test.mjs scripts/test/validate.test.mjs
```

Expected: all pass. The agentic fixture has `depth: "STANDARD"` and no scores; the `deliveryMode === 'agentic'` early return keeps it valid — confirm `node --test scripts/test/baselines.test.mjs` still passes too.

- [ ] **Step 7: Full suite, commit**

```bash
npm test 2>&1 | tail -5
git add scripts/lib/scoring-schema.mjs scripts/lib/schema.mjs scripts/test/fixtures/booking-inputs.json scripts/test/schema.test.mjs
git commit -m "feat(estimate): validate persisted factor scores at STANDARD depth"
```

---

### Task 3: Copy Σ and tier into `computed.features`

**Files:**
- Modify: `scripts/lib/rollup.mjs:4-9, 94-106`
- Modify: `scripts/test/compute.test.mjs`

**Interfaces:**
- Consumes: `scoreSummary(feature)` from Task 1.
- Produces: `computed.features[id].scoreTotal` (integer) and `.tier` (`S|M|L|XL`) at STANDARD/DEEP; absent otherwise.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test/compute.test.mjs`:

```js
test('computed features carry the scores\' total and tier, copied not derived', () => {
  const { computed } = computeEstimation(fixture());
  assert.equal(computed.features.booking.scoreTotal, 14);
  assert.equal(computed.features.booking.tier, 'M');
  assert.equal(computed.features.reminders.scoreTotal, 11);
  assert.equal(computed.features.reminders.tier, 'S');
  // hours are untouched by scoring
  assert.equal(computed.features.booking.hours, 69.33);
});

test('QUICK inputs get no score fields in computed features', () => {
  const quick = fixture();
  quick.depth = 'QUICK';
  for (const f of quick.features) { delete f.scores; delete f.scoreNote; delete f.scoreProvenance; }
  const { computed } = computeEstimation(quick);
  assert.equal('tier' in computed.features.booking, false);
  assert.equal('scoreTotal' in computed.features.booking, false);
});
```

- [ ] **Step 2: Run to see it fail**

```bash
node --test scripts/test/compute.test.mjs
```

Expected: first new test fails with `undefined !== 14`.

- [ ] **Step 3: Implement**

In `scripts/lib/rollup.mjs` add to the imports:

```js
import { scoreSummary } from './scoring.mjs';
```

In `buildFeatures`, replace

```js
    features[feature.id] = { hours: round2(hours), low: round2(low), high: round2(high) };
```

with

```js
    features[feature.id] = { hours: round2(hours), low: round2(low), high: round2(high), ...scoreSummary(feature) };
```

- [ ] **Step 4: Run tests, commit**

```bash
node --test scripts/test/compute.test.mjs scripts/test/validate.test.mjs scripts/test/quality-gates.test.mjs
git add scripts/lib/rollup.mjs scripts/test/compute.test.mjs
git commit -m "feat(estimate): copy score total and tier into computed features"
```

---

### Task 4: `estimation.md` Tier cell must match the scores

**Files:**
- Create: `scripts/lib/md-tables.mjs`
- Create: `scripts/lib/scoring-checks.mjs`
- Modify: `scripts/lib/checks.mjs:1-38, 129-135`
- Modify: `scripts/test/validate.test.mjs`

**Interfaces:**
- Produces: `heading(md, name)`, `tables(text)` exported from `md-tables.mjs` and re-exported from `checks.mjs` (for `agentic-checks.mjs:6`); `scoringFindings({ md, estimation }) → string[]`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test/validate.test.mjs`:

```js
test('a Summary Tier cell that disagrees with the scores is refused at STANDARD depth', () => {
  const md = read('estimation-pass.md').replace('| User can book appointment | M |', '| User can book appointment | L |');
  const findings = checkDeliverables({ md, estimation: computeEstimation(inputs()) });
  assert.ok(findings.some((f) => f === 'scope row "User can book appointment": Tier L does not match scores (M)'), findings.join('\n'));
});

test('the Tier column is required at STANDARD depth and ignored at QUICK', () => {
  const noTier = read('estimation-pass.md')
    .replace('| Feature | Tier | Range (h) | src |', '| Feature | Range (h) | src |')
    .replace('| --- | --- | --- | --- |\n| User', '| --- | --- | --- |\n| User')
    .replace('| User can book appointment | M | 40–120 |', '| User can book appointment | 40–120 |')
    .replace('| Email reminders | S | 12–36 |', '| Email reminders | 12–36 |');
  assert.ok(checkDeliverables({ md: noTier, estimation: computeEstimation(inputs()) })
    .some((f) => f.includes('Tier column')));
  const quick = inputs();
  quick.depth = 'QUICK';
  for (const f of quick.features) { delete f.scores; delete f.scoreNote; delete f.scoreProvenance; }
  const md = read('estimation-pass.md').replace('| User can book appointment | M |', '| User can book appointment | XL |');
  assert.ok(!checkDeliverables({ md, estimation: computeEstimation(quick) }).some((f) => f.includes('Tier')));
});
```

- [ ] **Step 2: Run to see them fail**

```bash
node --test scripts/test/validate.test.mjs
```

Expected: both new tests fail (no Tier findings).

- [ ] **Step 3: Move the markdown helpers to `md-tables.mjs`**

Create `scripts/lib/md-tables.mjs` with the bodies of `heading`, `cells`, `tables` cut from `checks.mjs:11-38` (unchanged code, `heading` and `tables` exported, `cells` stays module-private):

```js
// Markdown readers shared by the deliverable checks: find a section by its
// heading, and read every `| … |` table in a slice of text.

// Returns the text of the section/subsection starting at heading `name`, up
// to (not including) the next heading of the same or shallower level.
export function heading(md, name) {
  const m = new RegExp(`^(#{2,4})\\s*${name}\\b.*$`, 'm').exec(md);
  if (!m) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(new RegExp(`^#{1,${m[1].length}}\\s`, 'm'));
  return rest.slice(0, next === -1 ? undefined : next);
}

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

// Groups contiguous `| ... |` lines into tables, dropping the `| --- |`
// separator row, and returns each as { header, rows } of trimmed cells.
export function tables(text) {
  const groups = [];
  let cur = [];
  for (const line of (text ?? '').split('\n')) {
    if (/^\s*\|/.test(line)) cur.push(line);
    else if (cur.length) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups
    .map((g) => g.filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l)))
    .map((g) => ({ header: cells(g[0]), rows: g.slice(1).map(cells) }));
}
```

In `checks.mjs` delete those three functions and add near the top:

```js
import { heading, tables } from './md-tables.mjs';
import { scoringFindings } from './scoring-checks.mjs';

export { heading, tables }; // agentic-checks.mjs imports them from here
```

- [ ] **Step 4: Write `scripts/lib/scoring-checks.mjs`**

```js
// The Summary's feature/tier table typed a Tier letter nobody checked. At
// STANDARD/DEEP the letter must be the one the scores produced (copied into
// computed.features by rollup.mjs). QUICK and agentic deliverables are not
// scored and skip this.
import { heading, tables } from './md-tables.mjs';

const scored = (inputs) => inputs.deliveryMode !== 'agentic' && inputs.depth !== 'QUICK';

export function scoringFindings({ md, estimation }) {
  const out = [];
  const { inputs, computed } = estimation;
  if (!scored(inputs)) return out;
  const table = tables(heading(md, 'Summary') ?? '').find((t) => t.header.includes('src') && !t.header.includes('Task'));
  if (!table) return out; // checkScopeRows already reports the missing table
  const tierIdx = table.header.indexOf('Tier');
  if (tierIdx === -1) { out.push('summary scope table needs a Tier column at STANDARD/DEEP depth'); return out; }
  const want = Object.fromEntries(inputs.features.map((f) => [f.name, computed.features[f.id]?.tier]));
  for (const row of table.rows) {
    if (want[row[0]] && row[tierIdx] !== want[row[0]]) {
      out.push(`scope row "${row[0]}": Tier ${row[tierIdx]} does not match scores (${want[row[0]]})`);
    }
  }
  return out;
}
```

- [ ] **Step 5: Call it from `checkDeliverables`**

In `checks.mjs` replace the body of `checkDeliverables` with:

```js
export function checkDeliverables({ md, estimation }) {
  const out = [...checkStructure(md), ...checkRows(md, estimation), ...checkNumbers(estimation)];
  checkRoadmap(md, estimation, out);
  out.push(...scoringFindings({ md, estimation }));
  if (estimation.inputs.deliveryMode === 'agentic') out.push(...agenticFindings({ md, estimation }));
  return out;
}
```

- [ ] **Step 6: Run tests, commit**

```bash
node --test scripts/test/validate.test.mjs scripts/test/quality-gates.test.mjs scripts/test/e2e.test.mjs
npm test 2>&1 | tail -5
git add scripts/lib/md-tables.mjs scripts/lib/scoring-checks.mjs scripts/lib/checks.mjs scripts/test/validate.test.mjs
git commit -m "feat(estimate): check the Summary Tier cell against the scores"
```

---

### Task 5: Page reads real scores; derivation and mode toggle go

**Files:**
- Modify: `assets/estimate-template.html` (CSS ~256-276; JS ~491-530, 584-590, 597-625, 645-745, 785-790, 1036-1041; body 333)
- Modify: `scripts/render.mjs:56-70`
- Modify: `scripts/test/render.test.mjs`, `scripts/test/browser.test.mjs`

**Interfaces:**
- Consumes: `DATA.inputs.features[].scores/scoreNote/scoreProvenance`, `DATA.computed.features[id].scoreTotal/tier`, `DATA.inputs.calibration`, `guideTableHtml(loadGuide())` from Task 1.
- Produces (in-page globals used by Task 6): `SCORED` (boolean), `SCORE_KEYS`, `SCORE_LABELS`; `breakdownData()` rows gain `scores`, `scoreNote`, `scoreProvenance`, `scoreTotal`, `tier`, `outOfBand`.

- [ ] **Step 1: Write the failing render tests**

In `scripts/test/render.test.mjs` change the slot test to expect six slots:

```js
  assert.deepEqual([...new Set(markers)], ['DATA', 'FONTS', 'GUIDE', 'MATH', 'TITLE', 'VIEWER']);
```

Append:

```js
test('the page never derives scores and carries the guide from the reference file', () => {
  const html = renderedPage();
  for (const gone of ['deriveScores', 'TECH_CATEGORY_SCORE', 'scoreTier', 'SCORE_GUIDE', 'bdModePill', 'bdMode(', 'derived:']) {
    assert.equal(html.includes(gone), false, `${gone} must not be in the page`);
  }
  assert.match(html, /<template id="scoring-guide"><table class="guide-table">/);
  assert.ok(html.includes('Payments, auth, data migrations, or PII — high business impact'));
});

test('the agentic page has no guide slot and no score code', () => {
  const html = renderAgentic();
  assert.doesNotMatch(html, /scoring-guide/);
});
```

- [ ] **Step 2: Write the failing browser tests**

Append to `scripts/test/browser.test.mjs`:

```js
const cellTexts = (sel) => `[...document.querySelectorAll('${sel}')].map((n) => n.textContent.trim())`;

test('scored breakdown: five score columns, Σ, tier, then effort; values verbatim from inputs', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const heads = await page.eval(cellTexts('#feature-table thead th'));
    assert.deepEqual(heads, ['Feature', 'Tech', 'Size', 'Deps', 'Unc', 'Risk', 'Σ', 'Tier', 'Effort (h)', 'Confidence', 'Source']);
    const booking = await page.eval(cellTexts('#feature-table tr[data-id="booking"] td.score'));
    assert.deepEqual(booking.slice(0, 5), ['3', '3', '2', '3', '3']);
    assert.equal(booking[5], '14');
    assert.equal(booking[6], 'M');
    assert.equal(await page.eval(`document.querySelector('#feature-table [data-mode]')`), null, 'mode toggle is gone');
  } finally { page.close(); }
});

test('score cells explain themselves: anchor + cite on hover, note under the name, ⚑ on a tier edge', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const title = await page.eval(`document.querySelector('#feature-table tr[data-id="reminders"] td.score').title`);
    assert.match(title, /Minor customisation of standard patterns/);
    assert.match(title, /scheduled job \+ template/);
    const note = await page.eval(`document.querySelector('#feature-table tr[data-id="booking"] .feat-note').textContent`);
    assert.match(note, /open questions/);
    assert.ok(await page.eval(`!!document.querySelector('#feature-table tr[data-id="reminders"] .edge')`), 'Σ 11 sits on a tier edge');
    assert.equal(await page.eval(`!!document.querySelector('#feature-table tr[data-id="booking"] .edge')`), false);
  } finally { page.close(); }
});

test('⚠ marks a feature whose PERT hours fall outside its tier band', skip, async () => {
  const page = await openPage(buildPageWith((inputs) => {
    // reminders is S (20–60 h); push its only task to ~120 h
    inputs.features[1].tasks[0] = { ...inputs.features[1].tasks[0], o: 90, m: 120, p: 160 };
  }));
  try {
    const warn = await page.eval(`document.querySelector('#feature-table tr[data-id="reminders"] .oob')?.title ?? ''`);
    assert.match(warn, /outside S band 20–60 h/);
    assert.equal(await page.eval(`!!document.querySelector('#feature-table tr[data-id="booking"] .oob')`), false);
  } finally { page.close(); }
});

test('the scoring guide fold shows the reference table, open on first view', skip, async () => {
  const page = await openPage(buildPage());
  try {
    assert.equal(await page.eval(`document.querySelector('#feature-table details.guide').open`), true);
    assert.match(await page.eval(`document.querySelector('#feature-table details.guide').textContent`), /Tech complexity/);
  } finally { page.close(); }
});

test('QUICK inputs render today\'s four columns and no guide', skip, async () => {
  const page = await openPage(buildPageWith((inputs) => {
    inputs.depth = 'QUICK';
    for (const f of inputs.features) {
      delete f.scores; delete f.scoreNote; delete f.scoreProvenance;
      f.tasks = [{ ...f.tasks[0], id: `${f.id}-band`, o: 60, m: 110, p: 160 }];
    }
  }));
  try {
    assert.deepEqual(await page.eval(cellTexts('#feature-table thead th')), ['Feature', 'Effort (h)', 'Confidence', 'Source']);
    assert.equal(await page.eval(`document.querySelector('#feature-table details.guide')`), null);
  } finally { page.close(); }
});

test('expanded task rows line up under the scored header', skip, async () => {
  const page = await openPage(buildPage());
  try {
    await page.eval(`document.querySelector('#feature-table tr[data-id="booking"] button.expand').click()`);
    const cells = await page.eval(`document.querySelectorAll('#feature-table tr.task-row td').length`);
    // name + spacer(colspan 7 counts as one td) + o/m/p + confidence + category = 5 per row × 2 tasks
    assert.equal(cells, 10);
    assert.equal(await page.eval(`document.querySelector('#feature-table tr.task-row td:nth-child(2)').colSpan`), 7);
  } finally { page.close(); }
});
```

Then search `browser.test.mjs` for tests that click `[data-mode]` or assert `aria-sort` counts of 4, or read `SCORE_COLS`/scoring-mode cells (`grep -n "data-mode\|scores\b\|scoring" scripts/test/browser.test.mjs`). Delete any test whose subject is the mode toggle; where a test counts header cells or `aria-sort` entries, change 4 → 11 for the default (scored) booking page.

- [ ] **Step 3: Run to see them fail**

```bash
node --test scripts/test/render.test.mjs scripts/test/browser.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```

Expected: the new tests fail (slot count 5, `deriveScores` present, `[data-mode]` present, headers `['Feature','Effort (h)','Confidence','Source']` on the scored page).

- [ ] **Step 4: Add the `GUIDE` slot to the template body and `render.mjs`**

In `assets/estimate-template.html` line 333 area, directly after `<section id="feature-table"></section>` add:

```html
    <template id="scoring-guide"><!-- slot:GUIDE --></template>
```

In `scripts/render.mjs` add the import:

```js
import { loadGuide, guideTableHtml } from './lib/scoring.mjs';
```

and change the slots spread to:

```js
    ...(isAgentic ? {} : {
      MATH: inlineModule(extractExports(mathSrc, ['pert'])),
      // The rubric lives in references/scoring-guide.md; the page shows the
      // same sentences the interviewer read, so a score means one thing.
      GUIDE: guideTableHtml(loadGuide()),
    }),
```

- [ ] **Step 5: Replace the derivation block (template ~491-530)**

Delete from `// Each 1–5 score is the count of thresholds the metric clears, plus one.` through the `const activeCols = …` line (this removes `band`, `TECH_CATEGORY_SCORE`, `deriveScores`, `bdTotal`, `scoreTier`, `SCORE_COLS`, `activeCols`). Change `bdState` to drop `mode: 'estimate',` (keep `guideSeen: false`). Insert in their place:

```js
// Scores are the interview's judgments (features[].scores), never derived
// from hours; Σ and tier were copied into computed.features by rollup.mjs.
// A page with no scored feature (QUICK depth) shows the four estimate columns.
const SCORED = DATA.inputs.features.some((f) => f.scores);
const SCORE_KEYS = ['tech', 'size', 'deps', 'unc', 'risk'];
const SCORE_LABELS = { tech: 'Tech', size: 'Size', deps: 'Deps', unc: 'Unc', risk: 'Risk' };
const EDGE_TOTALS = [11, 17, 22];

const BASE_COLS = {
  name: { key: 'name', label: 'Feature', val: (f) => f.name, hint: 'sort by name' },
  hours: { key: 'hours', label: 'Effort (h)', val: (f) => f.hours, hint: 'sort by expected hours' },
  conf: { key: 'conf', label: 'Confidence', val: (f) => CONF_RANK[f.conf], hint: 'sort by confidence' },
  prov: { key: 'provenance', label: 'Source', val: (f) => f.provenance, hint: 'sort by source' },
};

function bdCols() {
  if (!SCORED) return [BASE_COLS.name, BASE_COLS.hours, BASE_COLS.conf, BASE_COLS.prov];
  const scoreCols = SCORE_KEYS.map((k) => ({
    key: k, label: SCORE_LABELS[k], cls: 'score', val: (f) => f.scores[k].n, hint: `sort by ${SCORE_LABELS[k]} score`,
  }));
  return [BASE_COLS.name, ...scoreCols,
    { key: 'total', label: '&Sigma;', cls: 'score', val: (f) => f.scoreTotal, hint: 'sum of the five scores' },
    { key: 'tier', label: 'Tier', cls: 'score', val: (f) => f.scoreTotal, hint: 'S ≤ 11 / M ≤ 17 / L ≤ 22 / XL above' },
    BASE_COLS.hours, BASE_COLS.conf, BASE_COLS.prov];
}
```

Note `'&Sigma;'` renders as `Σ`; the browser test reads `textContent`, which is `Σ`.

- [ ] **Step 6: Rewrite `breakdownData`, `bdSorted`, `bdHead`**

Replace `breakdownData` with:

```js
function breakdownData() {
  return DATA.inputs.features.map((f) => {
    const c = DATA.computed.features[f.id];
    const conf = f.tasks.reduce(
      (w, t) => (CONF_RANK[t.confidence] > CONF_RANK[w] ? t.confidence : w), 'HIGH');
    const band = c.tier ? DATA.inputs.calibration?.[c.tier] : undefined;
    return { id: f.id, name: f.name, milestone: f.milestone, component: f.component, provenance: f.provenance,
      tasks: f.tasks, conf, hours: c.hours, low: c.low, high: c.high, spread: c.high - c.low,
      scores: f.scores, scoreNote: f.scoreNote, scoreProvenance: f.scoreProvenance,
      scoreTotal: c.scoreTotal, tier: c.tier,
      outOfBand: band && (c.hours < band[0] || c.hours > band[1]) ? band : null };
  });
}
```

In `bdSorted` change `activeCols().find(` to `bdCols().find(`. In `bdHead` change `activeCols().map(` to `bdCols().map(`.

- [ ] **Step 7: Remove the mode pill and its handlers**

Delete the `bdModePill` function and its comment. In `bdFilters` change `${bdModePill()}${bdExpandControls()}` to `${bdExpandControls()}`. Delete the `bdMode` function. In `onBreakdownClick` delete the line `else if (btn.dataset.mode) bdMode(btn.dataset.mode);`. In the `view-toggle` listener delete the comment and the `if (client && bdState.mode !== 'estimate') bdMode('estimate');` line, leaving:

```js
document.getElementById('view-toggle')?.addEventListener('click', () => {
  document.body.classList.toggle('view-client');
});
```

- [ ] **Step 8: Rewrite the row renderers (template ~645-700)**

Replace `scoreCells`, `estimateCells`, `featRow`, `taskScoreCells`, `taskEstimateCells`, `taskRows` with:

```js
function scoreCells(f) {
  const cells = SCORE_KEYS.map((k) => {
    const s = f.scores[k];
    return `<td class="score${s.n === 5 ? ' hot' : ''}" title="${esc(s.anchor)} — ${esc(s.cite)}">${s.n}</td>`;
  });
  const edge = EDGE_TOTALS.includes(f.scoreTotal)
    ? ' <span class="edge" title="one point from the next tier">&#9873;</span>' : '';
  return `${cells.join('')}<td class="score total">${f.scoreTotal}${edge}</td>
    <td class="score"><span class="tier ${f.tier.toLowerCase()}">${f.tier}</span></td>`;
}

function hoursCell(f, max) {
  const warn = f.outOfBand
    ? `<span class="oob" title="PERT ${f.hours} h outside ${f.tier} band ${f.outOfBand[0]}–${f.outOfBand[1]} h">&#9888;</span>` : '';
  return `<td><span class="bd-cell">${bdBar(f, max)}<span class="bd-num">${f.hours}</span>${warn}</span></td>`;
}

function estimateCells(f) {
  return `<td><span class="conf">${f.conf}</span></td>
    <td><span class="tag ${f.provenance}">${f.provenance}</span></td>`;
}

function featRow(f, max) {
  const open = bdState.expanded.has(f.id);
  const note = f.scoreNote ? `<div class="task-assump feat-note">${esc(f.scoreNote)}</div>` : '';
  return `<tr class="feat-row ${confLevel(f.conf)}" data-id="${f.id}">
    <td${ctEdge(f.component)}><span class="feat-cell"><button type="button" class="expand" ${INTERNAL_ATTR}
      aria-expanded="${open}" aria-label="show tasks">&#9656;</button>
      <span>${f.name}</span></span>${note}</td>
    ${SCORED ? scoreCells(f) : ''}${hoursCell(f, max)}${estimateCells(f)}</tr>`;
}

// Task rows sit under the feature's name; the seven score columns have no
// per-task meaning (scores are a feature judgment), so one spacer spans them.
function taskRows(f) {
  const spacer = SCORED ? '<td colspan="7"></td>' : '';
  return f.tasks.map((t) => `<tr class="task-row ${confLevel(t.confidence)}" ${INTERNAL_ATTR}>
    <td${ctEdge(f.component)}>${t.name}<div class="task-assump">${t.assumptions.join('; ') || 'none'}</div></td>${spacer}
    <td><span class="bd-cell"><span class="bd-num">${t.o}/${t.m}/${t.p}</span></span></td>
    <td><span class="conf">${t.confidence}</span></td>
    <td><span class="tag">${t.category}</span></td></tr>`).join('');
}
```

`esc` is defined later in the same script (`const esc = …`, ~line 848); it is called at render time, after the script has evaluated, so the forward reference is fine — `selectBox` already relies on it.

- [ ] **Step 9: Replace `SCORE_GUIDE`/`bdGuideRow`/`bdGuide` (template ~701-745)**

Delete the `SCORE_GUIDE` constant, its comment, and `bdGuideRow`. Replace `bdGuide` with:

```js
// The rubric comes from references/scoring-guide.md through the GUIDE slot,
// so the page and the interviewer explain a score in the same sentences.
function bdGuide() {
  const guide = document.getElementById('scoring-guide');
  if (!SCORED || !guide) return '';
  const open = bdState.guideSeen ? '' : ' open';
  bdState.guideSeen = true;
  return `<details class="guide"${open}><summary>Scoring guide &mdash; what each 1&ndash;5 means</summary>
    <div class="bd-scroll">${guide.innerHTML}</div></details>`;
}
```

Update the `renderBreakdown` help text: replace `'for the tasks behind its number.'` with `'for the tasks behind its number. Score cells are the interview\'s five factor judgments (hover for the rubric sentence and the evidence); Σ and tier follow the scoring guide below.'` — keep the string concatenation style.

- [ ] **Step 10: CSS**

In the CSS block near line 256 replace the comment `/* scoring mode: centred mono score cells; … */` with `/* score cells: centred mono; a 5 reads hot (review it), the tier pill warms with size. */`, delete the `.wt, #feature-table td.score .wt { … }` rule, and add:

```css
#feature-table .edge { color:var(--warn); font-size:.7rem; margin-left:.15rem; cursor:help; }
#feature-table .oob { color:var(--warn); margin-left:.3rem; cursor:help; }
#feature-table .feat-note { margin-left:1.4rem; }
.guide-table td.dim { color:var(--ink); font-weight:600; white-space:nowrap; }
```

Delete the now-unused `.guide-table td.dim small { … }` rule.

- [ ] **Step 11: Run the render and browser tests**

```bash
node --test scripts/test/render.test.mjs scripts/test/browser.test.mjs scripts/test/quality-gates.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```

Expected: `fail 0`. If a quality-gate failure names a template function over 22 lines, split it (e.g. move the `title` string of `hoursCell` into a helper `oobTitle(f)`).

- [ ] **Step 12: Eyeball it**

```bash
node scripts/compute.mjs --inputs scripts/test/fixtures/booking-inputs.json --out /tmp/est/estimation.json
node scripts/render.mjs --json /tmp/est/estimation.json --md scripts/test/fixtures/estimation-pass.md --out /tmp/est
```

Open `/tmp/est/estimate.html` in Chrome (or use `openPage` + `page.screenshot` as `browser.test.mjs` does elsewhere in the repo). Check: 11 columns, ⚑ on Email reminders, note lines under names, guide fold open, no toggle.

- [ ] **Step 13: Full suite, commit**

```bash
npm test 2>&1 | tail -5
git add assets/estimate-template.html scripts/render.mjs scripts/test/render.test.mjs scripts/test/browser.test.mjs
git commit -m "feat(estimate): show interview scores on the page, drop derivation"
```

Expected before committing: only `xlsx-export.test.mjs` may still fail (its "derived 1-5 scores" and "tech and size follow the guide" tests); Task 6 replaces them. Every other file green.

---

### Task 6: xlsx export — real scores, `WHY THIS TIER`, Score Rationale tab

**Files:**
- Modify: `assets/estimate-template.html` (internal script ~1080-1175: `featureRowXml`, `buildSheet1`, `buildTaskSheet`, `registerTaskSheet`, `buildWorkbook`)
- Modify: `scripts/test/xlsx-export.test.mjs`

**Interfaces:**
- Consumes: rows from `exportRows()` carrying `scores`, `scoreNote`, `scoreProvenance` (Task 5), `SCORE_KEYS`, `SCORE_LABELS`.
- Produces: sheet1 `B–F` = `scores.*.n` or blank styled cells, `N6 = WHY THIS TIER`, `N<r> = scoreNote`, `autoFilter A6:N…`; `xl/worksheets/sheet5.xml` "Score Rationale" registered like Task Breakdown.

- [ ] **Step 1: Replace the two derived-score tests and add the new ones**

In `scripts/test/xlsx-export.test.mjs` delete the tests titled `rows land as inline strings ordered by milestone with derived 1-5 scores` and `tech and size scores follow the Scoring Guide definitions`. Add:

```js
test('rows land ordered by milestone with the interview scores verbatim', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = sheet1(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'A7')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'A8')), 'Email reminders');
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => cellNumber(cell(xml, `${c}7`))), [3, 3, 2, 3, 3]);
    assert.deepEqual(['B', 'C', 'D', 'E', 'F'].map((c) => cellNumber(cell(xml, `${c}8`))), [2, 2, 3, 2, 2]);
  } finally { page.close(); }
});

test('column N carries the plain-words note for sales readers', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const xml = sheet1(await exportedFiles(page));
    assert.equal(inlineText(cell(xml, 'N6')), 'WHY THIS TIER');
    assert.match(inlineText(cell(xml, 'N7')) ?? '', /open questions/);
    assert.match(xml, /<autoFilter ref="A6:N26"\/>/);
  } finally { page.close(); }
});

const sheetRationale = (files) => files.get('xl/worksheets/sheet5.xml')?.toString('utf8') ?? '';

test('a Score Rationale tab lists anchor, evidence and provenance per factor', skip, async () => {
  const page = await openPage(buildPage());
  try {
    const files = await exportedFiles(page);
    assert.match(files.get('xl/workbook.xml').toString('utf8'), /name="Score Rationale"/);
    assert.match(files.get('xl/_rels/workbook.xml.rels').toString('utf8'), /Target="worksheets\/sheet5\.xml"/);
    assert.match(files.get('[Content_Types].xml').toString('utf8'), /PartName="\/xl\/worksheets\/sheet5\.xml"/);
    const xml = sheetRationale(files);
    assert.deepEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1'].map((r) => inlineText(cell(xml, r))),
      ['FEATURE', 'FACTOR', 'SCORE', 'ANCHOR', 'EVIDENCE', 'PROVENANCE']);
    assert.equal(inlineText(cell(xml, 'A2')), 'User can book appointment');
    assert.equal(inlineText(cell(xml, 'B2')), 'Tech');
    assert.equal(cellNumber(cell(xml, 'C2')), 3);
    assert.equal(inlineText(cell(xml, 'D2')), 'Custom business logic, moderate algorithm complexity, multiple states');
    assert.equal(inlineText(cell(xml, 'E2')), 'slot conflict + cancellation rules');
    assert.equal(inlineText(cell(xml, 'F2')), 'stated');
    assert.match(xml, /<autoFilter ref="A1:F11"\/>/); // 2 features × 5 factors
  } finally { page.close(); }
});

test('QUICK inputs export blank score cells and an empty rationale tab', skip, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'estimate-xlsx-quick-'));
  const inputs = JSON.parse(readFileSync(fixture, 'utf8'));
  inputs.depth = 'QUICK';
  for (const f of inputs.features) {
    delete f.scores; delete f.scoreNote; delete f.scoreProvenance;
    f.tasks = [{ ...f.tasks[0], id: `${f.id}-band`, o: 60, m: 110, p: 160 }];
  }
  const inputsPath = join(dir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify(inputs));
  const page = await openPage(buildPage(inputsPath));
  try {
    const files = await exportedFiles(page);
    const xml = sheet1(files);
    assert.equal(cell(xml, 'B7'), '', 'no score value at QUICK');
    assert.match(xml, /<c r="B7" s="\d+"\/>/);
    assert.match(sheetRationale(files), /<autoFilter ref="A1:F1"\/>/);
  } finally { page.close(); }
});
```

Change `buildPage()` in this file to accept an inputs path — replace its signature and compute line:

```js
function buildPage(inputsPath = fixture) {
  …
  execFileSync('node', [join(scripts, 'compute.mjs'), '--inputs', inputsPath, '--out', join(dir, 'estimation.json')]);
```

and add `readFileSync, writeFileSync` to the `node:fs` import.

- [ ] **Step 2: Run to see them fail**

```bash
node --test scripts/test/xlsx-export.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```

Expected: the four new tests fail (`B7` holds a derived value or `f.scores` is undefined → page error; `N6` missing; sheet5 missing).

- [ ] **Step 3: Rewrite `featureRowXml` and the sheet-1 header patch**

Replace `featureRowXml` with:

```js
const blankCell = (ref) => `<c r="${ref}" s="${XLSX_STYLE.blank}"/>`;

function featureRowXml(f, r) {
  const scoreCols = ['B', 'C', 'D', 'E', 'F'];
  const scores = scoreCols.map((col, i) => (f.scores
    ? nCell(col + r, XLSX_STYLE.score, f.scores[SCORE_KEYS[i]].n) : blankCell(col + r))).join('');
  return `<row r="${r}" ht="29.25" customHeight="1">` + sCell(`A${r}`, XLSX_STYLE.A, f.name) + scores
    + fxCells(r) + sCell(`L${r}`, XLSX_STYLE.A, f.milestone ?? '')
    + sCell(`M${r}`, XLSX_STYLE.A, xlsxContainer(f)) + sCell(`N${r}`, XLSX_STYLE.A, f.scoreNote ?? '') + '</row>';
}
```

Delete the stale comment block `// deriveScores lives with the breakdown table …`. In `buildSheet1` change the header patch and autofilter lines to:

```js
    .replace(/(<row r="6".*?)(<\/row>)/, `$1${sCell('L6', XLSX_STYLE.head, 'MILESTONE')}${sCell('M6', XLSX_STYLE.head, 'CONTAINER')}${sCell('N6', XLSX_STYLE.head, 'WHY THIS TIER')}$2`)
    .replace('</sheetData>', `</sheetData><autoFilter ref="A6:N${total - 1}"/>`)
```

Update the existing test `milestone and container fill L/M under an autofiltered header` to expect `A6:N26`.

- [ ] **Step 4: Generalise the extra-sheet builder and add the rationale tab**

Replace `buildTaskSheet` and `registerTaskSheet` with:

```js
// A generated tab: frozen header row, autofilter over the data, nothing else.
function sheetXml({ headers, body, last }) {
  const head = `<row r="1">${headers.map((h, i) =>
    sCell(String.fromCharCode(65 + i) + 1, XLSX_STYLE.head, h)).join('')}</row>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
    + 'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<sheetData>${head}${body}</sheetData><autoFilter ref="A1:${String.fromCharCode(64 + headers.length)}${last}"/></worksheet>`;
}

function buildTaskSheet(rows) {
  const body = rows.flatMap((f) => f.tasks.map((t) => [f, t]))
    .map(([f, t], i) => taskRowXml(f, t, i + 2)).join('');
  const last = 1 + rows.reduce((s, f) => s + f.tasks.length, 0);
  return sheetXml({ headers: TASK_HEADERS, body, last });
}

// --- Score Rationale tab: one row per feature × factor — the engineer's
// view of why each score is what it is (Sheet 1's column N is the sales one).
const RATIONALE_HEADERS = ['FEATURE', 'FACTOR', 'SCORE', 'ANCHOR', 'EVIDENCE', 'PROVENANCE'];

function rationaleRowXml(f, key, r) {
  const s = f.scores[key];
  return `<row r="${r}">` + sCell(`A${r}`, 0, f.name) + sCell(`B${r}`, 0, SCORE_LABELS[key]) + nCell(`C${r}`, 0, s.n)
    + sCell(`D${r}`, 0, s.anchor) + sCell(`E${r}`, 0, s.cite) + sCell(`F${r}`, 0, f.scoreProvenance) + '</row>';
}

function buildRationaleSheet(rows) {
  const scored = rows.filter((f) => f.scores);
  const body = scored.flatMap((f) => SCORE_KEYS.map((k) => [f, k]))
    .map(([f, k], i) => rationaleRowXml(f, k, i + 2)).join('');
  return sheetXml({ headers: RATIONALE_HEADERS, body, last: 1 + scored.length * SCORE_KEYS.length });
}

const EXTRA_SHEETS = [
  { file: 'sheet4.xml', name: 'Task Breakdown', id: 100, rid: 'rIdTasks', build: buildTaskSheet },
  { file: 'sheet5.xml', name: 'Score Rationale', id: 101, rid: 'rIdScores', build: buildRationaleSheet },
];

// Registers a generated sheet in the three package indexes the clone lacks.
function registerSheet(files, enc, sheet) {
  const patch = (path, find, add) => files.set(path,
    enc.encode(new TextDecoder().decode(files.get(path)).replace(find, add + find)));
  patch('xl/workbook.xml', '</sheets>',
    `<sheet state="visible" name="${sheet.name}" sheetId="${sheet.id}" r:id="${sheet.rid}"/>`);
  patch('xl/_rels/workbook.xml.rels', '</Relationships>',
    `<Relationship Id="${sheet.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${sheet.file}"/>`);
  patch('[Content_Types].xml', '</Types>',
    `<Override PartName="/xl/worksheets/${sheet.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
}
```

Replace the sheet-4 lines in `buildWorkbook` with:

```js
  for (const sheet of EXTRA_SHEETS) {
    files.set(`xl/worksheets/${sheet.file}`, enc.encode(sheet.build(rows)));
    registerSheet(files, enc, sheet);
  }
```

Update the `// --- Task Breakdown tab:` comment to drop "Registers sheet4" wording if it mentions it.

- [ ] **Step 5: Run the xlsx tests and the full suite**

```bash
node --test scripts/test/xlsx-export.test.mjs scripts/test/quality-gates.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
npm test 2>&1 | tail -5
```

Expected: `fail 0` everywhere.

- [ ] **Step 6: Commit**

```bash
git add assets/estimate-template.html scripts/test/xlsx-export.test.mjs
git commit -m "feat(estimate): export real scores, a why column and a rationale tab"
```

---

### Task 7: CSV round-trip and diff (`score-csv.mjs`, `score-diff.mjs`)

**Files:**
- Create: `scripts/lib/score-csv.mjs`
- Create: `scripts/lib/score-diff.mjs`
- Create: `scripts/test/score-review.test.mjs`

**Interfaces:**
- Consumes: `SCORE_FACTORS`, `loadGuide`, `scoreNumbers` (Task 1), `tierFor`.
- Draft shape (agent writes it): `{ project, features: [{ id, name, scores: { k: { n, anchor, cite } }, scoreNote, scoreProvenance }] }`.
- Edited shape (from CSV or the HTML page): `{ features: [{ id, scores: { k: n }, scoreNote, note? }] }`.
- Produces: `toCsv(draft) → string`; `parseCsv(text) → string[][]`; `fromCsv(text) → edited`; `diffScores(draft, edited) → [{ id, field, from, to }]` (`field` is a factor key, `'scoreNote'`, or `'note'` for the free-text column, which has no `from`); `applyDiff({ draft, diff, guide }) → features` with `n`/`anchor` updated and `scoreProvenance: 'stated'` on any changed feature.

- [ ] **Step 1: Write the failing tests**

Create `scripts/test/score-review.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toCsv, parseCsv, fromCsv, CSV_HEADERS } from '../lib/score-csv.mjs';
import { diffScores, applyDiff } from '../lib/score-diff.mjs';
import { loadGuide } from '../lib/scoring.mjs';

const inputs = () => JSON.parse(readFileSync(new URL('./fixtures/booking-inputs.json', import.meta.url), 'utf8'));
const draft = () => {
  const { project, features } = inputs();
  return { project, features: features.map(({ id, name, scores, scoreNote, scoreProvenance }) => ({ id, name, scores, scoreNote, scoreProvenance })) };
};

test('toCsv writes one row per feature with anchor and cite beside every score', () => {
  const csv = toCsv(draft());
  const [head, booking] = csv.trim().split('\n');
  assert.equal(head, CSV_HEADERS.join(','));
  assert.equal(CSV_HEADERS.length, 2 + 5 * 3 + 4); // id, feature, 5×(n, why, cite), sum, tier, why_this_tier, note
  assert.match(booking, /^booking,User can book appointment,3,"Custom business logic, moderate algorithm complexity, multiple states",slot conflict \+ cancellation rules,3,/);
  // the plain note has no comma, so it is not quoted; the trailing empty field is the free "note" column
  assert.match(booking, /,14,M,Core booking rules with a few open questions; touches every customer if it breaks,$/);
});

test('parseCsv handles quoted commas, doubled quotes and CRLF', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi""",d\r\n1,2,3,4\n'), [['a', 'b, c', 'say "hi"', 'd'], ['1', '2', '3', '4']]);
});

test('fromCsv reads numbers, the plain note and the free-text note back', () => {
  const csv = toCsv(draft())
    .replace(/^(booking,[^,]*,)3,/m, (m, head) => `${head}4,`)
    .replace(/,14,M,([^,\n]*),$/m, (m, note) => `,15,L,${note},move risk up`);
  const edited = fromCsv(csv);
  assert.equal(edited.features[0].id, 'booking');
  assert.equal(edited.features[0].scores.tech, 4);
  assert.equal(edited.features[0].note, 'move risk up');
  assert.equal(edited.features[1].scores.deps, 3);
});

test('diffScores names exactly the cells the human changed', () => {
  const d = draft();
  const edited = { features: [
    { id: 'booking', scores: { tech: 4, size: 3, deps: 2, unc: 3, risk: 3 }, scoreNote: d.features[0].scoreNote, note: 'algorithm is fuzzy matching' },
    { id: 'reminders', scores: { tech: 2, size: 2, deps: 3, unc: 2, risk: 2 }, scoreNote: 'Reminder emails via an outside provider', note: '' },
  ] };
  assert.deepEqual(diffScores(d, edited), [
    { id: 'booking', field: 'tech', from: 3, to: 4 },
    { id: 'booking', field: 'note', to: 'algorithm is fuzzy matching' },
    { id: 'reminders', field: 'scoreNote', from: d.features[1].scoreNote, to: 'Reminder emails via an outside provider' },
  ]);
});

test('applyDiff re-anchors a changed score from the guide and marks the feature stated', () => {
  const d = draft();
  const guide = loadGuide();
  const diff = [{ id: 'reminders', field: 'tech', from: 2, to: 4 }];
  const features = applyDiff({ draft: d, diff, guide });
  assert.equal(features[1].scores.tech.n, 4);
  assert.equal(features[1].scores.tech.anchor, guide.tech[3]);
  assert.equal(features[1].scores.tech.cite, 'scheduled job + template', 'cite is kept for the agent to revisit');
  assert.equal(features[1].scoreProvenance, 'stated');
  assert.equal(features[0].scoreProvenance, 'stated', 'untouched features keep their provenance');
  assert.deepEqual(d.features[1].scores.tech.n, 2, 'draft is not mutated');
});
```

- [ ] **Step 2: Run to see them fail**

```bash
node --test scripts/test/score-review.test.mjs
```

Expected: `Cannot find module '../lib/score-csv.mjs'`.

- [ ] **Step 3: Write `scripts/lib/score-csv.mjs`**

```js
// Spreadsheet review channel: the agent writes its proposed scores as a CSV
// the human edits in Sheets/Excel; the numbers, the plain note and a free
// "note" column come back. Anchors and cites travel beside each score so the
// reviewer sees the reason without opening anything else.
import { SCORE_FACTORS, scoreNumbers } from './scoring.mjs';
import { tierFor } from './estimate-math.mjs';

export const CSV_HEADERS = ['id', 'feature',
  ...SCORE_FACTORS.flatMap((k) => [k, `${k}_why`, `${k}_cite`]), 'sum', 'tier', 'why_this_tier', 'note'];

const quote = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

function featureRow(f) {
  const { total, tier } = tierFor(scoreNumbers(f.scores));
  return [f.id, f.name, ...SCORE_FACTORS.flatMap((k) => [f.scores[k].n, f.scores[k].anchor, f.scores[k].cite]),
    total, tier, f.scoreNote, ''];
}

export function toCsv(draft) {
  return [CSV_HEADERS, ...draft.features.map(featureRow)].map((r) => r.map(quote).join(',')).join('\n') + '\n';
}

// RFC 4180: quoted fields may hold commas, newlines and doubled quotes.
export function parseCsv(text) {
  const rows = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rows.at(-1).push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      rows.at(-1).push(field); field = ''; rows.push([]);
    } else field += c;
  }
  if (field !== '' || rows.at(-1).length) rows.at(-1).push(field);
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

export function fromCsv(text) {
  const [head, ...rows] = parseCsv(text);
  const col = (name) => head.indexOf(name);
  return { features: rows.map((r) => ({
    id: r[col('id')],
    scores: Object.fromEntries(SCORE_FACTORS.map((k) => [k, Number(r[col(k)])])),
    scoreNote: r[col('why_this_tier')],
    note: r[col('note')] ?? '',
  })) };
}
```

If the quality gate flags `parseCsv` over 22 code lines, move the quoted-branch into `const step = (state, c, next) => …` helper; keep behaviour identical and re-run the test.

- [ ] **Step 4: Write `scripts/lib/score-diff.mjs`**

```js
// What the human changed, and how to fold it back into the draft. A changed
// score gets the guide's sentence for its new value (the anchor is a function
// of factor × score, never free text) and keeps its cite for the agent to
// revisit; any change flips the feature to `stated`.
import { SCORE_FACTORS } from './scoring.mjs';

export function diffScores(draft, edited) {
  const out = [];
  for (const e of edited.features) {
    const d = draft.features.find((f) => f.id === e.id);
    if (!d) continue;
    for (const k of SCORE_FACTORS) {
      if (e.scores[k] !== d.scores[k].n) out.push({ id: e.id, field: k, from: d.scores[k].n, to: e.scores[k] });
    }
    if (e.scoreNote !== undefined && e.scoreNote !== d.scoreNote) out.push({ id: e.id, field: 'scoreNote', from: d.scoreNote, to: e.scoreNote });
    if (e.note) out.push({ id: e.id, field: 'note', to: e.note });
  }
  return out;
}

function applyOne(feature, change, guide) {
  if (change.field === 'note') return feature;
  if (change.field === 'scoreNote') return { ...feature, scoreNote: change.to, scoreProvenance: 'stated' };
  const score = { ...feature.scores[change.field], n: change.to, anchor: guide[change.field][change.to - 1] };
  return { ...feature, scores: { ...feature.scores, [change.field]: score }, scoreProvenance: 'stated' };
}

export function applyDiff({ draft, diff, guide }) {
  return draft.features.map((f) => diff.filter((c) => c.id === f.id).reduce((acc, c) => applyOne(acc, c, guide), f));
}
```

- [ ] **Step 5: Run tests, commit**

```bash
node --test scripts/test/score-review.test.mjs scripts/test/quality-gates.test.mjs
git add scripts/lib/score-csv.mjs scripts/lib/score-diff.mjs scripts/test/score-review.test.mjs
git commit -m "feat(estimate): csv round-trip and diff for score review"
```

---

### Task 8: HTML review page and the `score-review.mjs` CLI

**Files:**
- Create: `assets/scores-review-template.html`
- Create: `scripts/lib/score-html.mjs`
- Create: `scripts/score-review.mjs`
- Modify: `scripts/test/score-review.test.mjs`

**Interfaces:**
- Consumes: Task 7 modules; `embed` from `analyze-requirements/scripts/lib/embed.mjs`; `extractExports`/`inlineModule` from `lib/inline.mjs`; `guideTableHtml(loadGuide())`.
- Produces: `toHtml({ draft, template, guideHtml, mathSrc }) → string` with slots `TITLE, DATA, GUIDE, MATH`; the page exposes `window.__feedback()` returning the edited shape and a `#feedback` `<textarea>` + copy button; CLI:
  - `node scripts/score-review.mjs --write draft.json --format csv|html --out <file>`
  - `node scripts/score-review.mjs --read <scores-draft.csv | feedback.json> --draft draft.json` → prints `{ "diff": [...], "features": [...] }` to stdout.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test/score-review.test.mjs`:

```js
import { mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../../../analyze-requirements/scripts/lib/chrome.mjs';
import { openPage } from '../../../analyze-requirements/scripts/lib/cdp.mjs';

const cli = new URL('../score-review.mjs', import.meta.url).pathname;
const skip = { skip: !findChrome() && 'no chrome on PATH' };

function writeDraft() {
  const dir = mkdtempSync(join(tmpdir(), 'score-review-'));
  const path = join(dir, 'draft.json');
  writeFileSync(path, JSON.stringify(draft()));
  return { dir, path };
}

test('CLI: --write csv then --read reports the diff and the re-anchored features', () => {
  const { dir, path } = writeDraft();
  const csvPath = join(dir, 'scores-draft.csv');
  execFileSync('node', [cli, '--write', path, '--format', 'csv', '--out', csvPath]);
  const edited = readFileSync(csvPath, 'utf8').replace(/^(reminders,[^,]*,)2,/m, (m, head) => `${head}4,`);
  writeFileSync(csvPath, edited);
  const out = JSON.parse(execFileSync('node', [cli, '--read', csvPath, '--draft', path], { encoding: 'utf8' }));
  assert.deepEqual(out.diff, [{ id: 'reminders', field: 'tech', from: 2, to: 4 }]);
  assert.equal(out.features[1].scores.tech.anchor, loadGuide().tech[3]);
  assert.equal(out.features[1].scoreProvenance, 'stated');
});

test('CLI: --write html renders one select per score with the anchor as its title', skip, async () => {
  const { dir, path } = writeDraft();
  const htmlPath = join(dir, 'scores-review.html');
  execFileSync('node', [cli, '--write', path, '--format', 'html', '--out', htmlPath]);
  const page = await openPage(pathToFileURL(htmlPath).href);
  try {
    assert.deepEqual(page.errors, []);
    assert.equal(await page.eval(`document.querySelectorAll('select[data-id][data-key]').length`), 10);
    assert.equal(await page.eval(`document.querySelector('select[data-id="booking"][data-key="tech"]').value`), '3');
    assert.match(await page.eval(`document.querySelector('select[data-id="booking"][data-key="tech"]').title`), /Custom business logic/);
    assert.equal(await page.eval(`document.querySelector('[data-total="reminders"]').textContent`), '11');
    assert.equal(await page.eval(`document.querySelector('[data-tier="reminders"]').textContent`), 'S');
    assert.match(await page.eval(`document.querySelector('details.guide').textContent`), /Tech complexity/);
  } finally { page.close(); }
});

test('review page: changing a select updates Σ/tier live and the feedback block round-trips', skip, async () => {
  const { dir, path } = writeDraft();
  const htmlPath = join(dir, 'scores-review.html');
  execFileSync('node', [cli, '--write', path, '--format', 'html', '--out', htmlPath]);
  const page = await openPage(pathToFileURL(htmlPath).href);
  try {
    await page.eval(`(() => { const s = document.querySelector('select[data-id="reminders"][data-key="tech"]'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    assert.equal(await page.eval(`document.querySelector('[data-total="reminders"]').textContent`), '13');
    assert.equal(await page.eval(`document.querySelector('[data-tier="reminders"]').textContent`), 'M');
    const feedback = JSON.parse(await page.eval(`document.getElementById('feedback').value`));
    const fbPath = join(dir, 'feedback.json');
    writeFileSync(fbPath, JSON.stringify(feedback));
    const out = JSON.parse(execFileSync('node', [cli, '--read', fbPath, '--draft', path], { encoding: 'utf8' }));
    assert.deepEqual(out.diff, [{ id: 'reminders', field: 'tech', from: 2, to: 4 }]);
  } finally { page.close(); }
});
```

Move the `readFileSync` import at the top of the file to include the new names (`import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';`) and drop the duplicate import line added above.

- [ ] **Step 2: Run to see them fail**

```bash
node --test scripts/test/score-review.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```

Expected: three new tests fail (`score-review.mjs` not found).

- [ ] **Step 3: Write `assets/scores-review-template.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><!-- slot:TITLE --> — score review</title>
<style>
:root {
  color-scheme:light;
  --bg:#f7f5f0; --ink:#1c1b18; --ink-dim:#6f6a5e;
  --accent:#0f766e; --accent-ink:#0b5a54; --accent-soft:rgba(15,118,110,.08);
  --warn:#b45309; --warn-soft:rgba(180,83,9,.1);
  --bad:#b91c1c; --card:#fffdf9; --border:#e6e1d5;
}
* { box-sizing:border-box; }
body { margin:0; padding:1.5rem; font-family:system-ui,sans-serif; font-size:.9rem; background:var(--bg); color:var(--ink); }
h1 { font-size:1.2rem; margin:0 0 .3rem; }
p.lead { color:var(--ink-dim); margin:0 0 1rem; max-width:60rem; }
table { border-collapse:collapse; width:100%; background:var(--card); }
th, td { border-bottom:1px solid var(--border); padding:.4rem .5rem; text-align:left; vertical-align:top; }
th.score, td.score { text-align:center; width:3.6rem; }
td.score select { font:inherit; font-family:ui-monospace,monospace; width:3.2rem; text-align:center; }
td.score select.hot { color:var(--bad); font-weight:600; }
.tier { font-family:ui-monospace,monospace; font-size:.72rem; font-weight:600; padding:.12rem .45rem; border-radius:.25rem; background:var(--border); }
.tier.l { background:var(--warn-soft); color:var(--warn); }
.tier.xl { background:rgba(185,28,28,.1); color:var(--bad); }
.edge { color:var(--warn); cursor:help; margin-left:.15rem; }
.cite { color:var(--ink-dim); font-size:.78rem; }
td.note textarea { width:100%; min-height:2.6rem; font:inherit; font-size:.82rem; }
details.guide { margin:1.2rem 0; }
details.guide summary { cursor:pointer; font-weight:600; color:var(--ink-dim); }
.guide-table { font-size:.8rem; margin-top:.6rem; }
.guide-table td.dim { font-weight:600; white-space:nowrap; }
#feedback-wrap { margin-top:1.2rem; }
#feedback { width:100%; min-height:7rem; font-family:ui-monospace,monospace; font-size:.75rem; }
button { font:inherit; padding:.35rem .8rem; border:1px solid var(--border); border-radius:.3rem; background:var(--card); cursor:pointer; }
button:hover { border-color:var(--accent); color:var(--accent-ink); }
</style>
</head>
<body>
<h1><!-- slot:TITLE --> — score review</h1>
<p class="lead">Each score is the agent's proposal; hover a dropdown for the rubric sentence it matched, read the evidence beside it. Change any cell, rewrite the plain-words note if it reads wrong, then copy the feedback block back into the chat.</p>
<div id="review"></div>
<details class="guide" open><summary>Scoring guide — what each 1–5 means</summary><!-- slot:GUIDE --></details>
<div id="feedback-wrap">
  <button type="button" id="copy">copy feedback</button> <span id="copied" hidden>copied</span>
  <textarea id="feedback" readonly aria-label="feedback JSON"></textarea>
</div>
<script type="application/json" id="draft-data"><!-- slot:DATA --></script>
<script>
<!-- slot:MATH -->
const DRAFT = JSON.parse(document.getElementById('draft-data').textContent);
const KEYS = ['tech', 'size', 'deps', 'unc', 'risk'];
const LABELS = { tech: 'Tech', size: 'Size', deps: 'Deps', unc: 'Unc', risk: 'Risk' };
const EDGE = [11, 17, 22];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const state = Object.fromEntries(DRAFT.features.map((f) => [f.id, {
  scores: Object.fromEntries(KEYS.map((k) => [k, f.scores[k].n])), scoreNote: f.scoreNote,
}]));

function scoreCell(f, k) {
  const s = f.scores[k];
  const opts = [1, 2, 3, 4, 5].map((n) => `<option value="${n}"${n === s.n ? ' selected' : ''}>${n}</option>`).join('');
  return `<td class="score"><select data-id="${f.id}" data-key="${k}" class="${s.n === 5 ? 'hot' : ''}"
    title="${esc(s.anchor)}">${opts}</select><div class="cite">${esc(s.cite)}</div></td>`;
}

function row(f) {
  const { total, tier } = tierFor(state[f.id].scores);
  const edge = EDGE.includes(total) ? ' <span class="edge" title="one point from the next tier">&#9873;</span>' : '';
  return `<tr><td><strong>${esc(f.name)}</strong><div class="cite">${f.id} · ${f.scoreProvenance}</div></td>
    ${KEYS.map((k) => scoreCell(f, k)).join('')}
    <td class="score"><span data-total="${f.id}">${total}</span>${edge}</td>
    <td class="score"><span class="tier ${tier.toLowerCase()}" data-tier="${f.id}">${tier}</span></td>
    <td class="note"><textarea data-note="${f.id}" aria-label="why this tier">${esc(state[f.id].scoreNote)}</textarea></td></tr>`;
}

function render() {
  const head = `<tr><th>Feature</th>${KEYS.map((k) => `<th class="score">${LABELS[k]}</th>`).join('')}
    <th class="score">&Sigma;</th><th class="score">Tier</th><th>Why this tier (plain words, for the client)</th></tr>`;
  document.getElementById('review').innerHTML = `<table><thead>${head}</thead><tbody>${DRAFT.features.map(row).join('')}</tbody></table>`;
  document.getElementById('feedback').value = JSON.stringify(window.__feedback(), null, 1);
}

window.__feedback = () => ({ features: DRAFT.features.map((f) => ({ id: f.id, ...state[f.id] })) });

function onChange(e) {
  const sel = e.target.closest('select[data-id]');
  const note = e.target.closest('textarea[data-note]');
  if (sel) state[sel.dataset.id].scores[sel.dataset.key] = Number(sel.value);
  if (note) state[note.dataset.note].scoreNote = note.value;
  if (sel || note) render();
}

document.getElementById('review').addEventListener('change', onChange);
document.getElementById('review').addEventListener('input', (e) => {
  if (e.target.matches('textarea[data-note]')) state[e.target.dataset.note].scoreNote = e.target.value;
});
document.getElementById('copy').addEventListener('click', async () => {
  const text = JSON.stringify(window.__feedback());
  document.getElementById('feedback').value = text;
  try { await navigator.clipboard.writeText(text); document.getElementById('copied').hidden = false; } catch { /* file:// may refuse; the textarea holds it */ }
});
render();
</script>
</body>
</html>
```

The `MATH` slot receives `TIER_BREAKS` and `tierFor` from `estimate-math.mjs` (this is where the spec's "tierFor inlined" lands). `render()` re-renders the whole table on change, so the textarea loses focus after an edit — the `input` listener keeps `state` current without re-rendering; `change` (on blur) re-renders.

- [ ] **Step 4: Write `scripts/lib/score-html.mjs`**

```js
// HTML review channel: the agent's draft rendered as one editable table,
// Σ/tier live, the rubric folded underneath, and a feedback block the human
// copies back. Same slots discipline as the estimate page (embed is strict).
import { embed } from '../../../analyze-requirements/scripts/lib/embed.mjs';
import { inlineModule, extractExports } from './inline.mjs';

export function toHtml({ draft, template, guideHtml, mathSrc }) {
  return embed({
    template,
    slots: {
      TITLE: draft.project ?? 'Estimate',
      DATA: JSON.stringify(draft).replaceAll('</script', '<\\/script'),
      GUIDE: guideHtml,
      MATH: inlineModule(extractExports(mathSrc, ['TIER_BREAKS', 'tierFor'])),
    },
  });
}
```

- [ ] **Step 5: Write `scripts/score-review.mjs`**

```js
// Score review round-trip. --write turns the agent's draft into a CSV or an
// HTML review page; --read takes the edited CSV (or the page's feedback
// JSON) and prints the diff plus the re-anchored features for the agent to
// write into estimation-inputs.json. It scores nothing itself.
import { readFileSync, writeFileSync } from 'node:fs';
import { toCsv, fromCsv } from './lib/score-csv.mjs';
import { diffScores, applyDiff } from './lib/score-diff.mjs';
import { toHtml } from './lib/score-html.mjs';
import { loadGuide, guideTableHtml } from './lib/scoring.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const templatePath = new URL('../assets/scores-review-template.html', import.meta.url).pathname;
const mathPath = new URL('./lib/estimate-math.mjs', import.meta.url).pathname;
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

function write(args) {
  const draft = json(args.write);
  const out = args.format === 'html'
    ? toHtml({ draft, template: readFileSync(templatePath, 'utf8'), guideHtml: guideTableHtml(loadGuide()), mathSrc: readFileSync(mathPath, 'utf8') })
    : toCsv(draft);
  writeFileSync(args.out, out);
  console.log(args.out);
}

function read(args) {
  const draft = json(args.draft);
  const edited = args.read.endsWith('.json') ? json(args.read) : fromCsv(readFileSync(args.read, 'utf8'));
  const diff = diffScores(draft, edited);
  const features = applyDiff({ draft, diff, guide: loadGuide() });
  console.log(JSON.stringify({ diff, features }, null, 2));
}

const args = parseArgs(process.argv.slice(2));
if (args.write) write(args);
else if (args.read) read(args);
else {
  console.error('usage: score-review.mjs --write draft.json --format csv|html --out <file>\n       score-review.mjs --read <csv|feedback.json> --draft draft.json');
  process.exit(1);
}
```

- [ ] **Step 6: Run the tests**

```bash
node --test scripts/test/score-review.test.mjs scripts/test/quality-gates.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```

Expected: `fail 0`. `templateScripts(base)` in the quality-gates test also scans `assets/*.html`; if it flags a review-page function over 22 lines, split `row()` (move the two trailing cells into `tailCells(f, total, tier)`).

- [ ] **Step 7: Commit**

```bash
git add assets/scores-review-template.html scripts/lib/score-html.mjs scripts/score-review.mjs scripts/test/score-review.test.mjs
git commit -m "feat(estimate): html review page and score-review CLI"
```

---

### Task 9: Documentation — interview, techniques, writing, SKILL, README

**Files:**
- Modify: `references/interview.md:79-84, 100-101`
- Modify: `references/techniques.md:20-48`
- Modify: `references/writing.md:10-27, 136-142`
- Modify: `SKILL.md:22-33`
- Modify: `README.md:14-17`
- Modify: `scripts/test/references.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test/references.test.mjs`:

```js
test('interview.md scores before tasks, names the three review channels and the plain-words note', () => {
  const doc = ref('interview.md');
  for (const needle of ['scoring-guide.md', 'scores', 'scoreNote', 'scoreProvenance', 'terminal', 'csv', 'html',
    'score-review.mjs', 'accept', 'split', 'outside', 'plain']) {
    assert.ok(doc.includes(needle), `interview.md missing: ${needle}`);
  }
  assert.ok(doc.indexOf('Factor scores per feature') < doc.indexOf('Tasks + O/M/P'), 'scores come before tasks');
});

test('techniques.md says scores persist at STANDARD/DEEP and the band is a soft cross-check', () => {
  const doc = ref('techniques.md');
  assert.match(doc, /STANDARD\/DEEP/);
  assert.match(doc, /persist/i);
  assert.match(doc, /cross-check/i);
  assert.match(doc, /XL 400-800h|XL 400–800 h/);
});

test('writing.md documents the score fields and the Tier rule', () => {
  const doc = ref('writing.md');
  for (const needle of ['`scores`', '`scoreNote`', '`scoreProvenance`', 'anchor', 'cite', 'Tier']) {
    assert.ok(doc.includes(needle), `writing.md missing: ${needle}`);
  }
  assert.match(doc, /Tier.*must (equal|match)/);
});

test('SKILL.md points the interview at the scoring guide and the review script', () => {
  const skill = readFileSync(new URL('../../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /scoring-guide\.md/);
  assert.match(skill, /score-review\.mjs/);
});
```

- [ ] **Step 2: Run to see them fail**

```bash
node --test scripts/test/references.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```

Expected: the four new tests fail.

- [ ] **Step 3: `references/interview.md` — replace §4 step 3**

Replace lines 79–84 (the `3. **Factor scores per feature** …` item) with:

````markdown
3. **Factor scores per feature** — all depths. Read
   `references/scoring-guide.md` first; every anchor you show is quoted from
   it verbatim, never paraphrased. TRADITIONAL-only: in AGENTIC mode this
   step is replaced entirely — ask shape + scope + seed minutes per task
   instead (§2b, `task-shapes.md`).

   **Review channel** — ask once, before the first card, with a one-line
   reason per option and a recommendation from the feature count
   (≤ 8 → terminal, 9–14 → csv, 15+ → html; the human overrides freely):

   ```text
   25 features to score. How do you want to review them?
     1. terminal   cards here, 4–6 per turn, reply "accept" or "F03 deps 4"
                   — fastest for ≤ 8 features, no file to open
     2. csv        I write scores-draft.csv, you edit in Sheets/Excel, say "done"
                   — all rows on one screen, notes column, fits the workbook habit
     3. html       I write scores-review.html, you open it, set dropdowns, copy
                   the feedback block back here
                   — anchor text on hover, edge/XL badges, best for 15+ features
   Recommended: 2 (25 features).
   ```

   For csv and html, write your proposals as `draft.json` (`{ project,
   features: [{ id, name, scores, scoreNote, scoreProvenance }] }`), then
   `node scripts/score-review.mjs --write draft.json --format csv|html --out
   <file>`. When the human says done, `node scripts/score-review.mjs --read
   <file> --draft draft.json` prints the diff and the re-anchored features;
   report the diff (`3 changes: F07 risk 5→4, … — all stated. Σ moves F12 to
   L. Proceed?`) before writing them into `estimation-inputs.json`.

   **Cards** (terminal channel, and the shape every channel's row carries):
   one per feature, 4–6 per turn, every cell filled from evidence you already
   read, cite inline. The human answers `accept`, `<factor> <n>`, `why
   <text>`, or `split`.

   ```text
   ┌ F07  Payment reconciliation ──────────────────────────────────── proposed ┐
   │  Tech  4  Non-trivial algorithms, real-time systems, ML inference,        │
   │           complex data transforms                                         │
   │           ← ARCHITECTURE.md §6: fuzzy match bank rows to invoices         │
   │  Size  3  Medium feature with multiple components and backend logic       │
   │           ← PRD §4.2: 3 screens + nightly job                             │
   │  Deps  4  Multiple third-party APIs or tightly coupled internal systems   │
   │           ← Stripe API + bank CSV import                                  │
   │  Unc   3  Some open questions, design decisions to be made during build   │
   │           ← PRD §4.2: "reconciliation rules TBD"                          │
   │  Risk  5  Core infrastructure, compliance requirements, irreversible ops  │
   │           ← payments; rubric puts payments at 4–5, chose 5: irreversible  │
   │  Σ 19  →  L  →  160–400 h                                                 │
   │  Why (client): handles payments and two outside services; matching       │
   │                rules still to be decided                                  │
   │  accept · change <factor> <n> · why <text> · split                        │
   └───────────────────────────────────────────────────────────────────────────┘
   ```

   Rules: the anchor is the guide's full sentence for that factor and score;
   the cite quotes the fact it rests on; no evidence for a factor → the cell
   is `?` and you ask, never a silent 3. Σ at 11, 17 or 22 shows `one point
   from <tier>; <factor> +1 moves this to <band>`; Σ > 22 recommends `split`
   before `accept`; any 5 shows `review`. `Why` is one plain sentence for a
   non-technical reader — what the feature touches and what is still
   unknown; no file names, no factor names, no rubric wording. `split`
   returns to the clear-vs-assumed gate (§5).

   **Writing it down.** STANDARD/DEEP: every feature gets `scores` (per
   factor `{ n, anchor, cite }`), `scoreNote` (the `Why` sentence) and
   `scoreProvenance` — `proposed` when accepted as offered, `stated` when
   any cell or the note was changed. QUICK: use the scores for the tier and
   the calibration band as today; do not write them (`schema.mjs` refuses
   them at QUICK).

3b. **Tasks + O/M/P** — STANDARD/DEEP only, per `techniques.md` §3. After a
   feature's tasks are sized, compare `Σ pert(e)` with its tier's calibration
   band. Outside the band, say so once — `Σ19 → L → 160–400 h, tasks sum to
   85 h; tasks missing or scores high?` — and let the human decide. Nothing
   is refused and nothing new is written; the page marks the row ⚠.
````

Also in step 7 (calibration) change the defaults to `S 20-60h, M 60-160h, L 160-400h, XL 400-800h`.

- [ ] **Step 4: `references/techniques.md` §2**

After the paragraph ending `never assign hours from the tier letter directly.` insert:

```markdown
At STANDARD/DEEP the five scores are persisted on every feature (`scores`,
`scoreNote`, `scoreProvenance` — `interview.md` §4 step 3) and the PERT
total per feature is a soft cross-check against the tier's band: outside it,
the interviewer says so once and the page marks the row ⚠; nothing is
refused. Scores are never derived from hours.
```

(The tier-break line and the XL default were already changed in Task 1.)

- [ ] **Step 5: `references/writing.md`**

In §1, after the sentence ending `Every task carries \`id\`, \`name\`, \`category\`, \`o\`, \`m\`, \`p\`, \`confidence\`, \`assumptions\`, \`provenance\`.` insert:

```markdown
At `STANDARD`/`DEEP` every feature also carries `scores` — one entry per
factor `tech`, `size`, `deps`, `unc`, `risk`, each `{ "n": 1–5, "anchor":
"<the scoring-guide.md sentence for that factor and score, verbatim>",
"cite": "<the evidence it rests on>" }` — a `scoreNote` (one plain sentence
for a non-technical reader: no file names, factor names or `§`) and a
`scoreProvenance` of `stated` or `proposed`. `schema.mjs` checks the anchor
against the guide byte for byte. At `QUICK` these fields must be absent.
```

In §3 after rule 11 add:

```markdown
11b. At `STANDARD`/`DEEP` the scope table has a `Tier` column and every
    row's Tier must match `computed.features[<id>].tier` (the letter the
    scores produced — `scoring-checks.mjs`). At `QUICK` the Tier cell is
    the agent's own call, unchecked.
```

- [ ] **Step 6: `SKILL.md`**

Replace flow step 3 with:

```markdown
3. **Interview**: follow `references/interview.md` — pre-fill from evidence,
   ask only holes, run the clear-vs-assumed gate before sizing. Read
   `references/scoring-guide.md` before proposing any score; offer the
   review channel (terminal cards, csv, or html via
   `node scripts/score-review.mjs`). Before proposing milestones, read
   `references/slicing.md` — slices are judged there, not computed.
```

- [ ] **Step 7: `README.md`**

In the interactive-page paragraph change `the feature breakdown,` to `the feature breakdown (the interview's five factor scores per feature, Σ, tier and hours side by side; a spreadsheet export with a scoring tab, a Score Rationale tab and a task tab),`.

- [ ] **Step 8: Run tests, commit**

```bash
node --test scripts/test/references.test.mjs scripts/test/e2e.test.mjs
npm test 2>&1 | tail -5
git add references SKILL.md README.md scripts/test/references.test.mjs
git commit -m "docs(estimate): score cards, review channels, persisted scores"
```

---

### Task 10: Backfill the two live leads (interactive — main session with the user, not a subagent)

**Files:**
- Modify: `~/WIP/mine/new-lead-livetest/leads/montalvo/{estimation-inputs.json,estimation.json,estimation.md}`
- Modify: `~/WIP/mine/new-lead-livetest/leads/residental-app/{estimation-inputs.json,estimation.json,estimation.md,estimation-options*.json}`

**Interfaces:**
- Consumes: the interview step 3 procedure (Task 9), `score-review.mjs` (Task 8), `compute.mjs`, `validate.mjs`.

- [ ] **Step 1: Confirm the leads now fail validation for the expected reason only**

```bash
cd ~/WIP/mine/new-lead-livetest/leads/montalvo
node ~/WIP/mine/agents-rock/plugins/solution-architect/skills/estimate/scripts/compute.mjs --inputs estimation-inputs.json --out /tmp/m.json 2>&1 | sort | uniq -c | sort -rn | head
```

Expected: 18 × `scores object is required at STANDARD/DEEP depth` (plus the `scoreNote`/`scoreProvenance` findings), nothing else. Same for residental-app (25 features).

- [ ] **Step 2: Ask the user for the review channel** (per interview §4 step 3; 18 and 25 features → recommend `html` for both, `csv` acceptable).

- [ ] **Step 3: Draft scores from evidence**

For each lead, read its `ARCHITECTURE.md` / PRD / scope text (the same evidence the original interview used), propose five scores per feature with anchors quoted from `references/scoring-guide.md` and a cite per cell, write a client-plain `scoreNote`, `scoreProvenance: "proposed"`, and save as `draft.json` beside the inputs. Any factor without evidence: `n` left out, ask the user in chat before writing the draft.

- [ ] **Step 4: Round-trip through the chosen channel**

```bash
node <skill>/scripts/score-review.mjs --write draft.json --format html --out scores-review.html
# user reviews, pastes feedback JSON → feedback.json
node <skill>/scripts/score-review.mjs --read feedback.json --draft draft.json > review-out.json
```

Report the diff to the user; on "proceed", merge `review-out.json`'s `features[]` score fields into `estimation-inputs.json` (match on `id`; do not touch tasks).

- [ ] **Step 5: Recompute, fix the md, validate**

```bash
node <skill>/scripts/compute.mjs --inputs estimation-inputs.json --out estimation.json
node <skill>/scripts/validate.mjs --md estimation.md --json estimation.json
```

Fix every `scope row "…": Tier X does not match scores (Y)` finding by rewriting that Tier cell in `estimation.md`'s Summary table. Re-run until `estimation deliverables valid`. For residental-app repeat compute for `estimation-options*.json` inputs if those are separate input files (check `ls` and how they were produced).

- [ ] **Step 6: Confirm hours did not move**

```bash
git -C ~/WIP/mine/new-lead-livetest diff --stat
git -C ~/WIP/mine/new-lead-livetest diff -- leads/montalvo/estimation.json | grep '^[-+]' | grep -v 'scoreTotal\|tier\|scores\|scoreNote\|scoreProvenance\|anchor\|cite\|"n":' | head
```

Expected: only score-related lines differ; no `hours`, `months`, `laborCost`, `totalCost` lines in the second command's output.

- [ ] **Step 7: Render and eyeball**

```bash
node <skill>/scripts/render.mjs --json estimation.json --md estimation.md --out dist
```

Open `dist/estimate.html`: score columns filled, ⚑ on Σ 11/17/22 rows, ⚠ where PERT hours fall outside the band (discuss those with the user — they are the cross-check finding real disagreements), notes under names, guide fold open. Download the xlsx and open it: Sheet 1 scores + column N, Score Rationale tab.

- [ ] **Step 8: Leave the livetest repo for the user to commit** (it is their repo; report the file list).

---

## Self-review

**Spec coverage**

| Spec section | Task |
| --- | --- |
| D1 depth names unchanged, QUICK untouched | 2 (QUICK rules), 5/6 (QUICK page/xlsx tests) |
| D2 scores/scoreNote/scoreProvenance required at STANDARD/DEEP, refused at QUICK | 2 |
| D3 derivation deleted | 5 |
| D4 one tier scale, XL band, guide file | 1 (page reads computed tier — deviation noted in Global Constraints; `tierFor` inlined into the review page in 8) |
| D5 rubric in `scoring-guide.md`, injected via slot | 1, 5 |
| D6 evidence-first cards, batching, provenance rule | 9 (docs) |
| D7 soft ⚠ cross-check | 5 (page), 9 (interview 3b) |
| D8 xlsx: $ columns kept, column N, Score Rationale tab | 6 |
| D9 backfill through interview | 10 |
| D10 review channel choice | 8 (tooling), 9 (question text) |
| §1.1 card layout, `?` rule, XL split | 9 |
| §1.2 CSV columns with `*_why`/`*_cite`, diff report | 7, 9 |
| §3.2 validation rules | 2 |
| §3.3 computed `scoreTotal`/`tier` | 3 |
| §5 Tier cell check | 4 |
| §6 page table | 5 |
| §7 xlsx | 6 |
| §8 docs | 9 |
| §9 migration | 10; fixtures in 2 |
| §10 tests | each task |

**Not covered, deliberately:** `interview.md` "who drafts the cards" subagent-per-batch (open decision in the spec) — a one-line note in §4 step 3 can be added when the user decides; no code depends on it.

**Type consistency:** `scores.<k> = { n, anchor, cite }` everywhere (Tasks 2, 5, 6, 7, 8); `computed.features[id].scoreTotal`/`.tier` (Tasks 3, 4, 5); edited shape `{ features: [{ id, scores: { k: n }, scoreNote, note }] }` (Tasks 7, 8); diff entry `{ id, field, from, to }` (Tasks 7, 8); `SCORE_KEYS`/`SCORE_LABELS` in the template (Tasks 5, 6) mirror `SCORE_FACTORS`/short labels in `scoring.mjs` (Task 1).
