// Review-state fixtures built from the workflow pass pair, so no reviewed
// JSON is committed that could drift from the pass fixture.
import { loadWorkflow } from './scope-cases.mjs';

export const DATE = '2026-10-07';

// The pass package once the interview settled it: one feature and one
// assumption added by the PO.
export function decided() {
  const { pkg } = loadWorkflow();
  Object.assign(pkg.features[3], { label: 'confirmed', source: `PO in interview, ${DATE}` });
  pkg.assumptions.push({
    id: 'ASM-002', text: 'Offline scan gaps last under 1 hour; longer outages are a change request.',
    impact: 'low', status: 'accepted', source: `PO in interview, ${DATE}`,
  });
  return pkg;
}

// A 0.3.x package being re-run: the BA drafted "Order to cash" and the
// invoice feature, each paired with an open question. Valid, not decided.
export function drafted() {
  const { pkg } = loadWorkflow();
  const was = { label: 'recommended', source: 'drafted from PO brief, System 2' };
  Object.assign(pkg.workflows[2], was);
  Object.assign(pkg.features[3], was);
  pkg.openQuestions.push({
    id: 'Q-002', question: 'Is order to cash the right shape: quote before the order is confirmed?',
    priority: 'P1', reason: 'the workflow was drafted, not described by the client',
    affects: ['WF-003'], status: 'open', answer: null, architectureBlocker: false,
  });
  return pkg;
}
