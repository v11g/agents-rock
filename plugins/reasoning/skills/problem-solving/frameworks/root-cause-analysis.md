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
