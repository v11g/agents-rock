# Evidence Interview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a framework's stopping rule does not fire and a human is present, `problem-solving` and `systems-thinking` ask for the missing evidence one question at a time instead of stopping short.

**Architecture:** One protocol file, `references/interview.md`, copied byte-identical into both skills. Each `SKILL.md` gains one Process step (4b) that sends the run into that protocol and back to step 3. No framework file, no contract file, and nothing in `problem-router` changes.

**Tech Stack:** Markdown skill prose; `claude plugin eval` (prompt.md + graders/*.md).

**Spec:** `docs/superpowers/specs/2026-09-25-evidence-interview-design.md`

All paths below are relative to the worktree root
`.claude/worktrees/interview-evidence/`. Run every command from there.

## Global Constraints

- `plugins/reasoning/.claude-plugin/plugin.json` version: `0.2.0` → `0.3.0`.
- The two `references/interview.md` copies are byte-identical (`cmp` exits 0).
- `references/contract.md` in every skill is unchanged.
- `problem-router` is unchanged.
- One question per round; cap 6 rounds.
- Gate: each case ≥ 0.85 at `--runs 3`. Full suite ≥ 16/18; only `routing-thin-input-provisional` and `st-causal-loop-unclosed` may stay red.
- Every eval run: `--no-publish --trust-plugin`. Full-suite runs go in the background (Bash caps at 10 min; a full run is ~60 min, ~$13).
- Commits: Conventional Commits, no AI attribution trailers. Never push — a `plugin.json` bump on `main` publishes to npm.

## Review Focus

The evals check the first question only. These five conditions reach no
automated test; Task 4's manual run pins each one with a scripted answer.

1. Answer contradicts earlier evidence → both kept, contradiction named, confidence lowered.
2. Human asserts "the cause is X" → recorded as the human's belief, never labelled `root` without an observation tying X to the symptom.
3. Question rejected with no message → treated as Stop; output says "stopped on request".
4. Answer reveals recurrence → interview ends, output recommends re-running `problem-router`, no second framework.
5. Round 6 completes with the stopping rule still unfired → output names the cap as the reason it ended.

---

### Task 1: Spike — what a headless eval sees

Three facts are unknown and decide how Task 2's graders are written: what
`AskUserQuestion` does in a headless eval run, whether an `llm` judge sees
tool-call inputs, and whether `tool_used` accepts `input_match`.

**Files:**
- Create (throwaway, deleted in Step 4): `plugins/reasoning/evals-spike/ask-probe/prompt.md`, `plugins/reasoning/evals-spike/ask-probe/graders/{called,judge-sees-input,input-match}.md`
- Modify: this plan's "Task 1 findings" block below

**Interfaces:**
- Produces: the "Task 1 findings" block, which selects grader variant A or B in Task 2.

- [ ] **Step 1: Write the probe case**

`plugins/reasoning/evals-spike/ask-probe/prompt.md`:
```markdown
---
max_turns: 4
allowed_tools: [AskUserQuestion]
---

Call the AskUserQuestion tool exactly once with the question "Which colour?"
and the options "Red" and "Blue". Then report in one line what the tool
returned to you.
```

`graders/called.md`:
```markdown
---
type: tool_used
tool: AskUserQuestion
min: 1
---

Probe: was the call recorded at all?
```

`graders/judge-sees-input.md`:
```markdown
---
type: llm
weight: 1
---

PASS if you can see that an AskUserQuestion call was made whose options
were "Red" and "Blue". FAIL if you cannot see the tool call's inputs. In
your rationale, state exactly what you can see: only the final message, or
tool calls with their inputs.
```

`graders/input-match.md`:
```markdown
---
type: tool_used
tool: AskUserQuestion
input_match: "Blue"
min: 1
---

Probe: does input_match accept a plain substring?
```

- [ ] **Step 2: Run it once, keeping the transcript**

Run:
```bash
claude plugin eval plugins/reasoning --eval-dir evals-spike --runs 1 \
  --no-publish --trust-plugin --keep-temp --json /tmp/claude-1000/ask-probe.json
```
Expected: finishes in under 5 minutes, cost under $1. If it has not
returned in 10 minutes, `AskUserQuestion` hangs headless — record that.
The Bash tool's timeout ends the run; don't `pkill -f` a pattern, it also
matches the shell that issued it.

- [ ] **Step 3: Record findings**

From the JSON and the kept temp dir, fill in:

```
Task 1 findings
- AskUserQuestion headless:  error <text> | auto-answer <text> | hang
- called.md:                 pass | fail
- judge-sees-input.md:       pass (sees tool inputs) | fail (last message only)
- input-match.md:            pass | fail | schema error <text>
- Variant for Task 2:        A if judge-sees-input passed, else B
```

Recorded 2026-09-28 (claude 2.1.283, $0.10):

```
Task 1 findings
- AskUserQuestion headless:  absent — not in the tool list even when named
                             in allowed_tools; ToolSearch: "No matching
                             deferred tools found". No hang, no error.
- called.md:                 fail (0 calls, both arms)
- judge-sees-input.md:       untestable (no call made); llm grader config
                             shows `focus: last_message` as its default
- input-match.md:            schema accepted; untestable (no call made)
- Variant for Task 2:        neither A nor B holds as written — see ledger
```

- [ ] **Step 4: Delete the probe and commit the findings**

```bash
rm -rf plugins/reasoning/evals-spike
git add docs/superpowers/plans/2026-09-28-evidence-interview.md
git commit -m "docs(reasoning): record headless AskUserQuestion probe"
```

If `AskUserQuestion` hangs headless, stop here and report to the human:
Task 2's cases would hang too, and the verification design needs rework.

---

### Task 2: RED — two failing eval cases

Amended after Task 1: evals cannot see `AskUserQuestion`, so they grade the
headless form — the first `open_questions` entry (spec decision 7, amended).

**Files:**
- Create: `plugins/reasoning/evals/ps-interview-first-question/prompt.md` and `graders/*.md` (5 files)
- Create: `plugins/reasoning/evals/st-interview-first-question/prompt.md` and `graders/*.md` (5 files)

**Interfaces:**
- Produces: two case names that Task 3 re-runs with `--case '*-interview-first-question'`.

- [ ] **Step 1: Write the `ps` prompt**

`plugins/reasoning/evals/ps-interview-first-question/prompt.md`:
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the problem-solving skill with rca on this: at 09:15 on Monday our
transfer API started returning 504 Gateway Timeout for about 85% of
requests. Requests hang before they fail.
```

- [ ] **Step 2: Write the `st` prompt**

`plugins/reasoning/evals/st-interview-first-question/prompt.md`:
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the systems-thinking skill with the iceberg model on this. On-call
engineers keep getting paged overnight for the same disk-full alert. It
has fired on 11 of the last 14 nights.
```

- [ ] **Step 3: Write the two deterministic graders (both cases, identical)**

`graders/skill-fired.md`:
```markdown
---
type: tool_used
tool: Skill
min: 1
---

The skill must actually be invoked, not merely described.
```

`graders/look-in-present.md`:
```markdown
---
type: regex
pattern: 'look in'
flags: i
match: contains
target: last_message
---

The run is headless and the stopping rule cannot fire on this input, so
the first open question must carry its source hint.
```

- [ ] **Step 4: Write the three LLM graders**

The `{GAP}` line differs per case: `ps` → "RCA's `contributing` (or
deeper) layer is empty: the input names the 504 but nothing about why
upstream is slow."; `st` → "the iceberg's `structures` level is empty: the
input gives an event and a pattern, nothing about what produces them."

`graders/targets-gap.md`:
```markdown
---
type: llm
weight: 1
---

{GAP}

PASS if the first entry in `open_questions` is a question asking for
evidence that would fill that gap, and uses details from this input (its
figures, times, or components) rather than generic wording.
FAIL if it asks about something the input already answers, or is generic
enough to fit any incident, or if `open_questions` is absent.
```

`graders/source-hint.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the first entry in `open_questions` includes a "Look in" line (or
its equivalent in another language) naming where the evidence lives — a
log, dashboard, trace, ticket, or owner — without saying what the human
should expect to find there.
FAIL if the line is missing, or if it names an expected finding or cause
(e.g. "check whether the DB pool is exhausted").
```

`graders/options-from-input.md`:
```markdown
---
type: llm
weight: 1
---

PASS if the first entry in `open_questions` offers two concrete answer
options, each drawn from details in the input, that are dimensions to
discriminate along (for example transaction type, node, night of week)
rather than guessed causes.
FAIL if there are no options, if either option is generic, or if an
option asserts a cause (for example "a memory leak", "a bad deploy").
```

- [ ] **Step 5: Run both cases and verify RED**

Run:
```bash
claude plugin eval plugins/reasoning --case '*-interview-first-question' \
  --runs 1 --ablation none --no-publish --trust-plugin
```
Expected: `skill-fired` passes; `look-in-present` fails in both cases (the
skills do not write source hints yet). Under $2 total.

If `look-in-present` passes in either case, the grader does not test the
new behaviour — tighten it before continuing.

- [ ] **Step 6: Commit**

```bash
git add plugins/reasoning/evals/ps-interview-first-question plugins/reasoning/evals/st-interview-first-question
git commit -m "test(reasoning): add failing evidence-interview cases"
```

---

### Task 3: GREEN — the protocol and the Process step

**Files:**
- Create: `plugins/reasoning/skills/problem-solving/references/interview.md`
- Create: `plugins/reasoning/skills/systems-thinking/references/interview.md` (copy)
- Modify: `plugins/reasoning/skills/problem-solving/SKILL.md` — Process (after step 4, ~line 96), Failure modes (end of list, ~line 157)
- Modify: `plugins/reasoning/skills/systems-thinking/SKILL.md` — Process (after step 4, ~line 99), Failure modes (end of list, ~line 160)
- Modify: `plugins/reasoning/skills/problem-solving/README.md`, `plugins/reasoning/skills/systems-thinking/README.md` — one line each
- Modify: `plugins/reasoning/.claude-plugin/plugin.json` — version

**Interfaces:**
- Consumes: the two case names from Task 2.
- Produces: `references/interview.md`, which step 4b in both `SKILL.md` files names.

- [ ] **Step 1: Write the protocol**

`plugins/reasoning/skills/problem-solving/references/interview.md`:
````markdown
# Evidence interview

When a framework's stopping rule does not fire, the evidence a human holds
is often what's missing. Ask for it before stopping short.

## Trigger

All three must hold for the interview to run.

1. The framework has run and its stopping rule has not fired.
2. You can name the specific gap blocking that rule — a field, layer, or
   link, e.g. "`rca.contributing` is empty".
3. `AskUserQuestion` is available — the same test step 2 applies before
   asking the human to pick a framework. If a call errors, the run is
   headless from that point.

**Headless.** If 1 and 2 hold but 3 does not, stop short, and make the
first `open_questions` entry the question round 1 would have asked — the
question, its `Look in:` line, and its two options, without the fixed
exits. If 1 or 2 does not hold, emit as before.

## One round

Ask exactly one question with `AskUserQuestion`.

- **Question** — aimed at the one named gap, using this problem's details:
  its figures, times, components. Not generic wording.
- **Source hint** — the question text's second line, `Look in: …`, naming
  where the evidence lives: a log, dashboard, trace, ticket, or the person
  who owns it. Never what to expect there. "Look in: the gateway access
  log" passes. "Check whether the DB pool is exhausted" fails — it asserts
  a cause.
- **Options** — two concrete options drawn from the input: dimensions to
  discriminate along (transaction type, node, region), not guessed causes.
  Then two fixed exits: `Don't know` and `Stop, analyze now`. Free text and
  pasted logs arrive through the tool's built-in Other.

## Answers

| Answer | Record as | Then |
| ------ | --------- | ---- |
| Content | `evidence`, type `interview`, ref `round N` | re-run the framework from step 3 |
| Pasted log or figures | `evidence`, type `log` or `metric` | re-run |
| Picked option | `evidence`, type `interview`, ref `round N` | re-run |
| Don't know | `open_questions` | never ask about that gap again |
| Stop | nothing | emit now, stating "stopped on request" |

A re-run is the same framework over more evidence, not a second framework.

| Situation | Handling |
| --------- | -------- |
| Answer contradicts existing evidence | Keep both, name the contradiction, lower confidence. |
| Answer shows recurrence (`complex`) or an actor adapting to fixes (`complex-adaptive`) | End the interview, emit, and recommend re-running `problem-router`. Do not start a second framework. |
| Human asserts "the cause is X" | Record as `interview` evidence: "the human believes X". It is `root` only if an observation ties X to the symptom. |
| Human rejects the question to ask something | Answer in chat, then re-ask the same question. The round does not count. |
| Human rejects the question with no message | Treat as Stop. |

## End

The loop ends when the stopping rule fires, no askable gap remains, the
human picks Stop, or round 6 completes. Say in the output which one ended
it.
````

- [ ] **Step 2: Copy it and check the copies match**

Run:
```bash
cp plugins/reasoning/skills/problem-solving/references/interview.md \
   plugins/reasoning/skills/systems-thinking/references/interview.md
cmp plugins/reasoning/skills/{problem-solving,systems-thinking}/references/interview.md && echo identical
```
Expected: `identical`

- [ ] **Step 3: Add step 4b to both `SKILL.md` files**

In each file, insert directly after the step-4 paragraph and before
`5. Emit the result per Output contract below.`:
```markdown
4b. If the stopping rule has not fired, follow
   `references/interview.md`. With a human present it returns you to
   step 3 with new evidence; headless, it shapes the first open question.
   Then continue to step 5.
```

- [ ] **Step 4: Add two failure modes to both `SKILL.md` files**

Append to the end of each `## Failure modes` list:
```markdown
- **Asking without naming the gap.** An interview question must fill a
  specific field, layer, or link the stopping rule is blocked on. A
  question that fills nothing named is an open-ended interview — cut it.
- **A source hint that names what to expect.** `Look in:` names where the
  evidence lives. Naming what the human will find there previews a cause
  the evidence hasn't supported.
```

- [ ] **Step 5: Add one README line to each skill**

In `problem-solving/README.md`, after the paragraph ending "once the human
has confirmed the route.", add:
```markdown
When the evidence runs out before the framework's stopping rule fires and
you're there to answer, it asks you for the missing piece — one question
at a time, each naming where to look — instead of stopping short.
```

In `systems-thinking/README.md`, add the same paragraph after its
invocation paragraph (the one showing `/reasoning:systems-thinking`).

- [ ] **Step 6: Bump the version**

In `plugins/reasoning/.claude-plugin/plugin.json`: `"version": "0.2.0"` →
`"version": "0.3.0"`.

- [ ] **Step 7: Run the two cases at the gate**

Run:
```bash
claude plugin eval plugins/reasoning --case '*-interview-first-question' \
  --runs 3 --no-publish --trust-plugin
```
Expected: both cases ≥ 0.85. ~$5, ~20 min — run in the background if it
nears the 10-minute Bash cap.

If a case is below 0.85, re-run that case alone with `--keep-temp` to read
the judge's rationale, fix the protocol prose (not the grader), and re-run
that case only.

- [ ] **Step 8: Commit**

```bash
git add plugins/reasoning/skills plugins/reasoning/.claude-plugin/plugin.json
git commit -m "feat(reasoning): interview for missing evidence"
```

---

### Task 4: VALIDATE — full suite and the manual loop

**Files:**
- Modify: none, unless a regression needs a fix.

- [ ] **Step 1: Full suite in the background**

Run with `run_in_background`:
```bash
claude plugin eval plugins/reasoning --runs 3 --no-publish --trust-plugin \
  --json /tmp/claude-1000/full.json > /tmp/claude-1000/full.log 2>&1
```
The harness notifies when the background command exits; don't poll. Read
scores from `full.json`, not the log — the log buffers.

Expected: ≥ 16/18 cases at ≥ 0.85. Only `routing-thin-input-provisional`
and `st-causal-loop-unclosed` may be red. Any other red is a regression:
diagnose it with a single `--case` re-run before touching anything.

- [ ] **Step 2: Manual interactive run**

In an interactive Claude Code session with the worktree's plugin loaded,
run:
```
/reasoning:problem-solving rca "At 09:15 on Monday our transfer API started returning 504 Gateway Timeout for about 85% of requests. Requests hang before they fail."
```
Answer the questions with this script, one answer per round, and tick
each check:

| Round | Your answer | Check |
| ----- | ----------- | ----- |
| 1 | Other: "gateway log shows upstream payment-svc at 30s latency" | recorded as `evidence`, ref `round 1`; RCA re-runs and a layer past `immediate` fills |
| 2 | Other: "payment-svc latency was normal, 40ms" | contradiction with round 1 named; confidence lowered (Review Focus 1) |
| 3 | Other: "I'm sure the cause is the new DB index" | recorded as "the human believes…"; not labelled `root` (Review Focus 2) |
| 4 | Other: "this happens every Monday" | interview ends; output recommends re-running `problem-router` (Review Focus 4) |

Then start a fresh run and reject the first question with no message →
output says "stopped on request" (Review Focus 3). Start a third run and
answer six rounds with "Other: nothing new in the logs" → output names the
6-round cap as the reason it ended (Review Focus 5). Also check that
every question offers `Don't know` and `Stop, analyze now` — no eval can
see the fixed exits.

- [ ] **Step 3: Commit any fixes, then report**

If Steps 1–2 needed prose fixes:
```bash
git add plugins/reasoning/skills
git commit -m "fix(reasoning): <what the manual run caught>"
```
Report the full-suite score table and the manual checklist to the human.
Do not push.
