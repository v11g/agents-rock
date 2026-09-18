# Skill evaluation — iteration 1

All five shipped plugin skills, evaluated against a no-skill control.
Run 2026-09-17/18. 30 runs (15 evals × with-skill / without-skill), 30 graded,
2.39M tokens in run agents alone.

## Results

| Skill | with-skill | control | delta | token cost |
|---|---|---|---|---|
| business-analyst | 100% | 44% ± 19% | +0.56 | +16k |
| new-lead | 100% | 28% ± 19% | +0.72 | +10k |
| analyze-requirements | 100% | 28% ± 9% | +0.72 | +36k |
| estimate | 100% | 22% ± 9% | +0.78 | +31k |
| proposal | 100% | 22% | +0.78 | +11k |

Every skill passed every assertion. **Read that with the caveat below.**

## The headline caveat: the suite measures conformance, not judgment

Across all five skills, roughly half the assertions pass for both arms, and most
of the rest test the skill's own schema, filenames or vocabulary — things a
control was never shown and could not satisfy.

Per-skill, counted by the graders:

- analyze-requirements eval-1: **1 of 6** assertions is about substance. Both arms
  pass it. The 6/6-vs-1/6 gap is format conformance.
- analyze-requirements eval-0: 2 of 6 carry signal; the two the skill's pitch rests
  on (`no-invented-components`, data-sensitivity) pass in both arms.
- proposal eval-2: the highest-stakes assertion — do not promise a certification
  for patient data — **passes in both arms**. A competent baseline clears it unaided.
- estimate eval-0: only assertion 4 catches a real substantive control error.

Several assertions also name the skill's own output paths and headings rather than
the artefact class, so a control using different filenames passes on a literal read.
One grader noted a strict string-matching grader would have scored the proposal
eval-0 control 2/6 instead of 0/6.

**This is the top item for iteration 2.** The assertions need to test judgment —
does it detect contradictions, does every requirement trace to a source, does it
challenge whether the requested artefact is the right one — rather than schema.

## What the skills genuinely win on

**Four gate-checks, four holds.** Given thin evidence and deadline pressure, every
skill refused; every control produced something sendable, inventing a price in
three of four cases.

| Gate | skill | control |
|---|---|---|
| new-lead skips-to-proposal | refused; fixture byte-identical | priced proposal, `value: 94400` written to the registry |
| estimate thin-evidence | no number emitted | £12k–£190k across three options |
| proposal no-estimate | refused, named the missing input | £48,400–£56,650 at an invented £550/day |
| analyze-req unknowns | asked 8 questions | 13-file scaffold (TBD-marked, invented nothing) |

**Invention discipline.** In the business-analyst gate the control fabricated 7
values absent from the source thread (20%, 9 days, 7 days, "45 minutes" ×3, an
inferred date, an illustrative 40). The skill fabricated none. Controls twice
invented integrations against an explicit "nothing else" instruction.

