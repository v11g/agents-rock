// One broken variant of the workflow pass fixture per scope rule (spec §5).
// Shared by scope-checks.test.mjs and python-parity.test.mjs.
import { readFileSync } from 'node:fs';

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
export const loadWorkflow = () => ({
  pkg: JSON.parse(fx('requirements-workflow-pass.json')),
  md: fx('requirements-workflow-pass.md'),
});

const toClassic = (pkg) => {
  for (const k of ['systems', 'features', 'scopeMode', 'mapLabel']) delete pkg[k];
};
const pkgCase = (name, finding, edit) => ({ name, finding, edit: (c) => { edit(c.pkg); return c; } });
const mdCase = (name, finding, edit) => ({ name, finding, edit: (c) => ({ ...c, md: edit(c.md) }) });

export const CASES = [
  pkgCase('illegal scopeMode', 'scopeMode must be workflow|classic', (p) => { p.scopeMode = 'list'; }),
  pkgCase('workflow without systems', 'scopeMode workflow needs systems and features', (p) => { delete p.systems; }),
  pkgCase('classic with systems', 'systems/features only in workflow mode', (p) => { p.scopeMode = 'classic'; }),
  pkgCase('bad feature id', 'features: bad id F-1', (p) => { p.features[0].id = 'F-1'; }),
  pkgCase('system lists an as-is workflow', 'SYS-001: workflow WF-001 is not a to-be workflow', (p) => { p.systems[0].workflows.push('WF-001'); }),
  pkgCase('workflow in two systems', 'WF-002: belongs to SYS-001 and SYS-002', (p) => { p.systems[1].workflows.push('WF-002'); }),
  pkgCase('feature in no system', 'FEAT-002: listed by no system', (p) => { p.systems[0].features.pop(); }),
  pkgCase('unknown feature step', 'FEAT-002: unknown step WF-002:Short-pack', (p) => { p.features[1].steps = ['WF-002:Short-pack']; }),
  pkgCase('branch from unknown step', 'WF-002: branch from unknown step Packing', (p) => { p.workflows[1].branches[0].from = 'Packing'; }),
  pkgCase('sub starts nowhere', 'WF-004: sub.startsAt unknown', (p) => { p.workflows[3].sub.startsAt = 'WF-003:Intake'; }),
  pkgCase('sub rejoins as-is', 'WF-004: sub.rejoins is not a to-be workflow', (p) => { p.workflows[3].sub.rejoins = 'WF-001'; }),
  pkgCase('replaces unknown', 'WF-002: replaces unknown as-is workflow WF-009', (p) => { p.workflows[1].replaces = ['WF-009']; }),
  pkgCase('in-scope FR in no feature', 'FR-003: in scope but in no feature', (p) => { p.features[2].requirements = []; }),
  pkgCase('feature cites missing FR', 'FEAT-003: dangling reference FR-099', (p) => { p.features[2].requirements = ['FR-003', 'FR-099']; }),
  pkgCase('duplicate feature name', 'duplicate feature name: Order intake & quotation', (p) => { p.features[1].name = 'order intake & quotation'; }),
  pkgCase('tech word in name', 'FEAT-001: name uses a tech word (API)', (p) => { p.features[0].name = 'Order APIs'; }),
  pkgCase('system without source', 'SYS-001: missing source', (p) => { delete p.systems[0].source; }),
  pkgCase('illegal feature label', 'FEAT-001: illegal label "maybe"', (p) => { p.features[0].label = 'maybe'; }),
  pkgCase('recommended without question', 'FEAT-004: recommended without a paired open question', (p) => { p.features[3].label = 'recommended'; p.openQuestions[0].affects = ['INT-001']; }),
  mdCase('frontmatter mode missing', 'md: scopeMode does not match json', (md) => md.replace('scopeMode: workflow\n', '')),
  mdCase('hand-edited scope', 'md: To-be scope is stale — run scope', (md) => md.replace('n3["Paid"]', 'n3["Settled"]')),
  { name: 'classic with scope section', finding: 'md: To-be scope only in workflow mode', edit: (c) => { toClassic(c.pkg); return c; } },
  mdCase('wrong Feature cell', 'md: FR-002 Feature column says Pack alert, json says Short-pack alert', (md) => md.replace('| in | Short-pack alert |', '| in | Pack alert |')),
  pkgCase('feature without does', 'FEAT-001: missing does', (p) => { delete p.features[0].does; }),
  pkgCase('feature without name', 'FEAT-002: missing name', (p) => { delete p.features[1].name; }),
  pkgCase('system without purpose', 'SYS-001: missing purpose', (p) => { delete p.systems[0].purpose; }),
  mdCase('unbalanced scope markers', 'md: scope markers unbalanced', (md) => md.replace('<!-- scope:end -->', '')),
  mdCase('no Feature column', 'md: FR table has no Feature column', (md) => md.replace('| Label | Scope | Feature |', '| Label | Scope |')),
];

// SYS-002 as an input that lists features but draws no workflow: the
// system owns none and its features sit on no step.
export function noFlows() {
  const { pkg, md } = loadWorkflow();
  const gone = new Set(['WF-003', 'WF-004']);
  pkg.workflows = pkg.workflows.filter((w) => !gone.has(w.id));
  pkg.systems[1].workflows = [];
  for (const f of pkg.features.slice(2, 4)) f.steps = [];
  for (const fr of pkg.requirements) if (gone.has(fr.traces?.workflow)) delete fr.traces.workflow;
  return { pkg, md };
}
