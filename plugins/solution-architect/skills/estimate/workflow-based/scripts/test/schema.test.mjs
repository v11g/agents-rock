import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPair } from '../lib/requirements.mjs';
import { checkWorkflowInputs } from '../lib/schema.mjs';

const fx = fileURLToPath(new URL('./fixtures/inputs-pass.json', import.meta.url));
const load = () => loadPair(fx);
const comp = (inputs, id) => inputs.components.find((c) => c.id === id);

test('the fixture is valid', () => {
  const { inputs, req } = load();
  assert.deepEqual(checkWorkflowInputs(inputs, req), []);
});

const CASES = [
  ['W1 scopeMode', (i) => { i.scopeMode = 'classic'; }, 'scopeMode must be "workflow"'],
  ['W1 requirements not workflow', (i, r) => { r.raw.scopeMode = 'classic'; }, 'requirements: is not in workflow mode'],
  ['W2 traditional', (i) => { i.deliveryMode = 'traditional'; }, 'workflow mode is agentic + STANDARD only'],
  ['W2 DEEP', (i) => { i.depth = 'DEEP'; }, 'workflow mode is agentic + STANDARD only'],
  ['W2 agentContext', (i) => { delete i.agentContext.model; }, 'agentContext.agent and .model are required'],
  ['W3 extra feature', (i) => { i.features.push({ ...i.features[0], id: 'FEAT-009' }); }, 'feature FEAT-009: not in requirements.json'],
  ['W3 missing feature', (i) => { i.features.pop(); }, 'requirements FEAT-005: not scored'],
  ['W4 bad anchor', (i) => { i.features[0].scores.tech.anchor = 'nope'; }, 'scores.tech.anchor is not the guide'],
  ['W5 tasks on feature', (i) => { i.features[0].tasks = []; }, 'feature FEAT-001: "tasks" belongs on components in workflow mode'],
  ['W5 milestone on feature', (i) => { i.features[0].milestone = 'M1'; }, 'feature FEAT-001: "milestone" belongs on components in workflow mode'],
  ['W6 unbuilt feature', (i) => { comp(i, 'worker.drafter').builds = []; comp(i, 'worker.drafter').notEstimated = 'x'; }, 'feature FEAT-004: no component builds it'],
  ['W7 unknown feature in builds', (i) => { comp(i, 'api.billing').builds.push({ feature: 'FEAT-099', why: 'x' }); }, 'component api.billing: builds FEAT-099 unknown'],
  ['W7 missing why', (i) => { comp(i, 'api.billing').builds[0].why = ''; }, 'component api.billing: builds FEAT-005 without a why'],
  ['W8 no milestone', (i) => { delete comp(i, 'api.billing').milestone; }, 'component api.billing: builds features but has no milestone'],
  ['W8 no tasks', (i) => { comp(i, 'api.billing').tasks = []; }, 'component api.billing: builds features but has no tasks'],
  ['W8 bad task shape', (i) => { comp(i, 'api.billing').tasks[0].shape = 'magic'; }, 'task billing-match: unknown shape "magic"'],
  ['W8 orphan without reason', (i) => { delete comp(i, 'ops').notEstimated; }, 'component ops: no feature covers it'],
  ['W8 container builds', (i) => { comp(i, 'api').builds = [{ feature: 'FEAT-001', why: 'x' }]; }, 'component api: a container with components cannot build features'],
  ['W9 bad parent', (i) => { comp(i, 'api.stage').parent = 'nope'; }, 'component api.stage: parent "nope" not in roster'],
  ['W10 context missing', (i) => { delete i.contextLevels.compliance; }, 'contextLevels.compliance: must be an integer 1-4'],
  ['W10 familiarity', (i) => { i.contextLevels.stackFamiliarity = 2; i.contextProvenance.stackFamiliarity.level = 2; }, 'stackFamiliarity: level 2 needs a stated provenance'],
  ['W11 assumption source', (i) => { delete i.assumptions[0].source; }, 'assumption 0: source missing'],
  ['W3 duplicate feature', (i) => { i.features.push({ ...i.features[0] }); }, 'feature FEAT-001: duplicate id'],
  ['W7 duplicate build', (i) => { comp(i, 'api.billing').builds.push({ feature: 'FEAT-005', why: 'again' }); }, 'component api.billing: builds FEAT-005 twice'],
  ['W8 tasks on a non-building component', (i) => { comp(i, 'ops').tasks = [{ id: 'x' }]; }, 'component ops: tasks need a builds entry'],
  ['W8 tasks on a container', (i) => { comp(i, 'api').tasks = [{ id: 'x' }]; }, 'component api: tasks need a builds entry'],
  ['W8 notEstimated with builds', (i) => { comp(i, 'api.billing').notEstimated = 'x'; }, 'component api.billing: notEstimated but builds features'],
  ['components missing', (i) => { delete i.components; }, 'components roster is required in workflow mode'],
  ['W12 exclusions not a list', (i) => { i.exclusions = 'hosting'; }, 'exclusions must be a list of non-empty strings'],
  ['W12 empty exclusion', (i) => { i.exclusions = ['']; }, 'exclusions must be a list of non-empty strings'],
];

for (const [name, mutate, expected] of CASES) {
  test(`refuses: ${name}`, () => {
    const { inputs, req } = load();
    mutate(inputs, req);
    const out = checkWorkflowInputs(inputs, req);
    assert.ok(out.some((f) => f.includes(expected)), `expected a finding containing "${expected}", got:\n${out.join('\n')}`);
  });
}

test('req null → only the file finding', () => {
  const { inputs } = load();
  assert.deepEqual(checkWorkflowInputs(inputs, null), ['requirements: file not found']);
});
