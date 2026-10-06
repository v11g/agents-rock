# Workflow Scope in the Business-Analyst Skill — Design Spec

Date: 2026-10-06
Skill: `plugins/business-analyst/skills/business-analyst/`
Series: workflow-mode estimate, spec 1 of 3
  1. this spec — the business-analyst skill produces System → Workflow → Feature
  2. estimate — scores and prices those features, links engineering components,
     score review "Built by", Workflow-based / Component-based pages
  3. proposal — Systems & Workflows format, currency from inputs
Design reference: `docs/mockups/estimate-workflow-mode/` (approved mockups,
Sin Kowa), and the sample built during this design:
`new-lead-livetest/leads/sin-kowa-v2/requirements.workflow-sample.md`.

## Summary

The Sin Kowa proposal that was sent to the client is organised as systems,
each with its to-be workflows and the features that serve them. No skill
produces that shape today: the business-analyst skill records how the client
works now (as-is workflows) and a flat FR list; estimate scores free-form
features. Pricing by business feature (v2, already merged) needs a stable,
client-agreed feature list to price.

After this change the business-analyst skill has two scope modes. `classic`
is today's package, untouched. `workflow` adds to-be workflows, systems and
features to `requirements.json`, and a script writes a To-be scope section
into `requirements.md` from that data. The PO reviews that section (read
only) and asks for changes in chat. Estimate and proposal start reading it
in specs 2 and 3; nothing downstream changes here.

