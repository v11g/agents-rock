import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { embed } from '../../analyze-requirements/scripts/lib/embed.mjs';
import { buildFontFaces } from '../../analyze-requirements/scripts/lib/fonts.mjs';
import { escapeHtml } from '../../analyze-requirements/scripts/lib/md-inline.mjs';
import { checkDeliverables } from './lib/checks.mjs';
import { inlineModule, stripInternal, extractExports } from './lib/inline.mjs';
import { redactForClient } from './lib/redact.mjs';

// The agentic template's what-if rail only prices team/plan capacity —
// task hours are constants from the estimation data, not recomputed from
// PERT/AI-category inputs — so it needs only these exports inlined.
const AGENTIC_MATH_EXPORTS = [
  'HOURS_PER_MONTH', 'COORDINATION_TAX', 'SENIORITY_FACTOR',
  'effectiveCapacity', 'scenarioRollup',
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { args[key] = true; continue; }
    args[key] = next;
    i += 1;
  }
  return args;
}

const archFontsDir = new URL('../../analyze-requirements/assets/fonts/', import.meta.url).pathname;
const mathPath = new URL('./lib/estimate-math.mjs', import.meta.url).pathname;
const assetsDir = new URL('../assets/', import.meta.url).pathname;

const args = parseArgs(process.argv.slice(2));
const estimation = JSON.parse(readFileSync(args.json, 'utf8'));
const md = readFileSync(args.md, 'utf8');
const isAgentic = estimation.inputs.deliveryMode === 'agentic';
const templatePath = join(assetsDir, isAgentic ? 'estimate-template-agentic.html' : 'estimate-template.html');

// Validation blocks rendering: this is the hard rule enforced in code, not
// just in SKILL.md prose. No skip flag exists.
const findings = checkDeliverables({ md, estimation });
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}

const dataForEmbed = args['client-only'] ? redactForClient(estimation) : estimation;
// Companion mode: --viewer carries the caller-known path back to the analyze-requirements
// viewer. It sits in the header's internal range, so the client render (which
// must not point at an internal document set) strips it with everything else.
const viewerSlot = typeof args.viewer === 'string'
  ? `<a id="viewer-link" data-internal href="${escapeHtml(args.viewer)}">architecture docs</a>`
  : '';
const template = readFileSync(templatePath, 'utf8');
const mathSrc = readFileSync(mathPath, 'utf8');
const html = embed({
  template,
  slots: {
    TITLE: estimation.inputs.project,
    FONTS: buildFontFaces(archFontsDir),
    // Escaped so a literal </script in the JSON can't close the data tag early.
    DATA: JSON.stringify(dataForEmbed).replaceAll('</script', '<\\/script'),
    MATH: inlineModule(isAgentic ? extractExports(mathSrc, AGENTIC_MATH_EXPORTS) : mathSrc),
    VIEWER: viewerSlot,
  },
});

const finalHtml = args['client-only']
  ? stripInternal(html).replace('<body', '<body class="view-client"')
  : html;

const outPath = join(args.out, 'estimate.html');
writeFileSync(outPath, finalHtml);
console.log(outPath);
