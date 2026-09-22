# Leverage Points

## When it fits

The human asks where to intervene.

## Process

You are executing the Leverage Points framework within the systems-thinking
skill. Its levels describe depths of a system model, so the model has to be
on the page. This framework builds its own — thin when the input is thin,
and visibly so.

1. Build `elements`. Read the input (or a prior systems-thinking result
   handed in as input) and record each element you can name, tagged with
   one `kind`:

   | `kind` | What it is |
   | --- | --- |
   | `parameter` | a setting or quantity that can be turned up or down |
   | `information_flow` | who learns what, and when |
   | `rule` | a policy or constraint someone enforces |
   | `incentive` | what behaviour is rewarded or measured |
   | `structure` | how the parts are arranged or work is routed |
   | `goal` | what the system is trying to achieve |
   | `mental_model` | a belief holding the rest in place |

   Every row carries an evidence type from the contract. A row the input
   did not state is `inferred`, and the output says so plainly rather than
   presenting it as observed.

2. Build `points`. For each element, ask whether intervening there would
   change the behaviour. Record `intervention`, `level`, `expected_effect`,
   `risks`, and `evidence`.

3. `level` must match the `kind` of a row in `elements`. A level with no
   matching row is an intervention into a part of the system you have not
   established exists — remove it, or add the element with its evidence
   type.

4. Note depth without ranking mechanically: `parameter` interventions are
   the shallowest and the easiest to reverse; `goal` and `mental_model`
   interventions are the deepest and the slowest. Say which you are
   proposing. Do not assert that a deeper intervention is better for this
   problem unless the evidence supports it.

## Output block

Emit the `leverage_points` block from `references/contract.md`: `elements`,
`points`.

```yaml
leverage_points:
  elements:
    - element:   "senior engineers triage all inbound requests"
      kind:      rule
      evidence:  user-provided fact
    - element:   "throughput is measured per-team"
      kind:      incentive
      evidence:  inferred
  points:
    - intervention:    "route triage through a rota"
      level:           rule
      expected_effect: "spreads interrupt load off the two named seniors"
      risks:           "triage quality drops while the rota ramps"
      evidence:        "user-provided fact: seniors are constantly interrupted"
```

`elements` is a flat kind-tagged list. It is not a system map — no
boundary, no relationships, no dependencies. If the human needs those, the
framework they want is `system_map`.

## Stop when

Every `kind` present in `elements` has either an intervention or an
explicit "none identified, because …".

Seven kinds, one pass. This framework names where to push, the expected
effect, and the risks. It does not produce an adoption plan, a sequence, or
an owner — that is `systemic-design`, which is not built in this release.