Systems and features stay in business words. They describe what will be
built for the client, never how (the skill's "problem before solution" rule).

## Decisions

| # | Decision |
| --- | --- |
| D1 | The business-analyst skill owns System → Workflow → Feature. Estimate never drafts a scope. |
| D2 | `scopeMode: "workflow" \| "classic"` in `requirements.json` (and the md frontmatter). Absent means `classic`, so every existing lead keeps working with no migration. The existing `mode` field (greenfield / existing) is unrelated and unchanged. |
| D3 | The mode is asked once, beside the depth question. Switching mode later is a normal re-run: every existing ID stays. |
| D4 | Workflows are stored as data (`steps`, `branches`), never as mermaid text. Features point at steps by name, which the validator can check; the mermaid is generated. |
| D5 | `scripts/scope.mjs` and `scripts/scope.py` write the To-be scope section of `requirements.md` from the JSON, between markers. The agent never hand-writes that section. Output is byte-identical across the two (parity test). |
| D6 | No HTML page. The PO reads the To-be scope section of `requirements.md` (mermaid renders in Claude.ai, GitHub and VS Code). A page can come later if POs need it. |
| D7 | PO review is read only. Changes go through chat → agent edits JSON → `scope` script → validate. |
| D8 | The To-be scope section shows no IDs; names identify systems, workflows and features. Every other part of `requirements.md` keeps its IDs, since other documents cite them (counted on two live leads: Q 24, BR 15, ASM 11, FR 1 citations outside the package). |
| D9 | The FR table gains a `Feature` column in workflow mode, so an engineer can go from an FR to the feature that holds it. |
| D10 | The fresh-eyes review gains one item (steps no feature builds). Without a subagent (Claude.ai), the main agent runs the checklist itself and says so in the readiness report. |
| D11 | A workflow that grows (e.g. intake steps added in front of "invoice from digital DO") keeps its ID and is edited in place; its `label` drops to `recommended` until confirmed. |

## 1. Data (`requirements.json`, workflow mode)

Additive; `schemaVersion` stays `"1.0"` (no existing field changes meaning).

```jsonc
"scopeMode": "workflow",
"mapLabel": "IMDA roadmap pillar",          // optional: client's own grouping column
"workflows": [
  { "id": "WF-001", "state": "as-is", ... },   // unchanged
  { "id": "WF-002", "state": "to-be", "name": "Order pipeline",
    "label": "confirmed", "source": "PO brief, System 1",
    "trigger": "...", "exceptions": [...],      // as today
    "steps": ["Order In", "Pack", "Pack Review", "Storing", "Shipped"],
    "branches": [{ "from": "Pack", "to": "Short-pack alert", "label": "can't fulfil" },
                 { "from": "Pack Review", "to": "Pack", "label": "mismatch" }],
    "replaces": ["WF-001"] },                   // optional, as-is it improves
  { "id": "WF-003", "state": "to-be", "name": "Custom order and vendor procurement",
    "sub": { "startsAt": "WF-004:Order received", "rejoins": "WF-002",
             "share": "about 20% of orders" }, ... }
],
"systems": [
  { "id": "SYS-001", "name": "Warehouse operations",
    "purpose": "One line a PO would say.", "map": "Warehouse Automation",
    "label": "confirmed", "source": "...",
    "workflows": ["WF-002"],                    // first = main, rest = sub
    "features": ["FEAT-001", "FEAT-002", "FEAT-003"] }
],
"features": [
  { "id": "FEAT-001", "name": "Order pipeline & stage engine",
    "does": "One line in the client's words.",
    "label": "confirmed", "source": "...",
    "steps": ["WF-002:Order In", "WF-002:Pack"],   // ["*"] = every step (login, shell)
    "requirements": ["FR-001"] }
]
```

- In workflow mode, to-be workflow `steps` are short step names (2–5 words),
  not sentences; as-is workflows keep today's sentence steps.
- A branch `to` is either a new step (drawn as a side exit) or an existing
  step of the same workflow (drawn as a loop back).
- `SYS-` and `FEAT-` join the ID registers: three digits, stable across
  re-runs, never renumbered.
- A feature may point at steps in another system's workflow
  (e.g. earmarking touches the custom-order sub-flow).

## 2. `requirements.md`

Frontmatter gains `scopeMode: workflow` (checked against the JSON like
`status`). Parts 1–5 and their `## Part N` headings are unchanged. Two
additions in workflow mode:

**Start here** — one quoted line under the title:
`> **Product owner? Start here:** [To-be scope](#to-be-scope) shows the systems, workflows and features we propose to build. Items marked ⚠ are our draft; tell us in chat what to change.`

**To-be scope** — in Part 2, after the as-is workflows, replacing the old
"to-be capabilities" prose. Written only by the `scope` script, between
`<!-- scope:start -->` and `<!-- scope:end -->`:

~~~markdown
### To-be scope

What we propose to build: four systems, each shown as its workflows and then the features that serve them.

| System | Purpose | IMDA roadmap pillar |
| --- | --- | --- |
| Warehouse operations | <whole purpose line> | Warehouse Automation |

### Warehouse operations

<purpose>. Replaces today's "Order to invoice today".

**Main workflow: Order pipeline**

> ⚠ We drafted this — please confirm          ← only when label ≠ confirmed

```mermaid
flowchart LR
  ...generated from steps + branches...
```

**Sub-workflow: Custom order and vendor procurement** — starts at Order received, rejoins Order pipeline · about 20% of orders

| Feature | What it does | Where in the workflow |
| --- | --- | --- |
| Short-pack alert | ... | Short-pack alert |
| Order intake & quotation entry | ... | Order received → Quote; Flag as custom → Price cost-plus (in Custom order and vendor procurement) |
| One login, role-based screens | ... | every step |
~~~

Rendering rules: no IDs anywhere in the section; `|` inside any table cell
is escaped as `\|`; steps of one workflow are
joined with `→`; steps in a workflow outside the system are suffixed
`(in <workflow name>)`; the systems table carries the whole purpose line;
`mapLabel` column only when `mapLabel` is set; a feature or system with
`label ≠ confirmed` gets the same ⚠ line.

**FR table** — in workflow mode the Part 3 FR table has a last column
`Feature` holding the feature name(s) whose `requirements` list the FR, or
`—` for FRs not in scope `in`. The agent writes it; the validator checks it.

Classic mode: the md is exactly today's.

## 3. `scope` script

```
node scripts/scope.mjs --json requirements.json --md requirements.md
python3 scripts/scope.py --json requirements.json --md requirements.md
```

- Reads the JSON, renders the To-be scope section, replaces the text between
  the markers in place. On first run it inserts the section just before
  `## Part 3` (the end of Part 2; at QUICK depth, which has no Part 2, the
  end of Part 1); markers the agent moved stay where they are. Inserts or
  refreshes the Start here line under the `# ` title.
- Classic mode: removes the markers and their content if present, else no-op.
- Refuses (non-zero, one line per problem) when the JSON fails the scope
  checks in §5 — it never draws a broken scope.
- Mermaid node ids are `n0, n1, …` in first-appearance order, so output is
  deterministic.

Flow change in SKILL.md: step 7 **Write** becomes "write requirements.json
and requirements.md, then run `scope` (workflow mode)"; step 8 validates as
today.

## 4. Interview and re-run

- Step 2 asks depth and scope mode together. Recommend `workflow` when the
  input already talks in systems/modules or a proposal will be sent; else
  `classic`.
- Workflow mode adds one interview group after workflows: systems, to-be
  workflows (steps + exits), features per system. Draft from evidence first,
  label `recommended` what the client has not said, pair each
  `recommended` item with an open question (as for FRs today).
- Every in-scope FR must land in a feature; FRs that fit nowhere are a
  question for the human, not a new feature invented silently.
- Re-run: switching `classic → workflow` keeps all IDs and adds the scope;
  switching back removes `systems`, `features` and `scopeMode` from the JSON
  and the To-be scope section from the md; to-be workflows stay, as classic
  allows them today.

## 5. Validation (`validate.mjs` and `validate.py`, identical findings)

New module `scripts/lib/scope-checks.mjs` (checks.mjs stays under the size
gate) plus the matching Python functions.

| Rule | Finding |
| --- | --- |
| `scopeMode` is `workflow` or `classic` when present | `scopeMode must be workflow\|classic` |
| md frontmatter `scopeMode` equals JSON (absent = classic) | `md: scopeMode does not match json` |
| workflow: `systems` and `features` non-empty; classic: both absent | `scopeMode workflow needs systems and features` / `systems/features only in workflow mode` |
| *Rules below apply in workflow mode only.* | |
| each system lists ≥1 to-be workflow id; first is its main | `SYS-001: needs a to-be workflow` |
| each to-be workflow belongs to exactly one system | `WF-005: belongs to no system` / `… to SYS-001 and SYS-003` |
| each feature listed by exactly one system | `FEAT-009: listed by no system` |
| feature `steps` resolve to a step or branch target of a to-be workflow, or are `["*"]` | `FEAT-002: unknown step WF-002:Short-pack` |
| branch `from` is a step or an earlier branch target of its workflow | `WF-002: branch from unknown step Packing` |
| `replaces` lists as-is workflow ids | `WF-002: replaces unknown as-is workflow WF-009` |
| each feature has ≥1 step (or `["*"]`) | `FEAT-001: needs at least one step` |
| `sub.startsAt` resolves; `sub.rejoins` is a to-be workflow | `WF-003: sub.startsAt unknown` |
| every FR with scope `in` is in some feature's `requirements` | `FR-020: in scope but in no feature` |
| feature `requirements` ids exist | dangling reference (existing message) |
| system and feature names unique (case-insensitive) | `duplicate feature name: Invoice` |
| to-be workflow, system and feature `label` (legal) + `source` present; `recommended` needs an open question whose `affects` lists it | `SYS-001: missing source` / `FEAT-001: illegal label "maybe"` / `FEAT-004: recommended without a paired open question` |
| no tech words in system/feature names: API, database, microservice, backend, frontend, server, endpoint, schema, PWA, cloud | `FEAT-007: name uses a tech word (API)` |
| md To-be scope present iff workflow; equals `scope` output; contains no `SYS-`/`FEAT-`/`WF-` ids | `md: To-be scope is stale — run scope` |
| workflow: FR table `Feature` column matches the JSON | `md: FR-004 Feature column says X, json says Y` / `md: FR table has no Feature column` |

Existing check adjusted: "every id appears in requirements.md" skips to-be
workflow ids in workflow mode, since the To-be scope section names them
instead (D8). `SYS-`/`FEAT-` ids are valid targets for open-question
`affects` but are never required in the md.

## 6. Fresh-eyes review (`references/review.md`)

One new item:

> 8. **Unbuilt steps**: list to-be workflow steps that no feature points at.
> For each, is it work nobody has priced (add it to a feature, or raise a
> question) or a person's manual act (fine as is)?

Fallback line: "No subagent available (e.g. Claude.ai) → run this checklist
yourself and write `Review: self-reviewed, no fresh eyes available` in the
Part 5 readiness report."

Item 2 is widened from FRs to names: "does any FR, system or feature name
prescribe a technology or architecture?". Items 1 (unsupported `confirmed`)
and 7 (traceability spot-check) already apply to systems and features as
written.

## 7. Handoff

`requirements.json` with `scopeMode: workflow` carries `systems`, `features`
and to-be workflows. Spec 2 makes estimate read `features` as the priced
units. In this spec `new-lead`, `analyze-requirements`, `estimate` and
`proposal` are not changed; classic leads behave exactly as today.

## 8. Testing (RED first, per rule)

- Fixtures: `requirements-workflow-pass.json/.md` — a trimmed Sin Kowa v2
  (2 systems, 1 sub-workflow, 5 features, 1 `recommended` workflow, 1
  cross-system step); `requirements-workflow-fail.json` — one violation per
  §5 rule.
- `scope-checks.test.mjs`: one failing case per §5 rule, then pass.
- `scope.test.mjs`: render the pass fixture → equals the fixture md section;
  re-run is idempotent; classic removes the section; refuses on a bad scope.
- `python-parity.test.mjs`: extend — identical findings on the workflow fail
  fixture; byte-identical `scope` output.
- Existing classic fixtures pass unchanged (`npm test` from repo root).
- Code-size gates as for the rest of the repo.

## Out of scope

- Estimate, proposal, pages, currency — specs 2 and 3.
- An HTML scope page (D6).
- Citing by name instead of ID across skills.
- Any change to classic mode output.
