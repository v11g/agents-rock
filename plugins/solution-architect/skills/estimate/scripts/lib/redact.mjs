// The --client-only export embeds the full estimation JSON in the page; this
// strips the pricing build-up before it ships, unless the inputs opt out via
// exposeRatesToClient. Stripped, from computed.price: featurePoints (the
// summed feature-price subtotal), contextMultiplier and adjustedBase (the
// multiplier and the base it scales — adjustedBase = featurePoints ×
// contextMultiplier, so both factors have to go for either to be hidden),
// and overheads (the line items and their total). Stripped, per feature in
// computed.features: tier, point, priceLow and priceHigh — the score band
// and the price it bought.
//
// Deliberately kept, and not a gap: presentLow, presentHigh, singleNumber,
// contingencyRate and impliedAccuracy are what the client is quoted, always.
// p50, sigma, p20, p80, p95 also stay — presentLow/presentHigh are just
// ceil(p50)/ceil(p95) rounded to the nearest 500, so those two are the
// unrounded form of a number the client already has, not hidden working, and
// sigma is recoverable from the percentiles regardless of whether it ships.
// Per-feature spread and flag stay too: spread yields no price once tier,
// point, priceLow and priceHigh are gone. Assumptions, risks, component names
// and the scores a feature was judged on are client-facing per spec.
//
// Agentic-only fields are stripped unconditionally (not gated on
// exposeRatesToClient, which is a pricing-transparency opt-out, not a
// privacy one): the local measurements dataset path (absolute, carries the
// operator's username), the operator's repository name, and evidence task
// descriptions (the global measurements store can carry other projects'
// task descriptions). These fields don't exist in team-mode estimations, so
// team-mode output is unaffected.
//
// recommendedReason is stripped unconditionally too, for the same reason as
// a score's cite: it is free text an internal agent writes under a contract
// (references/writing.md) that never warns it the sentence reaches the
// client. The client receives the file, not a rendered view, so hiding the
// node from the DOM is not enough — the key is removed from the JSON, the
// same way measurementsPath/repository/evidence descriptions are (R48).
const PRICE_WORKING = ['contextMultiplier', 'adjustedBase', 'overheads', 'featurePoints'];
const FEATURE_WORKING = ['tier', 'point', 'priceLow', 'priceHigh'];

const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

function redactComputedFeatures(features) {
  return Object.fromEntries(Object.entries(features).map(([id, f]) => [id, omit(f, FEATURE_WORKING)]));
}

function redactAgenticInputs({ measurementsPath, agentContext, ...rest }) {
  if (!agentContext) return rest;
  const { repository, ...clientAgentContext } = agentContext;
  return { ...rest, agentContext: clientAgentContext };
}

function redactRecommendedReason({ recommendedReason, ...rest }) {
  return rest;
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
  const agentic = redactRecommendedReason(redactAgenticInputs(estimation.inputs));
  const inputs = { ...agentic, features: agentic.features.map(blankCites) };
  const computed = { ...estimation.computed, tasks: redactComputedTasks(estimation.computed.tasks) };
  if (estimation.inputs.exposeRatesToClient) return { ...estimation, inputs, computed };
  return {
    ...estimation,
    inputs,
    computed: {
      ...computed,
      features: redactComputedFeatures(computed.features),
      price: omit(computed.price, PRICE_WORKING),
    },
  };
}
