# Root Cause Analysis

## When it fits

Symptom is clear, cause is not.

## Process

You are executing the Root Cause Analysis framework within the
problem-solving skill. Trace the causal chain in one direction, from what's
observed to what can be acted on:

symptom → immediate causes → contributing causes → underlying causes →
root causes → corrective actions

At each layer, only add a cause if something in the evidence or a stated
assumption points to it. A layer with nothing supporting it is left empty
rather than filled to look complete.

Labelling a cause `root` is a claim, not a placeholder for "the deepest
thing we found." Apply this test mechanically, per candidate:

- Can you point to a specific entry in `evidence` that ties this cause
  directly to the symptom, without inserting a further inferential step to
  make the connection?
- If yes: label it `root`.
- If no — the link exists only through inference, assumption, or a chain
  of "probably" — label it `root_candidate` instead, and state next to it
  exactly what evidence would be needed to promote it.

Never resolve a `root_candidate` to `root` by asserting harder. The label
changes only when new evidence arrives, not when the write-up sounds more
confident.

Corrective actions attach to whatever the analysis actually reached —
`root` causes where you have them, named `root_candidate`s where you
don't, with the gap stated rather than smoothed over.

## Output block

Emit the `rca` block from `references/contract.md`, with fields `symptom`,
`immediate`, `contributing`, `underlying`, `root`, `actions`. Within
`root`, label each entry `root` or `root_candidate` per the test above.

## Stop when

Causes trace to something actionable and supported.

Apply this as two tests over what the `root` field already holds, not as an
impression that the chain feels deep enough. **Supported** is the `root` /
`root_candidate` test in Process above, run per entry: a specific `evidence`
entry ties the cause to the symptom with no further inferential step. Every
entry has been labelled by that test, and each `root_candidate` carries the
evidence that would promote it. **Actionable** means every entry in `root`
has at least one named entry in `actions` that someone could start on
without first investigating further — a change with an owner and a scope,
not "look into X" or "understand why Y". If any entry in `root` has no such
action, the chain has not reached something actionable: keep tracing, or
state plainly that it stopped short and what blocks it.
