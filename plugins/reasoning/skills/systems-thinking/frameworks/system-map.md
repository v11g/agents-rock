# System Map

## When it fits

Two or more actors whose relationships to each other are unclear.

## Process

You are executing the System Map framework within the systems-thinking
skill. The output is a bounded map, and the boundary is the whole point —
an unbounded map is a list of everything anyone has ever mentioned.

1. Seed the map from the input alone: every actor, component, policy,
   incentive, and information flow the input names.
2. Record a `relationship` only between two seeded elements, and only where
   the input states or directly evidences the connection.
3. Test each remaining candidate node: does it appear in the input, **or**
   does removing it break a `relationship` already recorded? If neither, it
   is outside the boundary and goes in `external_factors`.
4. Repeat step 3 until no remaining candidate passes.
5. State `system_boundary` explicitly as the set of elements that passed.
   The boundary is closure over what the input stated — not a judgement
   about what matters.

`dependencies` records where one element cannot function without another,
and only where the input says so. An inferred dependency is an
`assumptions` entry.

## Output block

Emit the `system_map` block from `references/contract.md`:
`system_boundary`, `actors`, `components`, `relationships`, `dependencies`,
`external_factors`.

A map whose `relationships` contain a cycle gets a Mermaid diagram; one
without gets prose. See the contract's Rendering section.

## Stop when

No remaining candidate node passes the step 3 test.

That is the stopping condition in full. Do not keep expanding because the
map looks sparse — a sparse map over a thin input is accurate, and padding
it with plausible actors turns evidence into decoration.
