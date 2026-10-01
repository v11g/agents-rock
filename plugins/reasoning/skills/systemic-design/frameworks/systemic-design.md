# Systemic Design (explore → reframe → create → catalyse)

## When it fits

A system needs changing and no path has been chosen yet.

## Process

You are executing the Systemic Design framework within the systemic-design
skill. Four phases, in order. Each phase uses only what the earlier phases
and the input established.

1. `explore` — actors, behaviours, structures, tensions, constraints. Each
   entry cites an `evidence` entry or an `assumptions` entry. An actor or
   structure the input did not state goes in `assumptions`, `unverified`.
2. `reframe` — the challenge restated at the level of the system, the
   boundary, the desired change, and the principles any intervention must
   respect.
3. `create` — interventions. Each names the `explore` entry it targets,
   its dependencies, one unintended effect, and a small experiment that
   would test it.
4. `catalyse` — `plan`: a list of `{step, owner_role, when, signal}`, plus
   the feedback mechanism and success measures. `owner_role` is a person
   only if the input names one. A `when` the input did not give also goes
   in `assumptions`, `unverified`. A `signal` is something someone can
   observe.

## Output block

Emit the `systemic_design` block from `references/contract.md`: `explore`,
`reframe`, `create`, `catalyse`. The plan is a sequence, not a cycle, so it
renders as a list.

## Stop when

Every intervention targets a named `explore` entry, every plan step has all
four fields, and every `signal` is observable. An `explore` entry resting
only on an `unverified` assumption does not block the stop; it goes to the
interview per `SKILL.md` step 4c.
