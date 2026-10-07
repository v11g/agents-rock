import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadRequirements, loadPair, resolveRequirementsPath, featureProvenance } from '../lib/requirements.mjs';

const fx = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('loadRequirements indexes features, systems and workflows by id', () => {
  const req = loadRequirements(fx('requirements.json'));
  assert.equal(req.project, 'sin-kowa-mini');
  assert.equal(req.features['FEAT-001'].name, 'Order pipeline & stage engine');
  assert.equal(req.systemOf['FEAT-004'], 'SYS-002');
  assert.equal(req.systemById['SYS-002'].name, 'Orders & invoicing');
  assert.deepEqual(req.workflows['WF-002'].steps, ['Order In', 'Pack', 'Pack Review', 'Shipped']);
});

test('resolveRequirementsPath is relative to the inputs file', () => {
  assert.equal(resolveRequirementsPath('/leads/x/estimation-inputs.json', { requirements: '../requirements.json' }), '/leads/requirements.json');
  assert.equal(resolveRequirementsPath('/leads/x/estimation-inputs.json', {}), null);
});

test('loadPair returns req null when the file is missing', () => {
  const { inputs, req } = loadPair(fx('inputs-pass.json'));
  assert.equal(inputs.scopeMode, 'workflow');
  assert.equal(req.raw.scopeMode, 'workflow');
  assert.equal(loadPair(fx('requirements.json')).req, null);
});

test('featureProvenance: confirmed → stated, anything else → proposed', () => {
  assert.equal(featureProvenance({ label: 'confirmed' }), 'stated');
  assert.equal(featureProvenance({ label: 'recommended' }), 'proposed');
  assert.equal(featureProvenance({}), 'proposed');
});
