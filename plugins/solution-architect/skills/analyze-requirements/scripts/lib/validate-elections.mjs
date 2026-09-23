const COMPANIONS = ['threat-model', 'interface-contract', 'estimation', 'domain-overview',
  'validation-plan'];

export function validateElections({ frontmatter }) {
  const docs = frontmatter.electedDocs;
  if (!Array.isArray(docs)) {
    return [{ check: 'elections', message: 'frontmatter electedDocs missing or not a list' }];
  }
  return COMPANIONS.flatMap((name) => checkOne(name, docs.find((d) => d.name === name)));
}

function checkOne(name, entry) {
  if (!entry) return [{ check: 'elections', message: `no election record for ${name}` }];
  if (typeof entry.elected !== 'boolean') {
    return [{ check: 'elections', message: `${name}: elected must be true or false` }];
  }
  if (!entry.elected && !entry.reason) {
    return [{ check: 'elections', message: `${name}: not elected but no reason recorded` }];
  }
  return [];
}
