import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildInputs } from '../lib/inputs.mjs';
import { validateLinks } from '../lib/validate-links.mjs';

const dir = new URL('./fixtures/docs-pass/', import.meta.url).pathname;

async function anchorInputs(archMd) {
  const scratch = mkdtempSync(join(tmpdir(), 'analyze-requirements-inputs-'));
  const archPath = join(scratch, 'ARCHITECTURE.md');
  const modelPath = join(scratch, 'model.json');
  writeFileSync(archPath, archMd);
  writeFileSync(modelPath, JSON.stringify({ elements: [], relationships: [] }));
  return buildInputs({ root: scratch, archPath, modelPath });
}

test('buildInputs assembles root-relative validator inputs', async () => {
  const inputs = await buildInputs({
    root: dir,
    archPath: `${dir}ARCHITECTURE.md`,
    modelPath: `${dir}model.json`,
    docPaths: [`${dir}docs/adr/0001-sample.md`],
  });
  assert.ok(inputs.frontmatter.electedDocs);
  assert.ok(inputs.tables.length >= 3);
  assert.ok(inputs.model.elements.length > 0);
  assert.deepEqual(inputs.files.sort(), ['ARCHITECTURE.md', 'docs/adr/0001-sample.md']);
  assert.ok(inputs.anchors['ARCHITECTURE.md'].includes('core-components'));
  assert.ok(inputs.links.some((l) => l.fromDoc === 'ARCHITECTURE.md' && l.href === 'docs/adr/0001-sample.md'));
});

test('CLI exits 0 on the passing fixture', () => {
  const out = execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs',
    '--root', dir,
    '--arch', `${dir}ARCHITECTURE.md`, '--model', `${dir}model.json`,
    '--docs', `${dir}docs/adr/0001-sample.md`,
  ]).toString();
  assert.match(out, /all checks passed/);
});

test('CLI exits 1 when a check fails', () => {
  assert.throws(() => execFileSync('node', [
    'plugins/solution-architect/skills/analyze-requirements/scripts/validate.mjs',
    '--root', dir,
    '--arch', `${dir}ARCHITECTURE.md`, '--model', `${dir}model-broken.json`,
    '--docs', `${dir}docs/adr/0001-sample.md`,
  ]));
});

// The anchor universe validate-links checks must mirror what the renderer actually
// gives an id: h2/h3 only, deduped per doc with the same -N suffix rule. Cross-doc
// id collisions are a viewer-side concern (D6, out of scope) so dedupe here is
// scoped per doc, matching how buildInputs computes anchors one doc at a time.
test('anchors collect only h2/h3 slugs, deduped per doc like the renderer', async () => {
  const inputs = await anchorInputs('# Title\n\n## Consequences\n\n#### Deep\n\n## Consequences\n');
  assert.deepEqual(inputs.anchors['ARCHITECTURE.md'], ['consequences', 'consequences-2']);
});

test('rejects a link to an h1 anchor: the renderer never gives h1 an id', async () => {
  const inputs = await anchorInputs('# Title\n\n[bad](#title)\n');
  assert.equal(validateLinks(inputs).length, 1);
});

test('accepts a link to a deduped -2 anchor matching the renderer', async () => {
  const inputs = await anchorInputs('## Consequences\n\n## Consequences\n\n[ok](#consequences-2)\n');
  assert.deepEqual(validateLinks(inputs), []);
});

// md-render skips fenced code and frontmatter; the validator must count the same
// headings, or `#setup-2` passes the check and lands nowhere in the viewer.
test('a heading inside a code fence or frontmatter is not an anchor', async () => {
  const inputs = await anchorInputs('---\n## hidden\ntitle: x\n---\n## Setup\n\n```\n## Setup\n```\n\n## Setup\n');
  assert.deepEqual(inputs.anchors['ARCHITECTURE.md'], ['setup', 'setup-2']);
});
