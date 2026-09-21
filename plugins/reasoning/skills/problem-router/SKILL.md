---
name: problem-router
description: Classify a problem and recommend which reasoning skill and framework fit it, then let the human decide. Use when a problem arrives without a clear shape — "why does this keep happening", "where do I even start", "is this a bug or something bigger" — or when the user asks which framework to apply. Recommends and stops; never runs the analysis itself.
---

# problem-router

You are executing the problem-router skill. A problem has arrived without a
chosen framework. Your job is to classify it, recommend a reasoning skill and
framework, and stop — the human decides, and the actual analysis happens in
whichever skill they route to.

## Purpose

Classify the problem, recommend where it should go, and stop there. Never
name a root cause, propose a fix, or run the framework yourself — that is
the job of the skill you route to, not this one.

## When to use / When not to use

Use this when a problem arrives with no framework attached and it isn't
obvious where it belongs: vague symptoms, "why does this keep happening",
"where do I even start", or a direct ask for which framework fits.

Don't use this when the problem already comes framed with a chosen
framework — "run a 5 Whys on this outage" or "do an RCA on ticket 4471"
names its own route. Send those straight to `problem-solving` and skip
routing.

## Inputs

- The raw problem text as the human wrote it.
- Any files the human points at (logs, tickets, docs). Read what's named;
  don't go hunting for more evidence than offered.

## Process

Follow these five steps in order. Classification comes before questioning —
asking first, before you've tried to classify, produces an open-ended
interview instead of a routing decision.

```
1. Extract what the input states — facts, actors, symptoms, history.
2. Classify provisionally: simple | ambiguous | complex | complex-adaptive.
3. Identify what would flip the class. Ask only questions that pass the
   step 3 test below — usually zero, at most 3.
4. Recommend: skill + framework + why + what was rejected and why.
5. Present the options and let the human confirm, override, or ask to
   classify only.
```

**The step 3 test.** Start from zero questions and make each one earn its
turn. Before asking a candidate question, write out — for yourself, not in
the output:

- the two classes its answer would decide between;
- the route each answer produces, as a skill plus a framework.

If both answers produce the same skill and the same framework, the question
fails the test. Drop it; do not ask it. If you can't write the two routes,
it fails too.

Then count the survivors, and expect a small number:

- **Zero** is the expected count when step 1's extraction already pins the
  class — narrow scope, one system, a clear symptom, no competing
  interpretation. A fully specified problem gets no questions.
