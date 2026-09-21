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
- `evals/` directories are excluded from user installs by `NOT_SHIPPED` in `src/cli/install.mjs` — do not relocate them.
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
| `plugins/reasoning/skills/problem-router/evals/evals.json` | 6 routing cases |
| `plugins/reasoning/skills/problem-router/evals/fixtures/` | problem inputs too long for a prompt |
| `plugins/reasoning/skills/problem-solving/SKILL.md` | select framework → run → stop |
| `plugins/reasoning/skills/problem-solving/README.md` | human-facing summary |
| `plugins/reasoning/skills/problem-solving/references/contract.md` | output contract (identical copy) |
| `plugins/reasoning/skills/problem-solving/frameworks/*.md` | one file per framework, 5 files |
| `plugins/reasoning/skills/problem-solving/evals/evals.json` | 4 guardrail cases |
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

**Files:**
- Create: `plugins/reasoning/skills/problem-router/evals/evals.json`
- Create: `plugins/reasoning/skills/problem-router/evals/fixtures/delivery-slowdown-thread.md`

**Interfaces:**
- Consumes: the `problem-router` skill from Task 2.
- Produces: the acceptance gate for Task 2. No later task depends on it.

- [ ] **Step 1: Write the long-input fixture**

Create `evals/fixtures/delivery-slowdown-thread.md`: 30–40 lines of realistic internal chat about delivery slowing after headcount growth. It must contain coordination overhead, senior engineers being interrupted, a previous local fix that did not hold, and **no numbers at all** — no headcount, no dates, no percentages. The fabricated-figures assertion depends on that absence.

- [ ] **Step 2: Write the eval suite**

Create `evals/evals.json` matching the repo format (`skill_name`, `evals[]` with `id`, `name`, `prompt`, `expected_output`, `files`, `assertions`):

