# Reasoning plugin — evidence interview

Specs 1 and 2: `docs/superpowers/specs/2026-09-21-reasoning-plugin-design.md`,
`docs/superpowers/specs/2026-09-22-systems-thinking-design.md`.

Today, when a framework's stopping rule does not fire for lack of evidence,
`problem-solving` and `systems-thinking` stop short and list what evidence
would help. A human is often right there and holds that evidence. This slice
makes both skills ask for it, one question at a time, before stopping.

## Slice boundary

| In | Out |
| -- | --- |
| `problem-solving`, `systems-thinking` interview loop | `problem-router` — its step-3 question test is unchanged |
| a shared `references/interview.md` per skill | per-framework interview sections |
| two new eval cases | a scripted multi-turn responder (the eval runner has none) |
| | the visual board (React Flow) — its own spec, later |

## Decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Scope: `problem-solving` + `systems-thinking` | Both run frameworks with stopping rules that can fail for lack of evidence. The router asks routing questions, not evidence questions. |
| 2 | One protocol file per skill, identical copies, same as `contract.md` | Keeps the nine framework files untouched. The framework's own stopping rule already says what is missing. |
| 3 | Questions are generated per run, never pre-written | Question = the framework's gap × the problem's details. RCA on a 504 outage asks about the `contributing` layer; iceberg on the same outage asks about `patterns`. |
| 4 | One question per round, cap 6 rounds | Matches `AskUserQuestion`'s shape; the cap bounds a run that keeps finding gaps. |
| 5 | Every question carries a one-line source hint | "Don't know" often means "don't know where to look". Without a hint the loop ends early and the run stops short anyway. |
| 6 | No contract change | The `interview` evidence type exists. Why the interview ended goes in the prose body; the six core fields never change. |
| 7 | Headless behaviour is unchanged | No human → stop short and name the gap, as today. |

## Protocol (`references/interview.md`)

### Trigger

All three must hold, else stop short as today:

1. The framework has run once and its stopping rule has not fired.
2. A specific gap blocking that rule can be named — a field, layer, or link
   (e.g. "`rca.contributing` is empty").
3. `AskUserQuestion` is available — the same test step 2 already applies
   before asking the human to pick a framework. If the call errors when
   made, treat the run as headless from that point.

### One round

Ask exactly one question with `AskUserQuestion`:

- **Question** — aimed at the one named gap, using this problem's details
  (its figures, times, components), not generic phrasing.
- **Source hint** — the question text's second line, "Look in: …", naming where the evidence
  lives: a log, dashboard, trace, ticket, or the person who owns it. It
  never names what the human should expect to find there. "Look in: the
  gateway access log" passes; "check whether the DB pool is exhausted"
  fails — it asserts a cause.
- **Options** — two concrete options drawn from the input: dimensions to
  discriminate along (transaction type, node, region), not guessed causes.
  Plus two fixed exits: "Don't know" and "Stop, analyze now". Free text,
  including pasted logs, arrives through the tool's built-in "Other".

### Answers

| Answer | Recorded as | Then |
| ------ | ----------- | ---- |
| Content | `evidence`, type `interview`, ref `round N` | re-run the framework from step 3 |
| Pasted log or figures | `evidence`, type `log` / `metric` | re-run |
| Picked option | `evidence`, type `interview`, ref `round N` | re-run |
| Don't know | `open_questions` | never ask about that gap again |
| Stop | — | emit now, stating "stopped on request" |

### End

A re-run is the same framework over more evidence, not a second
framework, so the one-framework-per-run guardrail does not fire.

The loop ends when the stopping rule fires, no askable gap remains, the
human picks Stop, or round 6 completes. The output names which of these
ended it.

### Edge cases

| Situation | Handling |
| --------- | -------- |
| Answer contradicts existing evidence | Keep both, name the contradiction, lower confidence. Never drop either silently. |
| Answer meets another class's definition in `problem-router` — recurrence (`complex`) or an actor adapting to fixes (`complex-adaptive`), e.g. "it happens every week" | End the interview, emit, and note that `problem-router` should be re-run. One framework per run still holds. |
| Human asserts "the cause is X" | Record as `interview` evidence: "the human believes X". It is `root` only if an observation ties X to the symptom — the root test is unchanged. |
| Human rejects the question to ask for clarification | Answer in chat, then re-ask the same question. The round does not count. |
| Human rejects the question with no message | Treat as Stop. |

## `SKILL.md` changes (both skills)

Each file is ~200 lines; the change stays small and the detail lives in
`references/interview.md`.

- **Process** — insert after the stopping-rule step:
  > 4b. If the stopping rule has not fired and `AskUserQuestion` is
  > available, follow `references/interview.md`, then return to step 3
  > with the new evidence. Otherwise continue to step 5.
- **Failure modes** — add two:
  - Asking without naming the gap the question fills.
  - A source hint that names what to expect, which previews a cause.

`README.md` in each skill gains one line saying the skill interviews when a
human is present. `plugin.json` goes `0.2.0` → `0.3.0`.

## Verification

`claude plugin eval` has no scripted responder, so evals check the first
question only. The multi-turn loop is checked by hand.

**Step 0 — spike (one case, < $1).** Run a case with `AskUserQuestion` in
`allowed_tools` and observe whether the headless call errors, hangs, or is
recorded. The result decides whether grader 1 below is usable as
`tool_used`, or must become an LLM grader over the transcript.

**New cases**, each with five graders:

| Case | Input |
| ---- | ----- |
| `ps-interview-first-question` | RCA named, thin outage input, `AskUserQuestion` allowed |
| `st-interview-first-question` | iceberg named, thin recurring-symptom input, `AskUserQuestion` allowed |

1. `tool_used: AskUserQuestion`
2. exactly one question in the call
3. the question targets a gap that blocks the framework's stopping rule
4. options include "Don't know" and "Stop"
5. the source hint names a source, not an expected finding

**Existing cases.** None of the 16 lists `AskUserQuestion` in
`allowed_tools`, so all take the headless branch and need no grader change.

**Order.** Spike → write the two cases and confirm they fail (RED) → edit
the skills → targeted `--case` runs until green → full suite in the
background.

## File layout

```
plugins/reasoning/
├── .claude-plugin/plugin.json                    0.3.0
├── skills/problem-solving/
│   ├── SKILL.md                                  +step 4b, +2 failure modes
│   ├── README.md                                 +1 line
│   └── references/interview.md                   new
├── skills/systems-thinking/
│   ├── SKILL.md                                  +step 4b, +2 failure modes
│   ├── README.md                                 +1 line
│   └── references/interview.md                   new, identical copy
└── evals/
    ├── ps-interview-first-question/              new
    └── st-interview-first-question/              new
```

## Definition of done

- Both new cases ≥ 0.85 at `--runs 3`.
- Full suite ≥ 16/18 at ≥ 0.85; only the two reds accepted in spec 2
  (`routing-thin-input-provisional`, `st-causal-loop-unclosed`) may stay red.
- The two `interview.md` copies are byte-identical.
- One manual interactive run of the 504 outage through RCA reaches at least
  one layer past `immediate`, or ends with a stated reason.
- Committed on a branch; not pushed — pushing a `plugin.json` bump to
  `main` publishes to npm.