- **One** is the expected count when exactly one fact is genuinely
  undetermined and would move the class (e.g., a symptom that could be
  one-off or recurring, and the input doesn't say which).
- **Two or three** requires that many genuinely live routing branches at
  once, which is rare — near-empty input, not a problem that merely leaves
  some details unstated. Three is a hard cap, never a quota to fill.

Questions that sharpen a picture you already have — how often, which users,
whether the value is nullable by design, what the fix should be — fail the
test by construction: they change nothing about where the problem goes.
They belong to the skill you route to, which will ask them with the
framework in hand. Don't interrogate a problem that already told you what
it is.

A question that fails the test is dropped silently. Don't list it in the
output as something you'd still want to know, and don't gather the dropped
ones into an aside — an inventory of questions you aren't asking reads as
asking them. The output carries the surviving questions and nothing else.

**Step 5's human choice**, phrased as a binding: present the candidate
frameworks with a recommendation and let the human choose. In Claude Code,
do this with the `AskUserQuestion` tool. Headless, with no human available
to ask: take the recommendation, record it as agent-selected and
unconfirmed, and proceed.

## Problem classes

| Class | Characteristics | Routes to |
| ----- | --------------- | --------- |
| simple | narrow scope, direct cause likely, few dependencies, low uncertainty | `problem-solving` — direct solve, RCA, 5 Whys, or PDCA |
| ambiguous | problem definition or user need unclear, solution space unclear | `problem-solving` — usually Double Diamond |
| complex | multiple actors, recurring, cross-functional dependencies, feedback loops, reappears after local fixes | `systems-thinking` |
| complex-adaptive | independent actors, system reacts to intervention, behaviour emerges over time, long-horizon change | `systems-thinking`, then `systemic-design` |

Thin input caps confidence, not honesty about the class. A two-line problem
statement can still get a provisional class — but the output must say the
class is provisional and name what's missing, rather than presenting it as
settled.

## Output contract

Emit the six core fields plus the `router` block — see
`references/contract.md` for the names and their definitions, along with
evidence types, assumption status, and confidence rules. Don't guess at
any of it here; the contract is the single source of truth for the field
set.

## Degradation

`complex` and `complex-adaptive` classify to `systems-thinking` and
`systemic-design`. Neither skill is built in this release.

When routing lands on one of these classes, say so plainly: the fitting
skill doesn't exist yet. Then offer the closest available option with its
limitation named — for example, recommend `problem-solving`'s RCA on a
recurring symptom, and state directly that RCA traces a causal chain and
will not surface the feedback loops a systems-thinking pass would find.

Naming the fallback framework is where this stops. Don't preview, hint at,
or hedge what that framework would probably conclude — no "would likely
land on X as the root," no floating a probable cause even provisionally.
The fallback's findings belong to the skill that runs it, not to the
router.

Never quietly downgrade the classification to fit what's built. A complex
problem stays classified as complex even though the router can only offer
a partial substitute — the human needs the honest class to know the
substitute is partial.

## Failure modes

- **Naming a root cause or proposing a fix.** A router that solves has
  skipped its own gate — that's `problem-solving`'s job, after hand-off.
- **Listing rejected frameworks without a reason each.** "Rejected:
  Double Diamond" is not a finding; "rejected Double Diamond — the problem
  is already well-defined, nothing to discover" is.
- **Presenting a class as settled when the input is two lines long.** Thin
  input means the class is provisional, and the output says so.
- **Emitting numeric confidence.** Confidence renders `low` / `medium` /
  `high` only — never a number like `0.84`.
- **Quietly downgrading a classification to match what's built.** See
  Degradation above.

## Examples

**Simple — clean classification, no questions needed**

Input: "Our checkout API throws a null pointer exception in
`OrderService.calculateTotal()` whenever a cart has zero items. Stack trace
attached, reproduces every time in staging."

Extraction: one function, one reproducible trigger, a stack trace as
evidence, no mention of recurrence across services or teams. Nothing about
this is ambiguous or cross-functional — the class is decidable from the
input alone, so step 3 asks zero questions.

Recommendation: `problem-solving`, framework `five_whys` (narrow scope,
causal chain looks linear, stack trace pins the immediate cause).
Rejected: `Double Diamond` — the problem is already well-defined, there's
nothing to discover or define; `RCA` — five-whys is enough for a single
reproducible trigger, RCA's fuller immediate/contributing/underlying/root
breakdown is more structure than this needs; `systems-thinking` — one
function, one service, no recurrence or cross-team dependency in evidence.

**Complex — degradation applies**

Input: "Every quarter, the same onboarding delays come back. We fix the
handoff between sales and provisioning, it's fine for a few weeks, then a
different team hits the same wall. This has happened three times across
two years with three different 'fixes'."

Extraction: recurring symptom, multiple actors (sales, provisioning, the
teams downstream), fixes that hold briefly then fail — a signature of
feedback loops rather than a single broken step.

Recommendation: class `complex`, which routes to `systems-thinking`.
`systems-thinking` is not built in this release. Closest available option:
`problem-solving`'s RCA, with the limitation named up front — RCA can map
one more iteration of the immediate/contributing/root chain, but it traces
a single causal path and will not surface the feedback loop that keeps
regenerating the delay across different teams. Rejected outright: `5 Whys`
— a single why-chain can't hold three actors and a recurring loop;
`Double Diamond` — the problem is already well-defined, this isn't a
discovery gap. The class stays `complex` in the output even though the
recommendation is a partial substitute.
