# Reasoning plugin — spec 4: linked, saved output format

Source PRD: `docs/reasoning-skill.md`. Earlier specs:
`2026-09-21-reasoning-plugin-design.md`, `2026-09-22-systems-thinking-design.md`,
`2026-09-25-evidence-interview-design.md`, `2026-09-28-systemic-design-design.md`.

This is the first of two slices for the visual board. It changes what the
four skills emit and where they save it. It adds no code. The board itself
is spec 5 (`2026-09-29-reasoning-board-design.md`), which reads what this
slice writes.

## Slice boundary

| Spec | Contents | Status |
| ---- | -------- | ------ |
| 1–3 | four skills, contract, interview | merged (0.4.0) |
| 4 (this) | ids, `supports` links, always-saved files | designed |
| 5 | read-only React Flow board | designed |

Out of scope: board code, editing from the board, agent suggestions, an
"Ask agent" button, moving framework fields out of `contract.md`.

## Purpose

Today a result lives in chat, and nothing says which piece of evidence
backs which claim. The board needs both: a file it can watch, and links it
can draw.

```
before:  evidence: [log ci-run-4471]        why_chain: ["Deploys fail -> ..."]
         (which step does the log back? unknown)

after:   evidence: [{id: e1, ..., supports: [c1]}]
         why_chain: [{id: c1, text: "Deploys fail -> ..."}]
```

## Decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Two specs: format first, board second | Human's call. The format is useful without the board, and the board needs a stable format to build on. |
| 2 | Every item gets an `id`; evidence and assumptions carry `supports: [ids]` | The board draws evidence → claim arrows from these. No other link direction is added. |
| 3 | Every run is saved, always, and rewritten after every interview answer | Human's call: the board is live. "Only when asked" would make the skill decide when to write. |
| 4 | Files go under `~/.reasoning/problems/`, outside every repo | Human's call. Skills often run outside a repo, and problems can hold sensitive details; a home folder cannot be committed by accident. |
| 5 | One folder per problem, one numbered file per skill run | A hand-off chain (router → systems-thinking → systemic-design) keeps every run. Each file still holds exactly one framework block. |
| 6 | A failed or refused write never blocks the run | Headless and eval runs cannot write outside the project. The analysis still lands in chat; the skill says once that the file was not saved. This replaces an environment-variable off switch. |
| 7 | Version 0.4.0 → 0.5.0 | The contract changes shape. |

## Contract changes

All edits land in `references/contract.md`, which stays byte-identical
across the four skills.

### Ids

| Item | Prefix | Example |
| ---- | ------ | ------- |
| `evidence` entry | `e` | `e1` |
| `assumptions` entry | `a` | `a1` |
| `open_questions` entry | `q` | `q1` |
| any item inside the framework block | `c` | `c1` |

Ids are unique within one file, numbered in order of first appearance, and
never reused within a run. An item keeps its id when the file is rewritten
after an interview answer, so the board does not reshuffle.

### Framework block items

One rule covers every block, including blocks added later:

- An item that is a string today becomes `{id, text}`.
- An item that is an object today (`{step, owner_role, when, signal}`,
  `{from, to, assumption}`, `{move, owner_role, when}`, …) gains `id` and
  keeps its fields.
- A field that refers to another item (`links.from`, `links.to`, a
  `create` entry's target, a leverage point's element) holds that item's
  id, not its text.
- A cause the framework labels `root` or `root_candidate` carries it as
  `status`.

No per-framework table is added. A new framework follows the rule above
without a contract edit beyond its own block row.

### Links

```yaml
evidence:
  - id: e1
    type: metric
    ref: "85% transfer errors from 09:15"
    supports: [c1]
assumptions:
  - id: a1
    statement: Connection pool size is fixed.
    status: unverified
    supports: [c4]
open_questions:
  - id: q1
    text: |
      Was pool size changed before Monday?
      Look in: the deploy log
    blocks: [c4]
```

- `supports` lists the claim ids an evidence or assumption entry backs. It
  may be empty; an entry that backs nothing is a finding.
- `blocks` lists the claim ids an open question holds back. It is what the
  board draws as a gap.
- The guardrail tests do not change. "Name the `evidence` entry that ties
  this cause to the symptom" is now answered by an id in `supports`.

### Rendering

In chat, ids render as small tags — `[e1]`, `[c4]` — after the item they
label, so the human can refer to them. Headings and diagrams are otherwise
unchanged.

The saved-file paragraph changes from "on request, in the directory the
human names" to the Saving section below. The rule "no second JSON file"
stays.

## Saving

```
~/.reasoning/problems/<YYYY-MM-DD>-<slug>/<NN>-<skill>.md

<YYYY-MM-DD>  the date the problem folder was created
<slug>        the problem in 2–5 kebab-case words; on a clash, append -2, -3
<NN>          01, 02, … — the next free number in the folder
<skill>       problem-router | problem-solving | systems-thinking | systemic-design
```

| Event | Write |
| ----- | ----- |
| A run starts with no hand-off | create a new problem folder |
| A run starts from a hand-off | reuse the folder the hand-off names |
| The framework's first pass completes, before any interview round | write `<NN>-<skill>.md` |
| An interview answer changes the result | rewrite the same file, ids kept |
| The human re-runs a skill on the same problem | next `<NN>`; the old file stays |
| The result is emitted | rewrite the same file, ids kept |

The file layout is unchanged: YAML front-matter holding the six core fields
and one block, then the markdown body that chat showed.

Every hand-off (router → skill, systems-thinking → systemic-design,
problem-solving → systems-thinking) names the problem folder path, so the
receiving skill writes into it.

### When the write fails

If the write is refused or errors, the skill continues in chat, says once
"not saved: <reason>", and does not retry within the run. This is the
expected path in headless and eval runs.

### Permission

`~/.reasoning/` is outside the project, so Claude Code asks before each
write. Spec 5's `/reasoning:board` offers, on first run, to add
`Read(~/.reasoning/**)` and `Edit(~/.reasoning/**)` to the human's
settings. Until then, the human approves writes one by one or declines them
(the failed-write path above).

## Evals

| Case | Checks |
| ---- | ------ |
| `format-ids-and-supports` | chat shows `[e1]`-style tags; every evidence entry has a `supports` list |
| `format-root-candidate-status` | an unsupported cause carries `status: root_candidate` |
| `format-unsaved-continues` | a refused write yields "not saved" once, and the analysis still completes |
| `format-handoff-folder` | a router hand-off names the problem folder path |

Existing regex graders that match block text are checked against the new
`{id, text}` shape before the phase runs; any that break are rewritten, not
loosened.

## Verification

1. Baseline: full suite on 0.4.0, `--ablation none`.
2. Contract edit + the four new cases RED.
3. Skill edits (contract, interview "rewrite after each round", hand-off
   lines) → the four new cases GREEN.
4. Full suite; no case drops more than its recorded noise band.
5. Manual: one interactive run with the permission rule in place; the file
   appears and is rewritten after an interview answer.
