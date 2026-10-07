export const meta = {
  name: 'review-links',
  description: 'Fresh-eyes review of feature→component links and component tasks, then adversarial verify of every proposed add',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const FINDINGS = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['feature', 'action', 'component', 'why'],
        properties: {
          feature: { type: 'string' },
          action: { type: 'string', enum: ['add', 'drop', 'task'] },
          component: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
  },
}
const VERDICT = {
  type: 'object',
  required: ['verdict', 'why'],
  properties: {
    verdict: { type: 'string', enum: ['ACCEPT', 'REJECT'] },
    why: { type: 'string' },
    quoted: { type: 'string' },
  },
}

const read = `Read ${args.linking} (core rubric + task rubric), then ${args.architecture} (§6 components, §9 externals), then ${args.requirements}, then ${args.inputs}.`

phase('Review')
const review = await agent(`${read}
You are a fresh-eyes reviewer of the feature→component links (components[].builds) and the component tasks in the inputs file.
A link is right only when the feature CHANGES the component: a new rule, new data, a new kind of event, a new constraint.
Propose "add" only when you can name the change inside that component. Propose "drop" only when the linker's why describes use, not change.
Propose "task" for a task-rubric breach (component in "component", what is wrong in "why"). When unsure, leave it alone. Fewer, surer findings beat many.`, { schema: FINDINGS })

// agent() is null when the reviewer is skipped or dies: nothing to apply.
const findings = review?.findings ?? []
if (!review) log('review returned nothing; no findings to verify')

phase('Verify')
const verified = await pipeline(findings, (f) => (f.action !== 'add' ? { ...f, verdict: 'ACCEPT' }
  : agent(`Read ${args.architecture} (§6, §9) and the features in ${args.requirements}.
Proposed link: feature ${f.feature} → component "${f.component}". Proposer's why: "${f.why}".
1. Does the §6 Responsibility of this component ALREADY describe the behaviour the proposal says the feature needs? If yes → REJECT.
2. Does the feature's description ask for this work, or is it operational scope nobody asked for (monitoring, tests, docs)? If not asked → REJECT.
3. Can you name the concrete change inside this component that §6 does not already list? If yes → ACCEPT.
Quote (at most 15 words) the §6 text you relied on in "quoted".`, { schema: VERDICT, phase: 'Verify', label: `${f.feature} → ${f.component}` })
    // the proposer's why stays the link's why; the verdict travels beside it
    .then((v) => v && ({ ...f, verdict: v.verdict, verifyWhy: v.why, quoted: v.quoted }))))

log(`${findings.length} findings, ${verified.filter(Boolean).filter((f) => f.verdict === 'ACCEPT').length} confirmed`)
return verified.filter(Boolean).filter((f) => f.verdict === 'ACCEPT')
