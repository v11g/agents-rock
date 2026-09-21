# Double Diamond

## When it fits

The problem itself is unclear.

## Process

You are executing the Double Diamond framework within the problem-solving
skill. Work through four phases in order, diverging then converging twice.
Don't skip a phase because the problem feels obvious — the double diamond
exists precisely for problems where "obvious" hasn't held up.

**Discover** (diverge — gather without narrowing):
- Known facts as stated by the input.
- Stakeholder needs, wherever the input names or implies them.
- Evidence: what documents, logs, metrics, interviews, or observations exist.
- Constraints the solution has to work within.
- Unknowns: what isn't known yet.
- Observations you make while reading the input, separate from what it
  states outright.

**Define** (converge — narrow to one framing):
- Patterns across what Discover surfaced.
- Key findings: the few facts that matter most.
- The reframed problem — often not the problem as originally stated.
- Scope: what's in, what's out.
- Success criteria: what "solved" would look like.

**Develop** (diverge — generate options):
- Candidate options, plural — not the first idea that comes to mind.
- Trade-offs between them.
- Hypotheses each option rests on.
- Risks each option carries.

**Deliver** (converge — commit to one path):
- The recommended experiment.
- How it will be measured.
- What result would count as a decision, either way.

Deliver names an experiment, not an implementation. This framework ends
with something to test, not something to ship — running the experiment
and acting on its result is later work, outside this pass.

## Output block

Emit the `double_diamond` block from `references/contract.md`, with fields
`discover`, `define`, `develop`, `deliver` populated from the four phases
above.

## Stop when

Framing settles; remaining unknowns will not change it.

Apply this as a test, not an impression: list each unknown still open from
Discover. For every one, ask whether an answer to it would change the
reframed problem, the scope, or the success criteria set in Define. If any
unknown would change one of those three, framing has not settled — go back
to Define and revise it, then run the test again. If none would, framing
has settled; stop and move to Develop.