```json
{
  "skill_name": "problem-router",
  "evals": [
    {
      "id": 0,
      "name": "simple-null-pointer",
      "prompt": "A button in our settings page crashes the app. Stack trace says user.profile is null. Where do I start?",
      "expected_output": "Classifies as simple or bounded, recommends problem-solving with RCA or a direct fix, and rejects the heavier frameworks with reasons. Asks at most one question. No iceberg, no causal loop, no transition framing.",
      "files": [],
      "assertions": [
        "class-simple: the output classifies the problem as simple or bounded, not complex or complex-adaptive",
        "no-heavy-frameworks: the output does not recommend systemic-design, three-horizons, causal-loop, or iceberg",
        "at-most-one-question: the output asks no more than one clarifying question",
        "rejections-have-reasons: every framework listed as rejected carries a stated reason, not a bare name",
        "no-numeric-confidence: confidence appears as low, medium, or high — no decimal or percentage value",
        "no-root-cause-named: the output does not assert a root cause; routing only"
      ]
    },
    {
      "id": 1,
      "name": "complex-delivery-slowdown",
      "prompt": "Read delivery-slowdown-thread.md and tell me how to approach this.",
      "expected_output": "Classifies as complex on the strength of recurrence, multiple actors, and a failed local fix. Recommends systems-thinking, states plainly that systems-thinking is not built in this release, and offers the closest available option with its limitation named. Does not recommend hiring.",
      "files": [
        "plugins/reasoning/skills/problem-router/evals/fixtures/delivery-slowdown-thread.md"
      ],
      "assertions": [
        "class-complex: the output classifies the problem as complex",
        "names-systems-thinking: the output names systems-thinking as the fitting skill",
        "states-unbuilt: the output states that systems-thinking is not available in this release and offers a named fallback with its limitation",
        "no-hiring-recommendation: the output does not recommend adding people as a remedy",
        "no-fabricated-figures: every number in the output also appears verbatim in delivery-slowdown-thread.md",
        "no-analysis: the output does not perform the analysis — no root cause, no intervention list"
      ]
    },
    {
      "id": 2,
      "name": "ambiguous-feature-request",
      "prompt": "Leadership wants us to 'improve the onboarding experience'. Nobody agrees on what that means. What now?",
      "expected_output": "Classifies as ambiguous, recommends problem-solving with Double Diamond, and explains that the problem definition itself is the unknown. Rejects RCA and 5 Whys because there is no agreed symptom to trace.",
      "files": [],
      "assertions": [
        "class-ambiguous: the output classifies the problem as ambiguous",
        "recommends-double-diamond: the output recommends Double Diamond",
        "rejects-cause-tracing: the output rejects RCA or 5 Whys with the reason that no agreed symptom exists yet",
        "rejections-have-reasons: every framework listed as rejected carries a stated reason"
      ]
    },
    {
      "id": 3,
      "name": "complex-adaptive-org-change",
      "prompt": "We want to move 200 people from project-based staffing to long-lived product teams over the next two years. Every previous reorg attempt got reverted within a quarter.",
      "expected_output": "Classifies as complex-adaptive on emergence, independent actors, and long horizon. Routes to systems-thinking then systemic-design, and states both are unbuilt in this release rather than substituting a lighter framework as if it were equivalent.",
      "files": [],
      "assertions": [
        "class-complex-adaptive: the output classifies the problem as complex-adaptive",
        "routes-both: the output names systems-thinking followed by systemic-design",
        "states-unbuilt: the output states both skills are unavailable in this release",
        "no-silent-downgrade: the output does not reclassify to a lighter class in order to match a built skill"
      ]
    },
    {
      "id": 4,
      "name": "thin-input-provisional",
      "prompt": "Things keep breaking. Help.",
      "expected_output": "Says outright that two lines cannot support a confident classification. Gives a provisional class, marks it provisional, and asks the small number of questions that would actually flip it. Does not invent a scenario.",
      "files": [],
      "assertions": [
        "marked-provisional: the output states the classification is provisional given the thin input",
        "asks-flipping-questions: the questions asked are ones whose answers would change the class, and there are no more than three",
        "no-invented-context: the output does not attribute systems, teams, or incidents that the prompt never mentioned",
        "low-confidence: confidence is stated as low"
      ]
    },
    {
      "id": 5,
      "name": "classify-only-request",
      "prompt": "Just classify this, don't recommend anything yet: our nightly batch job silently skips records when the upstream feed is late.",
      "expected_output": "Honours the constraint — returns the classification and its reasoning, and stops. No framework recommendation, no hand-off, no analysis.",
      "files": [],
      "assertions": [
        "honours-classify-only: the output gives a classification and does not recommend a framework or hand off to another skill",
        "class-stated-with-reason: the classification carries a stated reason drawn from the prompt",
        "no-analysis: the output does not diagnose why records are skipped"
      ]
    }
  ]
}
```

- [ ] **Step 3: Validate the JSON**

Run: `node -e "const d=require('fs').readFileSync('plugins/reasoning/skills/problem-router/evals/evals.json','utf8'); const j=JSON.parse(d); console.log(j.skill_name, j.evals.length, j.evals.every(e=>e.assertions.length>=3))"`
Expected: `problem-router 6 true`

- [ ] **Step 4: Run the eval suite**

Run: `claude plugin eval plugins/reasoning/skills/problem-router`
Expected: all six cases pass. Any failure is a defect in the Task 2 prose — fix `SKILL.md`, not the assertion, unless the assertion is demonstrably wrong about the spec.

- [ ] **Step 5: Commit**

