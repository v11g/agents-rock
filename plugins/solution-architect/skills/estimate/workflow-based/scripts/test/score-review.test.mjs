import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { pageData } from '../lib/score-html.mjs';
import { diffLinks, applyLinks, readFeedback } from '../lib/score-diff.mjs';
import { loadGuide } from '../../../shared/lib/scoring.mjs';

const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const script = fileURLToPath(new URL('../score-review.mjs', import.meta.url));
const feedback = () => JSON.parse(readFileSync(fx('feedback.json'), 'utf8'));

test('pageData maps the BA package and inputs into the page shape', () => {
  const { inputs, req } = loadPair(fx('inputs-pass.json'));
  const d = pageData({ inputs, req, guide: loadGuide() });
  assert.equal(d.data.project, 'sin-kowa-mini');
  assert.equal(d.data.systems.length, 2);
  assert.equal(d.data.systems[0].main.id, 'WF-002');
  assert.deepEqual(d.data.systems[1].subs.map((w) => w.id), ['WF-004']);
  assert.deepEqual(d.data.systems[0].features.map((f) => f.id), ['FEAT-001', 'FEAT-002']);
  assert.deepEqual(d.eng.map((c) => c.id).sort(), ['api.billing', 'api.orders', 'api.stage', 'office', 'ops', 'worker.drafter', 'worker.notify']);
  assert.equal(d.eng.find((c) => c.id === 'api.billing').container, 'Core API');
  assert.equal(d.eng.find((c) => c.id === 'office').container, 'Office Web App');
  assert.deepEqual(d.implements['office'], ['FEAT-001', 'FEAT-003', 'FEAT-005']);
  assert.deepEqual(d.scores['FEAT-001'], [3, 3, 2, 3, 3]);
  assert.equal(d.anchor.tech.length, 5);
});

test('diffLinks and applyLinks move FEAT-004 from the drafter to orders', () => {
  const { inputs } = loadPair(fx('inputs-pass.json'));
  const links = diffLinks(inputs, feedback());
  assert.deepEqual(links, [
    { component: 'api.orders', feature: 'FEAT-004', change: 'add' },
    { component: 'worker.drafter', feature: 'FEAT-004', change: 'remove' },
  ]);
  const comps = applyLinks(inputs, links);
  assert.deepEqual(comps.find((c) => c.id === 'api.orders').builds.map((b) => b.feature), ['FEAT-003', 'FEAT-004']);
  assert.equal(comps.find((c) => c.id === 'api.orders').builds[1].why, 'linked by the engineer in the score review');
  assert.deepEqual(comps.find((c) => c.id === 'worker.drafter').builds, []);
});

test('readFeedback: score diff, reasons, links and asks in one object', () => {
  const { inputs } = loadPair(fx('inputs-pass.json'));
  const r = readFeedback({ inputs, feedback: feedback(), guide: loadGuide() });
  assert.deepEqual(r.diff, [{ id: 'FEAT-002', field: 'risk', from: 3, to: 4 }]);
  assert.deepEqual(r.needsReason, []); // the engineer gave a reason
  assert.equal(r.features.find((f) => f.id === 'FEAT-002').scores.risk.n, 4);
  assert.equal(r.features.find((f) => f.id === 'FEAT-002').scoreProvenance, 'stated');
  assert.equal(r.links.length, 2);
  assert.deepEqual(r.asks, [{ feature: 'FEAT-004', note: 'a review screen for the draft is missing' }]);
});

test('unknown ids in feedback are ignored, not fatal', () => {
  const { inputs } = loadPair(fx('inputs-pass.json'));
  const fb = feedback();
  fb.components.push({ id: 'ghost', implements: ['FEAT-001'] });
  fb.features.push({ id: 'FEAT-099', scores: { tech: 1, size: 1, deps: 1, unc: 1, risk: 1 }, scoreNote: '' });
  const r = readFeedback({ inputs, feedback: fb, guide: loadGuide() });
  assert.equal(r.links.length, 2);
  assert.equal(r.features.length, 5);
});

test('CLI --write embeds the page data; --read prints the review object', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-sr-'));
  copyFileSync(fx('inputs-pass.json'), join(dir, 'estimation-inputs.json'));
  copyFileSync(fx('requirements.json'), join(dir, 'requirements.json'));
  execFileSync('node', [script, '--write', join(dir, 'estimation-inputs.json'), '--out', join(dir, 'review.html')]);
  const html = readFileSync(join(dir, 'review.html'), 'utf8');
  assert.match(html, /<title>sin-kowa-mini — score review<\/title>/);
  const data = JSON.parse(html.match(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.data.systems.length, 2);
  assert.doesNotMatch(html, /slot:/);
  writeFileSync(join(dir, 'feedback.json'), JSON.stringify(feedback()));
  const out = JSON.parse(execFileSync('node', [script, '--read', join(dir, 'feedback.json'), '--inputs', join(dir, 'estimation-inputs.json')], { encoding: 'utf8' }));
  assert.equal(out.links.length, 2);
  assert.equal(out.asks.length, 1);
});

test('a component entry without implements is ignored, not fatal', () => {
  const { inputs } = loadPair(fx('inputs-pass.json'));
  const fb = feedback();
  delete fb.components.find((c) => c.id === 'ops').implements;
  assert.equal(diffLinks(inputs, fb).length, 2);
});

// The page keys saved browser state to this fingerprint, so a page rebuilt
// after the agent changed scores or links never restores stale edits.
test('pageData baseline changes when a score or a link changes', () => {
  const { inputs, req } = loadPair(fx('inputs-pass.json'));
  const base = pageData({ inputs, req, guide: loadGuide() }).baseline;
  assert.match(base, /^[0-9a-f]{12}$/);
  inputs.features[0].scores.tech.n = 4;
  const moved = pageData({ inputs, req, guide: loadGuide() }).baseline;
  assert.notEqual(moved, base);
  inputs.components.find((c) => c.id === 'office').builds.pop();
  assert.notEqual(pageData({ inputs, req, guide: loadGuide() }).baseline, moved);
});
