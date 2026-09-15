import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkProposal } from '../lib/checks.mjs';
import { JARGON } from '../lib/jargon.mjs';

// Same synthetic estimation as figures.test.mjs: figures are
// cost 8000/12000, months 1.6/2.4, M1 6000/9000 1.2/1.8, M2 2000/3000 0.4/0.6.
const estimation = {
  inputs: {
    scenarios: [
      { id: 's1', aiAssisted: true, toolingCostPerSeat: 100, team: [{ seniority: 'senior', rate: 50 }] },
      { id: 's2-secret', aiAssisted: false, toolingCostPerSeat: null, team: [{ seniority: 'mid', rate: 40 }] },
    ],
  },
  computed: {
    features: { a: { hours: 100, low: 80, high: 120 }, b: { hours: 100, low: 80, high: 120 } },
    scenarios: {
      s1: {
        months: 2, totalCost: 10000,
        roadmap: [
          { name: 'M1', startMonths: 0, endMonths: 1.5 },
          { name: 'M2', startMonths: 1.5, endMonths: 2 },
        ],
      },
      's2-secret': { months: 3, totalCost: 15000 },
    },
  },
};
const TODAY = new Date('2026-08-06');

const md = `---
client: Acme Corp
client_tech_level: non-tech
scenario: s1
currency: USD
valid_until: 2099-12-31
source_architecture: ../ARCHITECTURE.md
source_estimation: ../estimation.json
---

## Executive Summary
New booking system for $8,000 – $12,000, delivered in 1.6–2.4 months.
## Background & Objectives
Bookings are manual today.
## Proposed Solution
\`\`\`mermaid
graph LR; A[Your customers] --> B[New system]
\`\`\`
## Scope
| Feature | What you get |
| --- | --- |
| Booking | Online appointments |
## Out of Scope & Assumptions
- Text-message reminders are out.
## Delivery Approach
M1 runs 1.2–1.8 months; M2 runs 0.4–0.6 months. Weekly demos.
## Investment & Timeline
| Milestone | Duration | Investment |
| --- | --- | --- |
| M1 | 1.2–1.8 months | $6,000 – $9,000 |
| M2 | 0.4–0.6 months | $2,000 – $3,000 |

Total: $8,000 – $12,000 over 1.6–2.4 months.
## Team
One senior engineer.
## About Code Engine Studio
We build software. Contact: hello@example.com
## Next Steps
Valid until 2099-12-31. Reply to accept.
`;

const run = (doc) => checkProposal({ md: doc, estimation, today: TODAY });

test('a document whose numbers all trace to the figures passes', () => {
  assert.deepEqual(run(md), []);
});

test('an invented money amount is a finding', () => {
  assert.ok(run(md.replace('$6,000', '$6,500')).some((f) => f.includes('6,500') || f.includes('6500')));
});

test('an invented duration bound is a finding', () => {
  assert.ok(run(md.replace('1.6–2.4 months.\n## Team', '1.6–9.9 months.\n## Team'))
    .some((f) => f.includes('9.9')));
});

test('the headline cost range must be present', () => {
  const noTotals = md.replaceAll('$8,000 – $12,000', 'a fair price').replaceAll('1.6–2.4 months', 'a short time');
  const findings = run(noTotals);
  assert.ok(findings.some((f) => f.includes('8,000')));
  assert.ok(findings.some((f) => f.includes('2.4')));
});

test('a lone invented duration is a finding', () => {
  assert.ok(run(md.replace('Weekly demos.', 'Live within 9 months.')).some((f) => f.includes('9')));
});

test('headline ranges must live in the Executive Summary itself', () => {
  const buried = md.replace('New booking system for $8,000 – $12,000, delivered in 1.6–2.4 months.', 'A fair price, fast.');
  const findings = run(buried);
  assert.ok(findings.some((f) => /Executive Summary/.test(f)));
});

test('other scenario ids and provenance markup are leaks', () => {
  assert.ok(run(md.replace('Weekly demos.', 'Cheaper than s2-secret.')).some((f) => f.includes('s2-secret')));
  assert.ok(run(md.replace('| Feature | What you get |', '| Feature | src |')).some((f) => f.includes('src')));
  assert.ok(run(md.replace('Weekly demos.', '| observed |')).some((f) => f.includes('observed')));
});

test('stated and proposed provenance cells are leaks too', () => {
  assert.ok(run(md.replace('Weekly demos.', '| proposed |')).some((f) => f.includes('proposed')));
});

test('non-tech jargon fails, jargon_allow overrides per term', () => {
  const jargony = md.replace('Weekly demos.', 'We deploy the API to Kubernetes.');
  const findings = run(jargony);
  assert.ok(findings.some((f) => /kubernetes/i.test(f)));
  assert.ok(findings.some((f) => /\bapi\b/i.test(f)));
  const allowed = jargony.replace('valid_until: 2099-12-31', 'valid_until: 2099-12-31\njargon_allow: ["api", "kubernetes"]');
  assert.deepEqual(run(allowed), []);
});

test('technical clients skip the jargon scan; the About section is exempt', () => {
  const techDoc = md.replace('client_tech_level: non-tech', 'client_tech_level: technical')
    .replace('Weekly demos.', 'We deploy the API to Kubernetes.');
  assert.deepEqual(run(techDoc), []);
  const aboutJargon = md.replace('We build software.', 'We build software and Kubernetes platforms.');
  assert.deepEqual(run(aboutJargon), []);
});

test('plural jargon is still jargon', () => {
  const plural = md.replace('Weekly demos.', 'We expose several endpoints.');
  assert.ok(run(plural).some((f) => /endpoint/i.test(f)));
});

test('the deny-list is lowercase and non-trivial', () => {
  assert.ok(JARGON.length >= 12);
  for (const term of JARGON) assert.equal(term, term.toLowerCase());
});

test('a document with no frontmatter is a finding, not a crash', () => {
  assert.deepEqual(checkProposal({ md: '## Executive Summary\nHi.', estimation, today: TODAY }),
    ['frontmatter: no frontmatter block']);
});
