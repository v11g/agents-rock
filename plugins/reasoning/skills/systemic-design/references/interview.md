# Evidence interview

When a framework's stopping rule does not fire, the evidence a human holds
is often what's missing. Ask for it before stopping short.

## Trigger

All three must hold for the interview to run.

1. The framework has run and its stopping rule (or test) has not fired,
   or fired only by naming missing evidence — an empty level, an
   unevidenced link, a `root_candidate`, a chain that stopped short.
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
| Confirms an assumption | that assumption's status becomes `confirmed` | re-run |
| Don't know | `open_questions` | never ask about that gap again |
| Stop | nothing | emit now, stating "stopped on request" |

A re-run is the same framework over more evidence, not a second framework.
After each re-run, rewrite the saved file per `references/contract.md`
Saving, keeping every existing id.

| Situation | Handling |
| --------- | -------- |
| Answer contradicts existing evidence | Keep both, and name the contradiction in `open_questions`. |
| Answer meets another class's definition in `problem-router` — in `problem-solving`, recurrence (`complex`) or an actor adapting to fixes (`complex-adaptive`); in `systems-thinking`, only `complex-adaptive`; in `systemic-design`, `simple` or `ambiguous` | End the interview and emit. In `systems-thinking`, name `systemic-design` as the next run; elsewhere, recommend re-running `problem-router`. Do not start a second framework. |
| Human asserts "the cause is X" | Record as `interview` evidence: "the human believes X". It supports a cause only if an observation ties X to the symptom. |
| Human rejects the question to ask something | Answer in chat, then re-ask the same question. The round does not count. |
| Human rejects the question with no message | Treat as Stop. |

## End

The loop ends when the stopping rule fires, no askable gap remains, the
human picks Stop, an answer meets another class's definition, or round 6
completes. Say in the output which one ended
it.
