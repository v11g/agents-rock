# problem-solving

Takes a problem — raw, framework-named, or handed over by `problem-router`
— to a tested next step: a supported root cause, or an experiment with a
measurement plan. It picks the framework that fits (Double Diamond, Root
Cause Analysis, 5 Whys, A3, or PDCA), recommends one when none is named,
and lets the human confirm.

Run `/reasoning:problem-solving "<problem>"` to get a recommendation, or
`/reasoning:problem-solving <framework> "<problem>"` to skip straight to a
chosen framework. It also accepts a hand-off from `problem-router` once the
human has confirmed the route.

## When to reach for it

- A problem needs analysis, not a direct answer — recurring failures,
  unclear causes, improvement work, or a change that needs a measurable
  hypothesis.
- You already know which framework fits and just want to run it.
- `problem-router` has classified the problem and the human confirmed
  where it should go.

Skip it when the problem's shape isn't clear yet — route through
`problem-router` first so it lands on the right framework.

## Worked example

Input: `/reasoning:problem-solving five_whys "Deploys fail intermittently
after the runner image update. ci-run-4471 log attached."`

`five_whys` is named, so it runs directly. The chain resolves in two links
— the runner can't pull the base image, the registry credential expired —
and stops there because the log runs out of evidence, not because five
links weren't reached. Output: the six core fields plus one `five_whys`
block, sized to what a two-line problem with one log actually supports.

## What it deliberately does not do

- Doesn't classify an unclear problem — that's `problem-router`'s job;
  this skill runs the framework it's given.
- Doesn't write the fix, edit files, or run the experiment it designs. It
  stops at a tested next step.
- Doesn't run more than one framework per problem without the first one's
  stopping rule having fired and a stated reason to continue.
- Doesn't pad a small problem out to fill every section of a framework —
  length scales to the evidence, not to the template.
- Doesn't emit numeric confidence — only `low` / `medium` / `high`.
