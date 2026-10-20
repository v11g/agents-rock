import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../workflows/extract.js', import.meta.url), 'utf8')
  .replace(/^export const meta =/m, 'const meta =');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

function run({ agentImpl, args }) {
  const calls = { prompts: [], logs: [] };
  const agent = (p, o) => { calls.prompts.push(p); return agentImpl(p, o); };
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', src);
  const parallel = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)));
  return fn(agent, parallel, null, () => {}, (m) => calls.logs.push(m), args,
    { total: null, spent: () => 0, remaining: () => Infinity }).then((result) => ({ result, calls }));
}

const FILES = [
  { id: 'C1', path: '/set/inputs/C1-kickoff-call.txt', date: '2026-09-10' },
  { id: 'E1', path: '/set/inputs/E1-intro-email.md', date: '2026-09-08' },
];
const okAgent = async () => ({ facts: [{ fact: 'runs on Azure', quote: 'it has to run there', section: 'deployment and hosting' }] });

test('one agent per file; facts tagged with the file id, date and path', async () => {
  const { result, calls } = await run({ agentImpl: okAgent, args: { files: FILES } });
  assert.equal(calls.prompts.length, 2);
  assert.deepEqual(result.facts.map((f) => [f.src, f.date, f.path]), [
    ['C1', '2026-09-10', '/set/inputs/C1-kickoff-call.txt'],
    ['E1', '2026-09-08', '/set/inputs/E1-intro-email.md'],
  ]);
});

test('default prompt names the file, the exact-quote rule and the checklist', async () => {
  const { calls } = await run({ agentImpl: okAgent, args: { files: [FILES[0]] } });
  assert.match(calls.prompts[0], /\/set\/inputs\/C1-kickoff-call\.txt/);
  assert.match(calls.prompts[0], /character for character/);
  assert.match(calls.prompts[0], /deployment and hosting/);
});

test('question mode asks only the question', async () => {
  const { calls } = await run({ agentImpl: okAgent, args: { files: [FILES[0]], question: 'what about hosting?' } });
  assert.match(calls.prompts[0], /Answer only this: what about hosting\?/);
  assert.doesNotMatch(calls.prompts[0], /users and actors/);
});

test('fix mode hands back the missed quotes', async () => {
  const fix = [{ fact: 'Azure', quote: 'it must run on Azure', closest: 'We pay for Azure already' }];
  const { calls } = await run({ agentImpl: okAgent, args: { files: [{ ...FILES[0], fix }] } });
  assert.match(calls.prompts[0], /it must run on Azure/);
  assert.match(calls.prompts[0], /not found in the file/);
});

test('a failed agent lands in dropped; other files still return facts', async () => {
  const flaky = async (p) => (p.includes('E1-intro') ? null : okAgent());
  const { result, calls } = await run({ agentImpl: flaky, args: { files: FILES } });
  assert.deepEqual(result.dropped, [{ item: 'E1', reason: 'agent returned nothing' }]);
  assert.equal(result.facts.length, 1);
  assert.ok(calls.logs.some((l) => l.includes('DROPPED E1')));
});

test('a BA package file gets the confirmed-only rule; other files do not', async () => {
  const files = [
    { id: 'D1', path: '/set/requirements.md', date: '2026-10-01', ba: true },
    { id: 'C1', path: '/set/inputs/C1-kickoff-call.txt', date: '2026-09-10' },
  ];
  const { calls } = await run({ agentImpl: okAgent, args: { files } });
  assert.match(calls.prompts[0], /only rows labelled confirmed/);
  assert.doesNotMatch(calls.prompts[1], /labelled confirmed/);
});