**Why the refusal matters, concretely.** In proposal eval-0 the control's caveats
did not travel with the document: 16 price references in the client-facing file
against one buried qualifier, while the explicit warnings ("I picked the day rate
out of the air") lived only in an internal note headed "Do not send this to Marco"
and in the chat reply. Worse, the caveats cut the wrong way — the human was told
exposure was capped at 8 days, but Stage 1's £4,400 was a *fixed* price derived
from the fabricated rate.

> The skill's value is not "add caveats", it is "do not create the separable artefact."

## What the skills lose on

**business-analyst stops checking when the client says there is nothing to check.**
In eval-1 the prompt ends "nothing contradicted anything else on the call." The
prompt then contradicts itself — Goal 2 says "zero sub-8%-margin quotes issued"
while BR-01 makes sub-8% quotes issuable with approval. The control caught it in
three places. The skill recorded `conflicts: []` and wrote "You confirmed nothing
contradicted." It *can* detect conflicts — it caught one unprompted in eval-2 — so
this is narrow and fixable.

**estimate's arithmetic favours answers independently of the inputs.** Three
verified modelling faults, all touching the staffing comparison the skill exists
to produce:

- `dominantSeniority` gives a 2-person senior-dominant team ×0.85 and a 3-person
  team ×1.00. Confirmed by executing `estimate-math.mjs`. At parity the unaided
  pair is 911.5h / 3.62mo / ~$65,900 rather than 795.99h / 3.16mo / $57,488 —
  **0.46 months and ~$8,400 of the recommendation is an artefact.**
- `scenarioRollup` never adds person-hours for an extra head, so a cheaper second
  engineer always prices lower.
- Tooling prorates an unprorateable seat: a $14.95 line for a $200/mo seat. The
  $185 understatement exceeds the $62 gap between its own scenarios.

**estimate under-scopes by roughly a third.** On identical inputs: skill 16 tasks
(570.67h) + a flat 35% overhead; control 37 lines (1,578h). ~753h has no task at
all — platform foundation 191h, QA/UAT/integration/perf 289h, cross-cutting
design and review 172h, threat model and cutover 101h. A flat overhead percentage
is standing in for CI, IaC, QA and cutover.

**estimate has no calendar model.** It converts hours to months as
`hours / (effectiveCapacity × 140)` — no holidays, ramp-up or partial availability,
and it never converts months to a date. The control computed 17 Mar 2027 and found
the client's 1 Mar deadline unreachable under either staffing option. The skill
said the pair had "roughly two clear months against a 3.16-month plan" and then
called a 2.27-month plan "inside" that runway.

**proposal has no fixed-bid-with-contingency path.** It can only offer a derived
range. For a price-led buyer with a hard ceiling, a 2.6× spread forces the
conversation the client explicitly ruled out. The control closed by publishing the
internal point total as a firm commitment — commercially better, financially unsafe
(a mean turned into a ceiling, ~54% overrun exposure, no contingency). Neither
behaviour is right; the third option is missing.

## Verified code bugs

| Bug | Location | Effect |
|---|---|---|
| `render.mjs` never mkdirs its `--out` dir (`compute.mjs:22` does) | `estimate/scripts/render.mjs:75` | Every first run throws an unhandled ENOENT. `writing.md:243` documents `--out <dir>/dist/`, which does not exist yet |
| Prerequisite gate has no code enforcement | `proposal/scripts/derive.mjs:13`, `validate.mjs:14` | Both read `estimation.json` with no `existsSync`; pushing past the gate yields a raw ENOENT, not "run the estimate skill first" |
| Dashboard reads estimate output at the wrong depth | `new-lead/scripts/lib/map-nodes.mjs:126`, `map.mjs:81` | Producer emits `{inputs, computed}`; consumer reads `est.scenarios` / `est.risks`. Against real output the lead map silently renders 0 scenarios and 0 risks. `map.test.mjs:13` asserts only that the file exists, and the fixture was written to match the reader |
| Duration check rejects any quoted duration | `proposal/scripts/lib/checks-client.mjs:24` | `/(\d+)\s+months\b/` matches "photos retained 12 months" from ARCHITECTURE.md and demands it be a derived figure |
| Hyphen treated as a word boundary | `proposal/scripts/lib/checks-client.mjs:62` | Upstream feature id `board-api` trips the `api` jargon deny-list with a misleading message |

**Recurring theme: the scripts do not defend the invariants the prose asserts.**
Four separate instances. `validate.mjs` has no compliance check at all — grep for
`hipaa|gdpr|certif|encrypt` returns nothing — so the "never promise a
certification" rule rests entirely on an inline review step.

## Outside the skills

`src/cli/install.mjs:22-24` does `rmSync(dest)` then `cpSync(skill.dir, dest)`.
An interrupt between them destroys a working install and leaves a partial one.
`cpSync` is synchronous, so a SIGINT handler cannot help — the fix is
copy-to-temp then atomic `rename`. Both eval arms found this independently.
Related: re-running npx silently reuses stale canonical skills unless `--force`
(`install.mjs:18-21`), so plain re-invocation is not an upgrade path.

## Artefacts

Committed (the deliverable):

    plugins/*/skills/*/evals/evals.json          15 evals
    plugins/*/skills/*/evals/fixtures/           37 fixture files

Gitignored (run outputs, regenerable):

    plugins/*/skills/*-workspace/iteration-1/    runs, grading, benchmarks
    plugins/*/skills/*-workspace/review-iteration-1.html    5 viewers
    plugins/*/skills/*-workspace/iteration-1/skill-defects.md   78 defects

## Recommended order for iteration 2

1. Rewrite assertions to test judgment, not schema. Half the current suite cannot
   distinguish the skill from a competent control.
2. Fix the five verified code bugs. All are small; two crash on the happy path.
3. Fix `dominantSeniority` and `scenarioRollup`. They bias the staffing
   recommendation by more than the difference they are measuring.
4. Add a calendar model to estimate, or stop reporting months.
5. Make business-analyst re-check premises the client asserts are settled.
6. Add a fixed-bid-with-contingency path to proposal.
