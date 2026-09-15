// The --client-only export embeds the full estimation JSON in the page; this
// strips the internal money detail (rates, labor/tooling cost split, per-task
// hours per scenario) before it ships, unless the inputs opt out via
// exposeRatesToClient. Assumptions/risks are left alone — those are
// client-facing per spec.
//
// Agentic-only fields are stripped unconditionally (not gated on
// exposeRatesToClient, which is a pricing-transparency opt-out, not a
// privacy one): the local measurements dataset path (absolute, carries the
// operator's username), the operator's repository name, and evidence task
// descriptions (the global measurements store can carry other projects'
// task descriptions). These fields don't exist in team-mode estimations, so
// team-mode output is unaffected.
function redactScenarioTeam(team) {
  return team.map(({ rate, ...rest }) => rest);
}

function redactComputedScenarios(scenarios) {
  return Object.fromEntries(Object.entries(scenarios).map(([id, s]) => {
    const { laborCost, toolingCost, taskHours, ...rest } = s;
    return [id, rest];
  }));
}

function redactAgenticInputs({ measurementsPath, agentContext, ...rest }) {
  if (!agentContext) return rest;
  const { repository, ...clientAgentContext } = agentContext;
  return { ...rest, agentContext: clientAgentContext };
}

// A score's cite is internal shorthand — the ticket phrase, file name or
// meeting wording the judgment rests on — so it is blanked unconditionally,
// like the agentic fields above. The rubric anchor is the sentence the client
// can read and it stays, so the page still explains every score.
function blankCites(feature) {
  if (!feature.scores) return feature;
  const scores = Object.entries(feature.scores).map(([k, s]) => [k, { ...s, cite: '' }]);
  return { ...feature, scores: Object.fromEntries(scores) };
}

function redactComputedTasks(tasks) {
  return Object.fromEntries(Object.entries(tasks).map(([id, t]) => [
    id,
    t.evidence ? { ...t, evidence: t.evidence.map(({ description, ...rest }) => rest) } : t,
  ]));
}

export function redactForClient(estimation) {
  const agentic = redactAgenticInputs(estimation.inputs);
  const inputs = { ...agentic, features: agentic.features.map(blankCites) };
  const computed = { ...estimation.computed, tasks: redactComputedTasks(estimation.computed.tasks) };
  if (estimation.inputs.exposeRatesToClient) return { ...estimation, inputs, computed };
  return {
    ...estimation,
    inputs: {
      ...inputs,
      scenarios: inputs.scenarios.map((s) => ({ ...s, team: redactScenarioTeam(s.team) })),
    },
    computed: {
      ...computed,
      scenarios: redactComputedScenarios(computed.scenarios),
    },
  };
}
