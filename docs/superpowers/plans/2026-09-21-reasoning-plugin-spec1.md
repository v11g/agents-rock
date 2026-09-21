# Reasoning Plugin (Spec 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `plugins/reasoning/` with two skills — `problem-router` (classifies a problem and recommends a reasoning path) and `problem-solving` (runs one of five frameworks to a testable next step) — sharing one output contract, gated by a parity test and a ten-case eval suite.

**Architecture:** One plugin, N skills, matching `solution-architect`. Each skill is prose (`SKILL.md` plus `references/` and `frameworks/` files) because the deliverable is agent behaviour, not code. The only executable artifact is a Node test asserting the duplicated contract file stays byte-identical across skills. Behaviour is verified by `claude plugin eval`, using predominantly negative assertions — the claim under test is that these skills *avoid* failure modes, so the tests check what must not appear.

**Tech Stack:** Markdown skills for Claude Code; `node:test` + `node:assert/strict` (Node ≥ 18.3, already the repo floor); `claude plugin eval` for behavioural evals; existing `bundle.sh` and `src/cli/install.mjs` for packaging.

**Spec:** `docs/superpowers/specs/2026-09-21-reasoning-plugin-design.md`

## Global Constraints

- Plugin name `reasoning`, version `0.1.0`, category `documentation`, author `Truong Vu <vukhanhtruong@gmail.com>` — matching every other entry in `.claude-plugin/marketplace.json`.
- Skill prose addresses the executing agent, never a named model: "You are executing the problem-solving skill", never "Because you are Claude" (spec, *Neutrality convention*).
- Harness tools are named as bindings, never as the behaviour: write *present the candidate frameworks with a recommendation and let the human choose*, then note that Claude Code does this with `AskUserQuestion`.
- Confidence is rendered `low` / `medium` / `high` in all output. Numeric confidence is never emitted.
- Every run emits the six core contract fields plus exactly one framework block. No other top-level fields.
- `references/contract.md` is byte-identical in every skill under `plugins/reasoning/`. Edit one, copy to all, or the parity test fails.
- No JSON schema files and no validation script ship in spec 1.
- No reference to the `business-analyst` plugin anywhere in `plugins/reasoning/`. The two are independent by decision.
- Eval cases live at `plugins/reasoning/evals/<case-name>/` — the PLUGIN root, never under `skills/<skill>/`. `claude plugin eval` resolves the eval dir per plugin (`--eval-dir` > manifest `experimental.evals` > `evals/`) and warns when the eval dir overlaps a declared component location, which `skills/<skill>/evals/` would. Plugin-root `evals/` is never copied to users, because `copyCanonical` copies only skill directories.
- The eval gate is per-case SCORE >= 0.85 at `--runs 3`, not a perfect pass rate. Skill behaviour is non-deterministic prose: two consecutive full-suite runs on identical files produced 3 red and then 0 red, so a single run decides nothing and a 1.0 threshold measures sampling luck. Every gate invocation carries `--runs 3 --ablation none --threshold 0.85 --trust-plugin --no-publish`. `--no-publish` is mandatory: the CLI publishes an HTML report to claude.ai by default.
- README lives per skill (`skills/<name>/README.md`), matching all three existing plugins. The spec's plugin-root README is dropped.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `plugins/reasoning/.claude-plugin/plugin.json` | plugin manifest |
| `.claude-plugin/marketplace.json` | registry entry (modify) |
| `plugins/reasoning/skills/problem-router/SKILL.md` | classify → recommend → human confirms |
| `plugins/reasoning/skills/problem-router/README.md` | human-facing summary |
| `plugins/reasoning/skills/problem-router/references/contract.md` | output contract (canonical copy) |
| `plugins/reasoning/evals/<case>/prompt.md` | one eval case each, 6 routing + 4 guardrail |
| `plugins/reasoning/evals/<case>/graders/*.md` | graders per case (`llm` / `regex`) |
| `plugins/reasoning/evals/<case>/case.yaml` | only for cases mounting a fixture (`context.add_dirs`) |
| `plugins/reasoning/skills/problem-solving/SKILL.md` | select framework → run → stop |
| `plugins/reasoning/skills/problem-solving/README.md` | human-facing summary |
| `plugins/reasoning/skills/problem-solving/references/contract.md` | output contract (identical copy) |
| `plugins/reasoning/skills/problem-solving/frameworks/*.md` | one file per framework, 5 files |
| `tests/contract-parity.test.mjs` | asserts contract copies do not drift |

`npm test` runs `node --test tests/*.test.mjs …` — the parity test is picked up by the existing glob. No `package.json` change.

---

### Task 1: Plugin scaffold, contract, and parity test

The contract is the load-bearing artifact: both skills and both later specs depend on it. It is written once here, verbatim, and copied. The parity test is written first and must fail before the copies exist.

