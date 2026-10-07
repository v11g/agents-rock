import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { loadLead, proposalFindings, isWorkflow } from '../lib/workflow-lead.mjs';
import { checkProposalInputs } from '../lib/workflow-checks.mjs';
import { lead, passInputs } from './workflow-stage.mjs';

const staged = lead();
const { est, req } = loadLead(staged.estimation);
const check = (edit) => { const inputs = passInputs(); edit(inputs); return checkProposalInputs({ inputs, est, req }); };

test('the sin-kowa-mini lead and its sentences pass', () => {
  assert.equal(isWorkflow(est), true);
  assert.deepEqual(proposalFindings(staged).findings, []);
});

test('W1: client, title, firm, scope intro, ISO date and tech level are required', () => {
  const out = check((i) => { delete i.firm; i.scopeIntro = ' '; i.date = '7 Oct 2026'; i.techLevel = 'expert'; });
  assert.deepEqual(out, [
    'proposal-inputs.json: missing "firm"',
    'proposal-inputs.json: missing "scopeIntro"',
    'proposal-inputs.json: "date" must be an ISO date (YYYY-MM-DD)',
    'proposal-inputs.json: "techLevel" must be non-tech | low-tech | technical',
  ]);
});

test('W2: every milestone the features use needs a name and what it demonstrates; no unknown keys', () => {
  const out = check((i) => {
    delete i.milestones['M2 - Money'].demonstrates;
    i.milestones['M9 - Later'] = { name: 'x', demonstrates: 'y' };
    i.systems['SYS-404'] = 'nothing';
    i.systems['SYS-001'] = '';
  });
  assert.deepEqual(out, [
    'milestone "M2 - Money": needs a client "name" and "demonstrates"',
    'milestones: "M9 - Later" is not a milestone of this estimate',
    'systems: "SYS-404" is not a system in requirements.json',
    'systems: "SYS-001" needs a sentence or no entry',
  ]);
});

test('W3: a price written in a sentence is refused, in any common spelling', () => {
  for (const said of ['$40k', 'USD 5,000', 'SGD150,000', '5,000 dollars', '12k SGD', '€300']) {
    const out = check((i) => { i.scopeIntro = `Phase 1 costs about ${said} in total.`; });
    assert.equal(out.length, 1, said);
    assert.match(out[0], /^scopeIntro: price ".+" — prices come only from the estimate$/, said);
  }
  assert.deepEqual(check((i) => { i.scopeIntro = 'It covers 2 systems and 5 features in 3 milestones.'; }), []);
});

test('W3: lowercase, regional and spelled-out prices are refused too', () => {
  for (const said of ['5000 usd', 'usd 5,000', '5,000 Dollars', 'RM 20,000', 'MYR 20,000', 'HKD 10k', 'JPY 300000',
    'VND 500,000,000', '¥300,000', '₹50,000', '1.2 million USD', '40 thousand dollars']) {
    const out = check((i) => { i.scopeIntro = `Phase 1 costs about ${said} in total.`; });
    assert.equal(out.length, 1, said);
    assert.match(out[0], /^scopeIntro: price ".+" — prices come only from the estimate$/, said);
  }
  assert.deepEqual(check((i) => { i.scopeIntro = 'In 2 months, 3 teams cover 5 features over 2026.'; }), []);
});

test('W3/W4: the title is the page heading, so it is held to the sentence rules', () => {
  const out = check((i) => { i.title = 'Sin Kowa FEAT-001 for $40k'; });
  assert.deepEqual(out, ['title: price "$40k" — prices come only from the estimate', 'title: internal ID "FEAT-001" — name the thing in words']);
});

test('W4: an engineer milestone name in a sentence is refused (P6)', () => {
  const out = check((i) => { i.scopeIntro = 'After M1 - Walking skeleton the team moves on.'; });
  assert.deepEqual(out, ['scopeIntro: internal ID "M1 - " — name the thing in words']);
});

test('W4: an internal ID in a sentence is refused', () => {
  const out = check((i) => { i.milestones['M1 - Walking skeleton'].demonstrates = 'FEAT-001 works end to end.'; });
  assert.deepEqual(out, ['milestones.M1 - Walking skeleton.demonstrates: internal ID "FEAT-001" — name the thing in words']);
});

test('W5: jargon is refused for a non-tech client, allowed when listed or for a technical one', () => {
  const said = (i) => { i.systems['SYS-002'] = 'A backend checks every order.'; };
  assert.deepEqual(check(said), ['systems.SYS-002: jargon for a non-tech client: "backend" (rewrite plainly or add to jargonAllow)']);
  assert.deepEqual(check((i) => { said(i); i.jargonAllow = ['Backend']; }), []);
  assert.deepEqual(check((i) => { said(i); i.techLevel = 'technical'; }), []);
});

test('W6: a stale estimate, a missing BA package or bad inputs JSON stop before the sentences', () => {
  const stale = lead();
  const e = JSON.parse(readFileSync(stale.estimation, 'utf8'));
  e.computed.features['FEAT-001'].point += 1;
  writeFileSync(stale.estimation, JSON.stringify(e));
  assert.match(proposalFindings(stale).findings.join('\n'), /computed block differs/);
  const noReq = lead();
  unlinkSync(join(noReq.dir, 'requirements.json'));
  assert.match(proposalFindings(noReq).findings[0], /^requirements\.json not found/);
  const bad = lead();
  writeFileSync(bad.inputs, '{ “client”: "Sin Kowa" }');
  const { findings } = proposalFindings(bad);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /^proposal-inputs\.json: /);
});
