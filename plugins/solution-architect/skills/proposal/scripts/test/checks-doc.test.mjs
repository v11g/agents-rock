import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionText, tables, SECTIONS } from '../lib/sections.mjs';
import { checkDoc } from '../lib/checks-doc.mjs';

const TODAY = new Date('2026-08-06');

function pricedEstimation() {
  return {
    computed: {
      price: { presentLow: 8000, presentHigh: 12000, singleNumber: 10000, p50: 7998 },
      roadmap: [
        { milestone: 'M1', features: ['a'], share: 0.75 },
        { milestone: 'M2', features: ['b'], share: 0.25 },
      ],
    },
  };
}

function validFm() {
  return {
    client: 'Acme Corp',
    client_tech_level: 'non-tech',
    currency: 'USD',
    valid_until: '2099-12-31',
    source_architecture: '../ARCHITECTURE.md',
    source_estimation: '../estimation.json',
  };
}

function fullDoc() {
  return `
## Executive Summary

We fix scheduling for $8,000 – $12,000.

## Background & Objectives

Bookings are manual today.

## Proposed Solution

\`\`\`mermaid
graph LR; A[You] --> B[New system]
\`\`\`

## Scope

| Feature | What you get |
| --- | --- |
| Booking | Online appointments |

## Out of Scope & Assumptions

- SMS reminders are out.

## Delivery Approach

Two milestones, weekly demos.

## Investment & Timeline

| Milestone | Investment |
| --- | --- |
| M1 | $6,000 – $9,000 |
| M2 | $2,000 – $3,000 |

## About Code Engine Studio

We build software. Contact: hello@example.com

## Next Steps

Valid until 2099-12-31. Reply to accept.
`;
}

const check = ({ fm = validFm(), md = fullDoc(), estimation = pricedEstimation(), today = TODAY } = {}) => (
  checkDoc({ fm, md, estimation, today })
);

test('a complete document produces no findings', () => {
  assert.deepEqual(check(), []);
});

test('sectionText slices one section and returns null for missing ones', () => {
  const md = fullDoc();
  assert.match(sectionText(md, 'Scope'), /Online appointments/);
  assert.doesNotMatch(sectionText(md, 'Scope'), /SMS reminders/);
  assert.equal(sectionText(md, 'Signature'), null);
});

test('tables groups pipe rows and drops the separator', () => {
  const [t] = tables(sectionText(fullDoc(), 'Scope'));
  assert.deepEqual(t.header, ['Feature', 'What you get']);
  assert.deepEqual(t.rows, [['Booking', 'Online appointments']]);
});

test('every missing or empty section is a finding', () => {
  const noScope = fullDoc().replace(/## Scope[\s\S]*?(?=## Out of Scope)/, '');
  assert.ok(check({ md: noScope }).some((f) => f.includes('Scope')));
  const emptyScope = fullDoc().replace('| Booking | Online appointments |\n', '')
    .replace('## Scope\n\n| Feature | What you get |\n| --- | --- |', '## Scope');
  assert.ok(check({ md: emptyScope }).some((f) => f.includes('Scope')));
});

test('frontmatter contract: missing key, bad tech level', () => {
  const noCurrency = validFm();
  delete noCurrency.currency;
  assert.ok(check({ fm: noCurrency }).some((f) => f.includes('currency')));
  assert.ok(check({ fm: { ...validFm(), client_tech_level: 'wizard' } })
    .some((f) => f.includes('client_tech_level')));
});

test('valid_until must be a future ISO date', () => {
  assert.ok(check({ fm: { ...validFm(), valid_until: '2020-01-01' } })
    .some((f) => f.includes('valid_until')));
  assert.ok(check({ fm: { ...validFm(), valid_until: 'someday' } })
    .some((f) => f.includes('valid_until')));
});

test('placeholders and empty tables are findings', () => {
  assert.ok(check({ md: fullDoc().replace('We fix scheduling for $8,000 – $12,000.', 'TBD') })
    .some((f) => /placeholder/i.test(f)));
  assert.ok(check({ md: `${fullDoc()}\n| A | B |\n| --- | --- |\n` })
    .some((f) => /empty table/i.test(f)));
});

test('Proposed Solution must carry a mermaid diagram', () => {
  const noDiagram = fullDoc().replace(/```mermaid[\s\S]*?```/, 'A drawing.');
  assert.ok(check({ md: noDiagram }).some((f) => f.includes('mermaid')));
});

test('the proposal has nine sections and no Team', () => {
  assert.equal(SECTIONS.length, 9);
  assert.ok(!SECTIONS.includes('Team'));
  assert.deepEqual(SECTIONS.slice(0, 3), ['Executive Summary', 'Background & Objectives', 'Proposed Solution']);
});

test('frontmatter no longer requires a scenario', () => {
  const fm = validFm();
  delete fm.scenario;
  const out = checkDoc({ fm, md: fullDoc(), estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(!out.some((f) => /scenario/i.test(f)), out.join('\n'));
});

test('a leftover scenario key in frontmatter is refused', () => {
  const fm = { ...validFm(), scenario: '2eng-max5x' };
  const out = checkDoc({ fm, md: fullDoc(), estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(out.some((f) => /scenario.*removed/i.test(f)), out.join('\n'));
});

test('an Investment table with a Duration column is refused', () => {
  const md = fullDoc().replace(
    '## Investment & Timeline\n\n',
    '## Investment & Timeline\n\n| Milestone | Duration | Investment |\n|---|---|---|\n| M1 | 2 months | $32,300 |\n\n',
  );
  const out = checkDoc({ fm: validFm(), md, estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(out.some((f) => /Duration column/i.test(f)), out.join('\n'));
});

test('a proposal still carrying a Team section is refused', () => {
  const md = `${fullDoc()}\n## Team\n\nTwo senior engineers.\n`;
  const out = checkDoc({ fm: validFm(), md, estimation: pricedEstimation(), today: new Date('2026-09-25') });
  assert.ok(out.some((f) => /Team section was removed/i.test(f)), out.join('\n'));
});
