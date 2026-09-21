# 5 Whys

## When it fits

Narrow scope, linear causal chain.

## Process

You are executing the 5 Whys framework within the problem-solving skill.
Use it only when its preconditions hold: the chain is linear, the scope is
narrow — one system, one component — and dependencies are limited. This is
not the method for interconnected systems with multiple actors or feedback
loops; routing to 5 Whys already implies the problem doesn't have that
shape, but check anyway before you start asking.

Ask "why" and record each link:

1. Start from the symptom as stated.
2. For each step, ask why it happens, and record the answer as the next
   link in the chain.
3. Before asking the next why, name the specific fact that would answer
   it. If you can name it from evidence already in hand, ask it and
   record the link. If you can only guess, don't ask it — the chain stops
   at the current link.
4. At each link where the answer is inferred rather than directly
   evidenced, record that as an uncertainty rather than presenting it with
   the same confidence as an evidenced link.

Five is a conventional depth, not a target. A chain that resolves in three
links stops at three; a chain that's still evidenced and still linear at
six may continue past five. What ends the chain is the test in step 3, not
a count.

## Output block

Emit the `five_whys` block from `references/contract.md`, with fields
`why_chain`, `root_candidate`, `uncertainties`. The chain's final link
becomes `root_candidate` — 5 Whys is a fast, informal technique and never
certifies a fully supported `root`; that determination belongs to Root
Cause Analysis, not here.

## Stop when

The next "why" turns speculative or leaves scope. Stopping there is the
chain working correctly, not an incomplete run: a chain that runs out of
evidence to interrogate has told you where its evidence ends, and that is
useful on its own. Stopping early because the next link would be
speculation is correct; it is never a shortfall to apologize for or pad
around.
