export const meta = {
  name: 'arch-docs-extract',
  description: 'One agent per client input file: facts backed by exact quotes',
  phases: [{ title: 'Extract', detail: 'one agent per input file' }],
}

const FACTS = { type: 'object', required: ['facts'], properties: { facts: { type: 'array', items: {
  type: 'object', required: ['fact', 'quote', 'section'],
  properties: { fact: { type: 'string' }, quote: { type: 'string' }, section: { type: 'string' } },
} } } }

// The spine sections a client input can speak to; the agent hunts each one so
// a fact is missed by omission less often (references/extract.md).
const CHECKLIST = [
  'goals and scope',
  'users and actors',
  'constraints: budget, deadline, mandated tech, compliance',
  'quality: speed, load spikes, uptime, data loss, reliability, security, running cost',
  'external systems and integrations',
  'data and its sensitivity',
  'deployment and hosting',
]

const RULES = 'Read the file with the Read tool. Every fact carries a quote copied character for character from the file: no rewording, no joining separate sentences, no fixing typos. A fact you cannot quote is left out. Small talk is left out.'

function promptFor(file) {
  const head = `${RULES}\nFile: ${file.path}\n`
  if (file.fix) return `${head}These quotes were not found in the file. For each, return the fact again with a quote copied exactly from the file, or leave it out:\n${JSON.stringify(file.fix)}`
  if (args.question) return `${head}Answer only this: ${args.question}`
  return `${head}Work through each topic and return every fact the file states about it, with section set to the topic:\n- ${CHECKLIST.join('\n- ')}`
}

const dropped = []
const tag = (file) => (r) => {
  if (r) return r.facts.map((f) => ({ ...f, src: file.id, date: file.date, path: file.path }))
  dropped.push({ item: file.id, reason: 'agent returned nothing' })
  log(`DROPPED ${file.id}: agent returned nothing`)
  return []
}

phase('Extract')
const facts = (await parallel(args.files.map((file) => () =>
  agent(promptFor(file), { label: `extract-${file.id}`, phase: 'Extract', schema: FACTS }).then(tag(file))
))).flat()

log(`extract done: ${facts.length} facts from ${args.files.length} files, ${dropped.length} dropped`)
return { facts, dropped }