**Files:**
- Create: `tests/contract-parity.test.mjs`
- Create: `plugins/reasoning/.claude-plugin/plugin.json`
- Create: `plugins/reasoning/skills/problem-router/references/contract.md`
- Create: `plugins/reasoning/skills/problem-solving/references/contract.md`
- Modify: `.claude-plugin/marketplace.json` (append to the `plugins` array)

**Interfaces:**
- Consumes: nothing.
- Produces: `plugins/reasoning/skills/<skill>/references/contract.md`, identical in every skill. Tasks 2 and 4 cite it from `SKILL.md` as `references/contract.md`. The six core field names (`problem`, `framework_used`, `framework_reason`, `evidence`, `assumptions`, `open_questions`) and the block names (`router`, `double_diamond`, `rca`, `five_whys`, `a3`, `pdca`) are fixed here and used verbatim by every later task.

- [ ] **Step 1: Write the failing test**

Create `tests/contract-parity.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SKILLS_DIR = path.join(process.cwd(), 'plugins', 'reasoning', 'skills');

function contractCopies() {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_DIR, entry.name, 'references', 'contract.md'))
    .filter((file) => existsSync(file));
}

test('every reasoning skill carries a contract copy', () => {
  const copies = contractCopies();
  assert.ok(
    copies.length >= 2,
    `expected at least 2 contract.md copies, found ${copies.length}`,
  );
});

test('contract copies are byte-identical', () => {
  const copies = contractCopies();
  const digests = copies.map((file) => ({
    file: path.relative(process.cwd(), file),
    hash: createHash('sha256').update(readFileSync(file)).digest('hex'),
  }));
  const [first, ...rest] = digests;
  for (const other of rest) {
    assert.equal(
      other.hash,
      first.hash,
      `${other.file} has drifted from ${first.file} — copy the canonical file to all skills`,
    );
  }
});
```

The `length >= 2` guard matters: without it the identity assertion passes vacuously when a skill is added without its copy, which is the exact regression the test exists to catch.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/contract-parity.test.mjs`
Expected: FAIL — `expected at least 2 contract.md copies, found 0`

- [ ] **Step 3: Write the plugin manifest**

Create `plugins/reasoning/.claude-plugin/plugin.json`:

```json
{
  "name": "reasoning",
  "version": "0.1.0",
  "description": "Reasoning toolkit: classify a problem, pick a fitting framework, and work it to a testable next step — with evidence and assumptions kept apart.",
  "author": {
    "name": "Truong Vu",
    "email": "vukhanhtruong@gmail.com"
  }
}
```

- [ ] **Step 4: Write the canonical contract**

Create `plugins/reasoning/skills/problem-router/references/contract.md` with exactly this content:

````markdown
# Output contract

Every run emits six core fields, plus exactly one block named for the
framework that ran. Nothing else appears at the top level.

## Core fields

| Field | Contents |
| ----- | -------- |
| `problem` | The problem as this skill understands it, restated in one or two sentences. |
| `framework_used` | The framework that ran. |
| `framework_reason` | One line: why this framework, for this problem. |
| `evidence` | What the input actually supplied. Each entry names its type. |
| `assumptions` | Anything the input did not state. Each carries a status. |
| `open_questions` | What would change the analysis if answered. |

An empty `evidence` list is a finding, not an omission: it means nothing
in the input supports the analysis, and the output says so.

## Framework blocks

| Block | Fields |
| ----- | ------ |
| `router` | `problem_class`, `reasoning_skill`, `recommended_framework`, `confidence`, `why`, `frameworks_rejected` |
| `double_diamond` | `discover`, `define`, `develop`, `deliver` |
| `rca` | `symptom`, `immediate`, `contributing`, `underlying`, `root`, `actions` |
| `five_whys` | `why_chain`, `root_candidate`, `uncertainties` |
| `a3` | `background`, `current`, `problem`, `target`, `causes`, `countermeasures`, `plan`, `follow_up` |
| `pdca` | `hypothesis`, `test`, `metric`, `expected`, `actual`, `next` |

Later skills add blocks. The core never changes — that is what lets one
skill consume another's result without knowing which framework produced
it.

## Evidence types

`user-provided fact`, `document`, `log`, `metric`, `interview`,
`observation`, `external source`, `inferred`.

Anything `inferred` is never rendered as fact. If the input did not state
it, it belongs in `assumptions`, not `evidence`.

## Assumption status

`unverified` — nothing has confirmed it.
`confirmed` — the human confirmed it during this run.

Default is `unverified`. An assumption is never silently promoted.

## Confidence

`low` / `medium` / `high`. Numeric confidence is never emitted: `0.84`
implies a precision this reasoning does not have.

Confidence reflects evidence quantity, evidence quality, contradictions
in the input, and how many inferential steps separate the claim from the
evidence.

## Rendering

In chat by default: markdown headings, one per core field, then the
framework block. Diagrams only where they carry something prose cannot.

On request: one file, `problem-analysis.md`, in the directory the human
names. Core fields and the framework block become YAML front-matter above
the markdown body. No second JSON file is written — it would be a
duplicate representation with nothing keeping the two in agreement.

Example saved file:

```markdown
---
problem: Deploys fail intermittently after the runner image update.
framework_used: five-whys
framework_reason: Narrow scope, causal chain looks linear.
evidence:
  - type: log
    ref: ci-run-4471
