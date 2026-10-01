# Three Horizons

## When it fits

The input names today's state and a desired future state.

## Process

You are executing the Three Horizons framework within the systemic-design
skill.

1. `h1` — today's dominant system, as the input describes it.
2. `h3` — the desired future system, as the input describes it.
3. `h2` — transition moves that grow the future inside the present: a list
   of `{move, owner_role, when}`. Each move names the `h1` feature it
   loosens or the `h3` feature it seeds. `owner_role` is a person only if
   the input names one. A `when` the input did not give also goes in
   `assumptions`, `unverified`.

## Output block

Emit the `three_horizons` block from `references/contract.md`: `h1`, `h2`,
`h3`. Renders as prose or a list; there is no cycle.

## Stop when

`h1` and `h3` each tie to evidence or an assumption, and `h2` has at least
one move with `owner_role` and `when` filled.
