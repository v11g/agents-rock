import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkClient } from '../lib/checks-client.mjs';
import { checkProposal } from '../lib/checks.mjs';
import { parseFrontmatter } from '../../../analyze-requirements/scripts/lib/frontmatter.mjs';
import { JARGON } from '../lib/jargon.mjs';

// Synthetic estimation in the new price/roadmap shape (same as
// figures.test.mjs): figures are cost 8000/12000, singleNumber 10000,
// M1 6000/9000, M2 2000/3000.
const estimation = {
  inputs: { features: [] },
  computed: {
    price: { presentLow: 8000, presentHigh: 12000, singleNumber: 10000, p50: 7998 },
    roadmap: [
      { milestone: 'M1', features: ['a'], share: 0.75 },
      { milestone: 'M2', features: ['b'], share: 0.25 },
    ],
  },
};

const md = `---
client: Acme Corp
client_tech_level: non-tech
currency: USD
valid_until: 2099-12-31
source_architecture: ../ARCHITECTURE.md
source_estimation: ../estimation.json
---

## Executive Summary
New booking system for $8,000 – $12,000.
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
M1 covers booking; M2 covers notifications. Weekly demos.
## Investment & Timeline
| Milestone | Investment |
| --- | --- |
| M1 | $6,000 – $9,000 |
| M2 | $2,000 – $3,000 |

Total: $8,000 – $12,000.
## About Code Engine Studio
We build software. Contact: hello@example.com
## Next Steps
Valid until 2099-12-31. Reply to accept.
`;

// checkClient takes already-parsed frontmatter — parse fresh for each
// variant so tests that edit the frontmatter block (jargon_allow, tech
// level) see their own change.
const run = (doc) => {
  const { data: fm } = parseFrontmatter(doc);
  return checkClient({ md: doc, fm, estimation }, []);
};

test('a document whose numbers all trace to the figures passes', () => {
  assert.deepEqual(run(md), []);
});

test('an invented money amount is a finding', () => {
  assert.ok(run(md.replace('$6,000', '$6,500')).some((f) => f.includes('6,500') || f.includes('6500')));
});

test('the headline cost range must be present', () => {
  const noTotals = md.replace('New booking system for $8,000 – $12,000.', 'A fair price for a new booking system.');
  const findings = run(noTotals);
  assert.ok(findings.some((f) => f.includes('8,000')));
  assert.ok(findings.some((f) => f.includes('12,000')));
});

test('headline ranges must live in the Executive Summary itself', () => {
  const buried = md.replace('New booking system for $8,000 – $12,000.', 'A fair price, fast.');
  const findings = run(buried);
  assert.ok(findings.some((f) => /Executive Summary/.test(f)));
});

test('provenance markup is a leak', () => {
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

// This one is about the whole pipeline's crash-safety on a document with no
// frontmatter at all, not about client-safety specifically — checkProposal
// returns early before ever touching estimation shape, so it stays safe
// regardless of the scenario-vs-price schema.
test('a document with no frontmatter is a finding, not a crash', () => {
  assert.deepEqual(checkProposal({ md: '## Executive Summary\nHi.', estimation, today: new Date('2026-08-06') }),
    ['frontmatter: no frontmatter block']);
});

// R55/load-bearing: checkProposal must run the client-safety checks itself —
// frontmatter no longer carries a scenario key to gate on, so checkClient
// has to run whenever the estimate is priced. Break the gate in checks.mjs
// (e.g. restore the old `fm.scenario && estimation.computed.scenarios[...]`
// condition) and this test goes red because the invented figure below is
// never caught.
test('checkProposal refuses an invented money figure through the pipeline', () => {
  const invented = md.replace(
    'New booking system for $8,000 – $12,000.',
    'New booking system for $8,000 – $12,000, plus a $6,500 setup fee.',
  );
  const findings = checkProposal({ md: invented, estimation, today: new Date('2026-08-06') });
  assert.ok(findings.some((f) => f.includes('6,500')), findings.join('\n'));
});