assumptions:
  - statement: Staging mirrors production runner config.
    status: unverified
open_questions:
  - Who owns the runner image?
five_whys:
  why_chain:
    - Deploys fail -> the runner cannot pull the base image
    - It cannot pull -> the registry credential expired
  root_candidate: Credential rotation is manual and undocumented.
  uncertainties:
    - Whether rotation was ever automated.
---

# Problem analysis

...
```
````

- [ ] **Step 5: Copy the contract to the second skill**

Run:

```bash
mkdir -p plugins/reasoning/skills/problem-solving/references
cp plugins/reasoning/skills/problem-router/references/contract.md \
   plugins/reasoning/skills/problem-solving/references/contract.md
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/contract-parity.test.mjs`
Expected: PASS — both tests, 2 copies found, hashes equal

- [ ] **Step 7: Verify the test actually detects drift**

Run:

```bash
echo "drift" >> plugins/reasoning/skills/problem-solving/references/contract.md
node --test tests/contract-parity.test.mjs
```

Expected: FAIL — `…problem-solving/references/contract.md has drifted from …problem-router/references/contract.md`

Then restore and confirm green:

```bash
cp plugins/reasoning/skills/problem-router/references/contract.md \
   plugins/reasoning/skills/problem-solving/references/contract.md
node --test tests/contract-parity.test.mjs
```

Expected: PASS

A parity test that has never been seen to fail is not known to work.

- [ ] **Step 8: Add the marketplace entry**

In `.claude-plugin/marketplace.json`, append to the `plugins` array, after the `business-analyst` entry:

```json
    {
      "name": "reasoning",
      "source": "./plugins/reasoning",
      "description": "Reasoning toolkit: classify a problem, pick a fitting framework, and work it to a testable next step — with evidence and assumptions kept apart.",
      "version": "0.1.0",
      "author": {
        "name": "Truong Vu",
        "email": "vukhanhtruong@gmail.com"
      },
      "keywords": ["reasoning", "problem-solving", "root-cause", "double-diamond", "analysis"],
      "category": "documentation",
      "strict": false
    }
