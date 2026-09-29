# Theory of Change

## When it fits

One intervention is already chosen, and the question is how it reaches an
outcome.

## Process

You are executing the Theory of Change framework within the systemic-design
skill. Six stages in a chain:

inputs → activities → outputs → short-term outcomes → long-term outcomes →
impact

1. Fill each stage from the input. A stage the input does not support says
   what evidence would fill it.
2. For each of the five adjacent pairs, record a `links` entry:
   `{from, to, assumption}` — what has to be true for the earlier stage to
   produce the later one. Every link carries one.
3. Each assumption also appears in the core `assumptions` field, status
   `unverified` unless the human confirmed it.
4. No dates. This is a causal chain, not a schedule.

## Output block

Emit the `theory_of_change` block from `references/contract.md`: `inputs`,
`activities`, `outputs`, `short_term_outcomes`, `long_term_outcomes`,
`impact`, `links`. A chain is not a cycle; it renders as a list.

## Stop when

All six stages have content or a stated evidence gap, and all five links
carry an assumption.
