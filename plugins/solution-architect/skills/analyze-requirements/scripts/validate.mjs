import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildInputs } from './lib/inputs.mjs';
import { validateProvenance } from './lib/validate-provenance.mjs';
import { validateElections } from './lib/validate-elections.mjs';
import { validateModelTables } from './lib/validate-model-tables.mjs';
import { validateDeployment } from './lib/validate-deployment.mjs';
import { validateLinks } from './lib/validate-links.mjs';
import { validateTree } from './lib/validate-tree.mjs';
import { validateClusters } from './lib/validate-clusters.mjs';
import { validateStrategy } from './lib/validate-strategy.mjs';

function consumeDocs(argv, i, docs) {
  while (argv[i + 1] && !argv[i + 1].startsWith('--')) docs.push(argv[++i]);
  return i;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), docs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--docs') {
      i = consumeDocs(argv, i, args.docs);
    } else if (flag.startsWith('--')) {
      args[flag.slice(2)] = argv[++i];
    }
  }
  return args;
}

function boundaryRows(tables) {
  const t = tables.find((x) => x.section.includes('Project Structure'));
  return (t?.rows ?? []).map((r) => r[0]);
}

function componentRows(tables) {
  const t = tables.find((x) => x.section.includes('Core Components'));
  const col = (t?.headers ?? []).findIndex((h) => /key paths/i.test(h));
  return (t?.rows ?? []).map((r) => ({
    name: r[0].replace(/\[([^\]]*)\]\([^)]*\)/, '$1'),
    keyPaths: col === -1 ? [] : r[col].split(',').map((p) => p.trim()),
  }));
}

function listDirs(dir, hidden = false) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (hidden || !e.name.startsWith('.')) && e.name !== 'node_modules')
    .map((e) => e.name);
}

function walkDirs(root, hidden = false) {
  const top = listDirs(root, hidden);
  return top.flatMap((d) => [d, ...listDirs(join(root, d), hidden).map((c) => `${d}/${c}`)]);
}

function brownfieldFindings({ inputs, args, root }) {
  const clusters = args.clusters ? JSON.parse(readFileSync(args.clusters, 'utf8')) : [];
  return [
    ...validateTree({
      boundaryRows: boundaryRows(inputs.tables),
      fsDirs: walkDirs(root),
      allDirs: walkDirs(root, true),
    }),
    ...validateClusters({ clusters, componentRows: componentRows(inputs.tables), storeNames: inputs.erNames }),
  ];
}

const args = parseArgs(process.argv.slice(2));
const root = args.root;

const inputs = await buildInputs({
  root,
  archPath: args.arch,
  modelPath: args.model,
  docPaths: args.docs,
});

const findings = [
  ...validateProvenance({ tables: inputs.tables }),
  ...validateStrategy({ tables: inputs.tables, archMd: inputs.archMd }),
  ...validateElections({ frontmatter: inputs.frontmatter }),
  ...validateModelTables({ model: inputs.model, tables: inputs.tables, erNames: inputs.erNames }),
  ...validateDeployment({ model: inputs.model }),
  ...validateLinks({ links: inputs.links, files: inputs.files, anchors: inputs.anchors }),
  ...(args.mode === 'brownfield' ? brownfieldFindings({ inputs, args, root }) : []),
];

// A warn finding marks a set written before a rule existed: printed so the
// next rewrite fixes it, never blocking — rule 4 makes validation gate rendering.
const fails = findings.filter((f) => f.level !== 'warn');
for (const f of findings.filter((x) => x.level === 'warn')) console.log(`WARN [${f.check}] ${f.message}`);
for (const f of fails) console.log(`FAIL [${f.check}] ${f.message}`);
if (!fails.length) console.log('ok all checks passed');
process.exit(fails.length ? 1 : 0);