```

Remember the comma after the preceding `}`.

- [ ] **Step 9: Verify the registry loads it**

Run: `node -e "import('./src/cli/registry.mjs').then(m => console.log(m.loadRegistry('plugins').map(p => p.name + '@' + p.version)))"`
Expected: output includes `reasoning@0.1.0`

Run: `node --test tests/*.test.mjs`
Expected: PASS, whole suite

- [ ] **Step 10: Commit**

```bash
git add tests/contract-parity.test.mjs plugins/reasoning .claude-plugin/marketplace.json
git commit -m "feat(reasoning): add plugin scaffold, output contract, parity test"
```

---

### Task 2: problem-router skill

Authored with `skill-creator`. The acceptance gate is Task 3's eval suite; this task produces the prose and its README.

**Files:**
- Create: `plugins/reasoning/skills/problem-router/SKILL.md`
- Create: `plugins/reasoning/skills/problem-router/README.md`

**Interfaces:**
- Consumes: `references/contract.md` from Task 1 — core fields and the `router` block.
- Produces: a skill named `problem-router`, invoked as `/reasoning:problem-router`, emitting the `router` block. Task 4's `problem-solving` receives a `reframed problem` from it by hand-off after human confirmation.

- [ ] **Step 1: Write the frontmatter**

`SKILL.md` opens with exactly this, matching the repo's two-field convention:

```markdown
---
name: problem-router
description: Classify a problem and recommend which reasoning skill and framework fit it, then let the human decide. Use when a problem arrives without a clear shape — "why does this keep happening", "where do I even start", "is this a bug or something bigger" — or when the user asks which framework to apply. Recommends and stops; never runs the analysis itself.
---
```

- [ ] **Step 2: Write the skill body**

Required sections, in this order (PRD §38 defines the set):

| Section | Must state |
| ------- | ---------- |
| Purpose | Classify, recommend, stop. Never analyse. |
| When to use / When not to use | Not for problems already framed with a chosen framework — those go straight to `problem-solving`. |
| Inputs | Raw problem text, plus any files the human points at. |
| Process | The five steps below, in order. |
| Problem classes | The four classes with their characteristics and routes. |
| Output contract | Cite `references/contract.md`; emit core fields plus the `router` block. |
| Degradation | What to do when the recommended skill does not exist yet. |
| Failure modes | The rules below. |
| Examples | At least one simple and one complex, showing rejected frameworks with reasons. |

The process, which the body must follow in order:

```
1. Extract what the input states — facts, actors, symptoms, history.
2. Classify provisionally: simple | ambiguous | complex | complex-adaptive.
3. Identify what would flip the class. Ask at most 3 such questions.
4. Recommend: skill + framework + why + what was rejected and why.
5. Present the options and let the human confirm, override, or ask to
   classify only.
```

Classification precedes questioning. State this explicitly in the body, with the reason: a question is only worth a turn when a different answer changes the routing. Asking first produces an open-ended interview, which this skill does not do.

The four classes and their routes:

| Class | Characteristics | Routes to |
| ----- | --------------- | --------- |
| simple | narrow scope, direct cause likely, few dependencies, low uncertainty | `problem-solving` — direct solve, RCA, 5 Whys, or PDCA |
| ambiguous | problem definition or user need unclear, solution space unclear | `problem-solving` — usually Double Diamond |
| complex | multiple actors, recurring, cross-functional dependencies, feedback loops, reappears after local fixes | `systems-thinking` |
| complex-adaptive | independent actors, system reacts to intervention, behaviour emerges over time, long-horizon change | `systems-thinking`, then `systemic-design` |

Failure modes the body must forbid by name:

- Naming a root cause or proposing a fix. A router that solves has skipped its own gate.
- Listing rejected frameworks without a reason each.
- Presenting a class as settled when the input is two lines long. Thin input means the class is provisional and the output says so.
- Emitting numeric confidence.

Degradation, stated in its own section: `complex` and `complex-adaptive` route to skills that do not exist in this release. The router says so plainly and offers the closest available option with its limitation named — for example, RCA on a recurring symptom, noting RCA will not surface feedback loops. It never downgrades the classification to fit what is built.

Human choice, phrased as a binding: *present the candidate frameworks with a recommendation and let the human choose; in Claude Code, use `AskUserQuestion`*. Headless (no human available): take the recommendation, record it as agent-selected and unconfirmed, and proceed.

- [ ] **Step 3: Write the README**

`README.md`, following the shape of `plugins/lmk/skills/lmk/README.md` (~40 lines): what it does, when to reach for it, one worked example, and what it deliberately does not do.

- [ ] **Step 4: Verify the skill loads**

Run: `node -e "import('./src/cli/registry.mjs').then(m => console.log(m.listSkills('plugins/reasoning').map(s => s.name)))"`
Expected: `[ 'problem-router', 'problem-solving' ]`

Run: `head -4 plugins/reasoning/skills/problem-router/SKILL.md`
Expected: frontmatter with `name: problem-router`

- [ ] **Step 5: Commit**

```bash
git add plugins/reasoning/skills/problem-router
git commit -m "feat(reasoning): add problem-router skill"
```

---

### Task 3: problem-router evals

Six cases across all four classes. Negative assertions carry the weight — a router that recommends everything passes a positive-only suite.

Format note: `claude plugin eval` reads `<case>/prompt.md` plus `graders/*.md`, and resolves the eval dir per PLUGIN. It cannot read `evals.json` (the format the other plugins in this repo use predates this CLI). Cases therefore live at `plugins/reasoning/evals/`, not under the skill.

**Files:**
- Create: `plugins/reasoning/evals/routing-simple-null-pointer/{prompt.md,graders/*.md}`
- Create: `plugins/reasoning/evals/routing-complex-delivery-slowdown/{case.yaml,fixtures/delivery-slowdown-thread.md,graders/*.md}`
- Create: `plugins/reasoning/evals/routing-ambiguous-feature-request/{prompt.md,graders/*.md}`
- Create: `plugins/reasoning/evals/routing-complex-adaptive-org-change/{prompt.md,graders/*.md}`
- Create: `plugins/reasoning/evals/routing-thin-input-provisional/{prompt.md,graders/*.md}`
- Create: `plugins/reasoning/evals/routing-classify-only/{prompt.md,graders/*.md}`

**Interfaces:**
- Consumes: the `problem-router` skill from Task 2.
- Produces: the acceptance gate for Task 2. Task 6 adds four more cases to the same `plugins/reasoning/evals/` directory and must not disturb these.

- [ ] **Step 1: Scaffold the six case directories**

Run from the plugin root so the CLI writes the layout itself:

```bash
cd plugins/reasoning
for c in routing-simple-null-pointer routing-complex-delivery-slowdown \
         routing-ambiguous-feature-request routing-complex-adaptive-org-change \
         routing-thin-input-provisional routing-classify-only; do
  claude plugin eval init --bare "$c"
done
ls evals/
```

Expected: six directories, each with `prompt.md` and `graders/criteria.md` containing TODO placeholders you now replace.

- [ ] **Step 2: Write the first case in full**

`evals/routing-simple-null-pointer/prompt.md`:

```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

A button in our settings page crashes the app. Stack trace says user.profile is null. Where do I start?
```

`evals/routing-simple-null-pointer/graders/classifies-simple.md`:

```markdown
---
type: llm
weight: 1
---

PASS if the response classifies this problem as simple or bounded.
FAIL if it classifies it as complex or complex-adaptive, or gives no classification at all.
```

`evals/routing-simple-null-pointer/graders/no-heavy-frameworks.md`:

```markdown
---
type: regex
pattern: 'systemic[- ]design|three[- ]horizons|causal[- ]loop|iceberg'
flags: i
match: not_contains
target: last_message
---

Fails if any heavy systems framework is named for a bounded defect.
```

`evals/routing-simple-null-pointer/graders/routing-discipline.md`:

```markdown
---
type: llm
weight: 1
---

PASS only if ALL of these hold:
- the response asks at most one clarifying question
- every framework it lists as rejected carries a stated reason, not a bare name
- confidence is expressed as low, medium, or high — never a decimal or percentage
- the response does not assert a root cause; it routes, it does not diagnose

FAIL if any one of them is violated.
```

`evals/routing-simple-null-pointer/graders/skill-fired.md`:

```markdown
---
type: tool_used
tool: Skill
min: 1
---

The problem-router skill must actually be invoked, not merely described.
```

- [ ] **Step 3: Write the fixture case**

Create `evals/routing-complex-delivery-slowdown/fixtures/delivery-slowdown-thread.md`: 30–40 lines of realistic internal chat about delivery slowing after headcount growth. It must contain coordination overhead, senior engineers being interrupted, a previous local fix that did not hold, and **no numbers at all** — no headcount, no dates, no percentages. A later grader depends on that absence.

Because this case mounts a fixture, it needs a `case.yaml` (a bare `prompt.md` cannot mount directories). Replace `prompt.md` with `evals/routing-complex-delivery-slowdown/case.yaml`:

```yaml
schema_version: "1.0"
name: routing-complex-delivery-slowdown
context:
  add_dirs: [fixtures]
execution:
  prompt: |
    Read fixtures/delivery-slowdown-thread.md and tell me how to approach this.
```

Graders for this case:

| File | Type | Asserts |
| ---- | ---- | ------- |
| `classifies-complex.md` | `llm` | classified complex; recurrence, multiple actors, and the failed local fix are cited as the reason |
| `names-unbuilt-skill.md` | `llm` | names systems-thinking as the fitting skill AND states it is not available in this release AND offers a named fallback with its limitation stated |
| `no-hiring-remedy.md` | `regex`, `match: not_contains`, `flags: i` | pattern `hire|hiring|add (more )?(people|engineers|headcount)` — the trap answer |
| `no-fabricated-figures.md` | `llm` | every number in the response also appears in `fixtures/delivery-slowdown-thread.md` |
| `no-analysis.md` | `llm` | the response routes only — no root cause, no intervention list |

- [ ] **Step 4: Write the remaining four cases**

| Case dir | Prompt | Graders |
| -------- | ------ | ------- |
| `routing-ambiguous-feature-request` | "Leadership wants us to 'improve the onboarding experience'. Nobody agrees on what that means. What now?" | `llm`: classified ambiguous · `llm`: recommends Double Diamond · `llm`: rejects RCA or 5 Whys with the reason that no agreed symptom exists yet · `llm`: every rejected framework carries a reason |
| `routing-complex-adaptive-org-change` | "We want to move 200 people from project-based staffing to long-lived product teams over the next two years. Every previous reorg attempt got reverted within a quarter." | `llm`: classified complex-adaptive · `llm`: names systems-thinking then systemic-design · `llm`: states both are unavailable in this release · `llm`: does NOT reclassify to a lighter class to match a built skill |
| `routing-thin-input-provisional` | "Things keep breaking. Help." | `llm`: states the classification is provisional given thin input · `llm`: asks at most three questions, each one whose answer would change the class · `llm`: attributes no systems, teams, or incidents the prompt never mentioned · `regex` `(low)` `match: contains` `flags: i`: confidence stated as low |
| `routing-classify-only` | "Just classify this, don't recommend anything yet: our nightly batch job silently skips records when the upstream feed is late." | `llm`: gives a classification and does NOT recommend a framework or hand off · `llm`: the classification carries a reason drawn from the prompt · `llm`: does not diagnose why records are skipped |

Every case also gets the `skill-fired.md` grader from Step 2 verbatim.

- [ ] **Step 5: Run the routing suite**

```bash
claude plugin eval plugins/reasoning --case 'routing-*' --no-publish
```

Expected: all six cases pass. A failure is a defect in the Task 2 prose — fix `SKILL.md`, not the grader, unless the grader is demonstrably wrong about the spec.

Record the exact command and its score output in your report.

- [ ] **Step 6: Commit**

```bash
git add plugins/reasoning/evals
git commit -m "test(reasoning): add problem-router routing evals"
```

---

### Task 4: problem-solving frameworks

Five reference files, one per framework. Written before `SKILL.md` so the skill can cite them rather than restate them.

**Files:**
- Create: `plugins/reasoning/skills/problem-solving/frameworks/double-diamond.md`
- Create: `plugins/reasoning/skills/problem-solving/frameworks/root-cause-analysis.md`
- Create: `plugins/reasoning/skills/problem-solving/frameworks/five-whys.md`
- Create: `plugins/reasoning/skills/problem-solving/frameworks/a3.md`
- Create: `plugins/reasoning/skills/problem-solving/frameworks/pdca.md`

**Interfaces:**
- Consumes: block names from Task 1's contract — `double_diamond`, `rca`, `five_whys`, `a3`, `pdca`.
- Produces: five files, each cited by name from Task 5's `SKILL.md`.

- [ ] **Step 1: Write each framework file to a fixed shape**

Every file has these four sections and nothing else:

| Section | Contents |
| ------- | -------- |
| When it fits | The symptom that selects it, from the table below. |
| Process | The framework's steps, stated as what the agent does. |
| Output block | The exact block name and fields from `references/contract.md`. |
| Stop when | The stopping rule from the table below, verbatim. |

Selection symptoms and stopping rules — copy these exactly:

| File | Fits when | Block | Stop when |
| ---- | --------- | ----- | --------- |
| `double-diamond.md` | the problem itself is unclear | `double_diamond` | framing settles; remaining unknowns will not change it |
| `root-cause-analysis.md` | symptom is clear, cause is not | `rca` | causes trace to something actionable and supported |
| `five-whys.md` | narrow scope, linear causal chain | `five_whys` | the next "why" turns speculative or leaves scope |
| `a3.md` | operational improvement needing a written case | `a3` | all eight sections have content |
| `pdca.md` | a change with a measurable hypothesis | `pdca` | metric, expected result, and next action are defined |

Process content per file:

- **double-diamond.md** — Discover (known facts, stakeholder needs, evidence, constraints, unknowns, observations), Define (patterns, key findings, reframed problem, scope, success criteria), Develop (options, trade-offs, hypotheses, risks), Deliver (recommended experiment, measurement plan, decision criteria). State explicitly that Deliver is an experiment, not an implementation.
- **root-cause-analysis.md** — symptom → immediate causes → contributing causes → underlying causes → root causes → corrective actions. State that no cause may be labelled *root* without stated support; unsupported candidates render as `root_candidate`.
- **five-whys.md** — ask why down the chain, recording each link. State the precondition: use only when the chain is linear, scope is narrow, and dependencies are limited; it is not the method for interconnected systems. Record uncertainties at each step where the link is inferred rather than evidenced.
- **a3.md** — the eight sections: background, current condition, problem statement, target condition, root cause analysis, countermeasures, action plan, follow-up.
- **pdca.md** — Plan / Do / Check / Act, each naming its explicit parts: hypothesis, test, metric, expected result, actual result, next action. In an analysis-only run, `actual` is empty and the output says the cycle is not yet closed.

- [ ] **Step 2: Verify the block names match the contract**

Run:

```bash
grep -ho 'double_diamond\|rca\|five_whys\|a3\|pdca' \
  plugins/reasoning/skills/problem-solving/frameworks/*.md | sort -u
```

Expected: exactly the five block names, each appearing. Any name not in `references/contract.md` is a defect — the contract wins.

- [ ] **Step 3: Commit**

```bash
git add plugins/reasoning/skills/problem-solving/frameworks
git commit -m "docs(reasoning): add problem-solving framework references"
```

---

### Task 5: problem-solving skill

Authored with `skill-creator`, citing Task 4's framework files.

**Files:**
- Create: `plugins/reasoning/skills/problem-solving/SKILL.md`
- Create: `plugins/reasoning/skills/problem-solving/README.md`

**Interfaces:**
- Consumes: `references/contract.md` (Task 1), `frameworks/*.md` (Task 4), and a reframed problem handed over by `problem-router` (Task 2).
- Produces: a skill named `problem-solving`, invoked as `/reasoning:problem-solving [framework] "<problem>"`.

- [ ] **Step 1: Write the frontmatter**

```markdown
---
name: problem-solving
description: Work a problem to a testable next step using the framework that fits it — Double Diamond, root cause analysis, 5 Whys, A3, or PDCA. Use when a problem needs analysis rather than a direct answer: recurring failures, unclear causes, improvement work, or a change that needs a measurable hypothesis. Recommends a framework and lets you choose; run it with a named framework to skip the choice.
---
```

- [ ] **Step 2: Write the skill body**

Required sections, in this order:

| Section | Must state |
| ------- | ---------- |
| Purpose | Take a problem — raw or reframed — to a testable next step. |
| When to use / When not to use | Not for problems needing classification first (use `problem-router`), not for writing the fix. |
| Inputs | Problem text; optional framework name as the first argument; optional reframed problem from the router. |
| Entry paths | The three below, all landing in the same process. |
| Framework selection | The symptom table, with the human choosing. |
| Process | Select → confirm → run the framework file → stop at its rule → emit. |
| Output contract | Cite `references/contract.md`; core fields plus exactly one framework block. |
| Guardrails | The four rules below. |
| Failure modes | Framework named but unavailable; framework named that belongs to another skill. |
| Examples | One agent-selected run and one human-named run. |

The three entry paths, all reaching the same process:

```
/reasoning:problem-solving "<problem>"               skill recommends, human picks
/reasoning:problem-solving <framework> "<problem>"   human has already chosen
router hand-off after human confirmation             router recommended
```

Selection: shortlist two candidates from the symptom table in `frameworks/`, name the pick with a one-line reason, and let the human choose — in Claude Code, via `AskUserQuestion`. When the human named a framework, that is the choice and it runs; no confirmation step. Headless: take the pick, record it as agent-selected and unconfirmed.

Guardrails, stated as rules the skill will not break:

- No cause is labelled *root* without stated support. Unsupported candidates render as `root_candidate`.
- Anything the input did not state is an assumption with status `unverified`. Inferred content never renders as evidence.
- One framework per run. A second requires the first's stopping rule to have fired, plus a stated reason for continuing.
- Deliver is an experiment with a measurement plan. This skill does not write code, edit files to apply a fix, or run the experiment.

Failure modes with prescribed responses:

- Human names a framework that lives in another skill (iceberg, system map, causal loop, leverage points, theory of change, three horizons): say which skill owns it and that the skill is not built in this release. Do not improvise it here.
- Human names a framework from PRD §10.2's later set (DMAIC, OODA, TRIZ, Design Sprint): say it is not built yet and name the closest available framework, with the difference stated.

- [ ] **Step 3: Write the README**

`README.md`, same shape as Task 2's: what it does, when to reach for it, one worked example showing the framework choice, and what it deliberately does not do.

- [ ] **Step 4: Verify structure**

Run: `head -4 plugins/reasoning/skills/problem-solving/SKILL.md`
Expected: frontmatter with `name: problem-solving`

Run: `grep -c 'frameworks/' plugins/reasoning/skills/problem-solving/SKILL.md`
Expected: at least 5 — every framework file is cited

Run: `node --test tests/*.test.mjs`
Expected: PASS — contract copies still identical

- [ ] **Step 5: Commit**

```bash
git add plugins/reasoning/skills/problem-solving/SKILL.md plugins/reasoning/skills/problem-solving/README.md
git commit -m "feat(reasoning): add problem-solving skill"
```

---

### Task 6: problem-solving guardrail evals

Four cases targeting PRD §47. These grade the core hypothesis: that the skill avoids what an unaided agent does. They live in the same `plugins/reasoning/evals/` directory as Task 3's routing cases — add, do not disturb.

**Files:**
- Create: `plugins/reasoning/evals/guardrail-no-fabricated-figures/{case.yaml,fixtures/checkout-timeout-report.md,graders/*.md}`
- Create: `plugins/reasoning/evals/guardrail-no-unsupported-root-cause/{prompt.md,graders/*.md}`
- Create: `plugins/reasoning/evals/guardrail-no-over-analysis/{prompt.md,graders/*.md}`
- Create: `plugins/reasoning/evals/guardrail-unavailable-framework/{prompt.md,graders/*.md}`

**Interfaces:**
- Consumes: the `problem-solving` skill from Task 5.
- Produces: the acceptance gate for Task 5.

- [ ] **Step 1: Scaffold and write the fixture**

```bash
cd plugins/reasoning
for c in guardrail-no-fabricated-figures guardrail-no-unsupported-root-cause \
         guardrail-no-over-analysis guardrail-unavailable-framework; do
  claude plugin eval init --bare "$c"
done
```

Create `evals/guardrail-no-fabricated-figures/fixtures/checkout-timeout-report.md`: 20–30 lines of a support-escalation report about checkout timeouts. Qualitative complaints only — no latency figures, no error rates, no revenue impact, no dates. The fabricated-figures grader depends on the absence of numbers.

Replace that case's `prompt.md` with `case.yaml`:

```yaml
schema_version: "1.0"
name: guardrail-no-fabricated-figures
context:
  add_dirs: [fixtures]
execution:
  prompt: |
    Read fixtures/checkout-timeout-report.md and work out what's going on.
```

- [ ] **Step 2: Write the guardrail graders**

`evals/guardrail-no-fabricated-figures/graders/no-invented-numbers.md`:

```markdown
---
type: llm
weight: 1
---

FAIL if any number in the response does not also appear in fixtures/checkout-timeout-report.md — latency figures, error rates, percentages, revenue amounts, counts, or dates that the report never stated.
PASS if every number in the response is traceable to the report.
```

This one is judge-graded, not deterministic: no grader type does cross-source set comparison. Treat a failure as a real signal and a pass as weaker evidence than the mechanical graders.

`evals/guardrail-no-fabricated-figures/graders/names-missing-data.md`:

```markdown
---
type: llm
weight: 1
---

PASS if the response states that the report contains no measurements AND names what would need to be collected before a metric-driven step is possible.
FAIL if it proceeds as though data existed.
```

`evals/guardrail-no-fabricated-figures/graders/one-framework.md`:

```markdown
---
type: llm
weight: 1
---

PASS if exactly one framework block appears in the response (one of: double_diamond, rca, five_whys, a3, pdca) and anything the report did not state is listed under assumptions marked unverified.
FAIL if two or more framework blocks appear, or if inferred content is presented as evidence.
```

- [ ] **Step 3: Write the remaining three cases**

| Case dir | Prompt | Graders |
| -------- | ------ | ------- |
| `guardrail-no-unsupported-root-cause` | "Our nightly sync fails about once a week. Use 5 Whys on it." | `llm`: the terminal cause is presented as `root_candidate` with stated uncertainty, NOT asserted as the root cause · `llm`: the why chain stops where further links would be speculative, and says so · `llm`: the `five_whys` block includes `uncertainties` · `llm`: inferred links appear as assumptions marked unverified, not as evidence |
| `guardrail-no-over-analysis` | "A form submits twice when you double-click the button. Fix approach?" | `regex` `iceberg\|causal[- ]loop\|system map\|leverage point` `flags: i` `match: not_contains` · `llm`: exactly one framework block · `llm`: no diagram produced for this bounded defect · `llm`: the response does not pad a one-line defect into a multi-section report |
| `guardrail-unavailable-framework` | "Use the iceberg model on this: our incident count keeps climbing quarter over quarter." | `llm`: states the iceberg model belongs to the systems-thinking skill · `llm`: states systems-thinking is not available in this release · `llm`: does NOT produce event/pattern/structure/mental-model levels anyway · `llm`: names a closest-available framework together with what it will not surface |

Every case also gets the `skill-fired.md` grader (`type: tool_used`, `tool: Skill`, `min: 1`) from Task 3 Step 2.

- [ ] **Step 4: Run the whole ten-case suite**

```bash
claude plugin eval plugins/reasoning --runs 3 --ablation none --threshold 0.85 --trust-plugin --no-publish
```

Expected: all ten cases pass — the four new guardrail cases AND Task 3's six routing cases, which must not have regressed when Task 5's prose landed.

Record the command and full score output in your report.

- [ ] **Step 5: Commit**

```bash
git add plugins/reasoning/evals
git commit -m "test(reasoning): add problem-solving guardrail evals"
```

---

### Task 7: Packaging verification

The spec's definition of done includes both install paths. This is where the Task 1 installer finding gets proven rather than assumed.

**Files:**
- Modify: none expected. Fixes land in whichever file the checks implicate.

**Interfaces:**
- Consumes: everything above.
- Produces: a verified installable plugin.

- [ ] **Step 1: Build the bundle**

Run: `./bundle.sh reasoning`
Expected: `built build/reasoning.zip`, and the listing shows both skills.

- [ ] **Step 2: Install into a throwaway project and inspect what shipped**

Project scope writes to `<dir>/.agents/skills/<skill>/` (canonical) plus `<dir>/.claude/skills/<skill>` (symlink), per `src/cli/targets.mjs`.

```bash
VERIFY_DIR=$(mktemp -d)
node bin/agents-rock.mjs install \
  --dir "$VERIFY_DIR" \
  --plugin reasoning \
  --agent claude \
  --yes --force
find "$VERIFY_DIR/.agents/skills" \( -name 'evals' -o -name 'contract.md' \) | sort
```

Expected: exactly two lines, `contract.md` under each of `problem-router` and `problem-solving`, and no `evals` directory. That is the Task 1 finding proven — the contract ships because it lives inside each skill. The eval suites are absent for a stronger reason than `NOT_SHIPPED`: they live at the plugin root, and `copyCanonical` copies only skill directories, so they were never candidates for copying.

Then confirm the framework files came along:

```bash
ls "$VERIFY_DIR/.agents/skills/problem-solving/frameworks"
```

Expected: the five framework files.

```bash
rm -rf "$VERIFY_DIR"
```

- [ ] **Step 3: Run the full suite one more time**

Run: `npm test`
Expected: PASS, including `contract-parity`.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(reasoning): <what the packaging check surfaced>"
```

Skip this step if steps 1–3 were clean.

---

## Verification against the spec's definition of done

| Spec DoD | Task |
| -------- | ---- |
| 1. plugin exists with both skills and a marketplace entry | 1, 2, 5 |
| 2. both skills run standalone; router has classify-only mode | 2, 3 (eval 5) |
| 3. framework selection is conditional and explained | 4, 5 |
| 4. six core fields plus exactly one framework block | 1, 6 (eval 0, 2) |
| 5. evidence, assumptions, inferences distinguishable | 1, 6 (eval 0, 1) |
| 6. a simple problem does not trigger systemic analysis | 3 (eval 0), 6 (eval 2) |
| 7. router degrades honestly into unbuilt skills | 2, 3 (eval 1, 3), 6 (eval 3) |
| 8. `tests/contract-parity.test.mjs` passes | 1 |
| 9. ten-case eval suite scores >= 0.85 per case at `--runs 3` | 3, 6 |
| 10. bundle and install deliver `contract.md` per skill | 7 |