```bash
git add plugins/reasoning/skills/problem-router/evals
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

Four cases targeting PRD §47. These grade the core hypothesis: that the skill avoids what an unaided agent does.

**Files:**
- Create: `plugins/reasoning/skills/problem-solving/evals/evals.json`
- Create: `plugins/reasoning/skills/problem-solving/evals/fixtures/checkout-timeout-report.md`

**Interfaces:**
- Consumes: the `problem-solving` skill from Task 5.
- Produces: the acceptance gate for Task 5.

- [ ] **Step 1: Write the fixture**

Create `evals/fixtures/checkout-timeout-report.md`: 20–30 lines of a support-escalation report about checkout timeouts. It must contain qualitative complaints only — no latency figures, no error rates, no revenue impact, no dates. The fabricated-figures assertion depends on the absence of numbers.

- [ ] **Step 2: Write the eval suite**

Create `evals/evals.json`:

```json
{
  "skill_name": "problem-solving",
  "evals": [
    {
      "id": 0,
      "name": "no-fabricated-figures",
      "prompt": "Read checkout-timeout-report.md and work out what's going on.",
      "expected_output": "Runs a fitting framework on what the report actually says. States that the report carries no measurements and that any metric-driven step needs data first. Invents no latency, error rate, or revenue number.",
      "files": [
        "plugins/reasoning/skills/problem-solving/evals/fixtures/checkout-timeout-report.md"
      ],
      "assertions": [
        "no-fabricated-figures: every number in the output also appears verbatim in checkout-timeout-report.md",
        "missing-data-named: the output states that the report contains no measurements and names what would need to be collected",
        "assumptions-labelled: anything not stated in the report is listed under assumptions with status unverified",
        "one-framework: exactly one framework block appears in the output"
      ]
    },
    {
      "id": 1,
      "name": "no-unsupported-root-cause",
      "prompt": "Our nightly sync fails about once a week. Use 5 Whys on it.",
      "expected_output": "Runs the why chain, and stops where the links stop being supported. The terminal cause is reported as root_candidate with its uncertainties named, not asserted as the root cause, because nothing in the prompt evidences the chain.",
      "files": [],
      "assertions": [
        "root-candidate-not-root: the terminal cause is presented as a candidate with stated uncertainty, not asserted as the root cause",
        "chain-stops-at-speculation: the why chain stops where further links would be speculative, and the output says so",
        "uncertainties-listed: the five_whys block includes uncertainties",
        "assumptions-labelled: inferred links appear as assumptions with status unverified, not as evidence"
      ]
    },
    {
      "id": 2,
      "name": "no-over-analysis",
      "prompt": "A form submits twice when you double-click the button. Fix approach?",
      "expected_output": "Treats this as the bounded defect it is. One lightweight framework, or a direct answer with the framework choice explained. No systems framing, no second framework, no diagram.",
      "files": [],
      "assertions": [
        "one-framework: exactly one framework block appears in the output",
        "no-systems-framing: the output does not produce an iceberg, a causal loop, a system map, or leverage points",
        "no-gratuitous-diagram: no diagram is produced for this bounded defect",
        "proportionate-length: the response does not pad a one-line defect into a multi-section report"
      ]
    },
    {
      "id": 3,
      "name": "unavailable-framework-named",
      "prompt": "Use the iceberg model on this: our incident count keeps climbing quarter over quarter.",
      "expected_output": "States that iceberg belongs to systems-thinking and that the skill is not built in this release. Names the closest available option and what it will not capture. Does not improvise an iceberg analysis under another name.",
      "files": [],
      "assertions": [
        "ownership-stated: the output states that the iceberg model belongs to the systems-thinking skill",
        "unavailability-stated: the output states that systems-thinking is not available in this release",
        "no-improvised-iceberg: the output does not produce event/pattern/structure/mental-model levels anyway",
        "fallback-with-limits: a closest-available framework is named together with what it will not surface"
      ]
    }
  ]
}
```

- [ ] **Step 3: Validate the JSON**

Run: `node -e "const j=JSON.parse(require('fs').readFileSync('plugins/reasoning/skills/problem-solving/evals/evals.json','utf8')); console.log(j.skill_name, j.evals.length, j.evals.every(e=>e.assertions.length>=3))"`
Expected: `problem-solving 4 true`

- [ ] **Step 4: Run both eval suites**

Run: `claude plugin eval plugins/reasoning/skills/problem-solving`
Expected: all four pass.

Run: `claude plugin eval plugins/reasoning/skills/problem-router`
Expected: all six still pass — Task 5's prose must not have regressed routing.

- [ ] **Step 5: Commit**

```bash
git add plugins/reasoning/skills/problem-solving/evals
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

Expected: exactly two lines, `contract.md` under each of `problem-router` and `problem-solving`, and no `evals` directory. That is the Task 1 finding proven — the contract ships because it lives inside each skill, and `NOT_SHIPPED` keeps the eval suites out.

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
| 9. ten-case eval suite passes | 3, 6 |
| 10. bundle and install deliver `contract.md` per skill | 7 |
